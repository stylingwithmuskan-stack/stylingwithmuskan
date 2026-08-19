import { validationResult } from "express-validator";
import fs from "fs";
import path from "path";
import Booking from "../../../models/Booking.js";
import mongoose from "mongoose";
import Coupon from "../../../models/Coupon.js";
import { OfficeSettings, Category } from "../../../models/Content.js";
import { BookingSettings } from "../../../models/Settings.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import BookingLog from "../../../models/BookingLog.js";
import CustomEnquiry from "../../../models/CustomEnquiry.js";
import User from "../../../models/User.js";
import Feedback from "../../../models/Feedback.js";
import { DEFAULT_TIME_SLOTS, slotLabelToLocalDateTime, parseSlotLabelToHM, parseDurationToMinutes, isTimeInWindow } from "../../../lib/slots.js";
import { isIsoDate } from "../../../lib/isoDateTime.js";
import { computeExpiresAt, pickNextProviderForBooking, refundProviderCommissionIfNeeded } from "../../../lib/assignment.js";
import { resolveBookingSettings } from "../../../lib/settings.js";
import { resolveServiceLocation } from "../../../lib/locationResolution.js";
import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../../../config.js";
import { getIO } from "../../../startup/socket.js";
import { notify } from "../../../lib/notify.js";
import Vendor from "../../../models/Vendor.js";
import {
  calculateCustomerSubscriptionBenefits,
  createLedgerEntry,
  getSubscriptionSnapshot,
} from "../../../lib/subscriptions.js";
import { calculateRefundPolicy, processSmartRefund } from "../../../lib/refund.service.js";
import { buildAssignmentCandidates } from "../../../lib/assignmentCandidates.js";
import { invalidateProviderSlots } from "../../../lib/availability.js";
import { findZonesContainingPoint } from "../../../lib/geoMatching.js";

function logDevAssignment(message, payload = {}) {
  if (process.env.NODE_ENV === "production") return;
  try {
    console.log(`[AssignmentFlow] ${message}`, payload);
  } catch { }
}

async function computeAdvanceFromCategories(items = [], bookingType = "instant") {
  const bType = String(bookingType || "instant").toLowerCase();

  // Fetch all categories with advance > 0 to check locally
  const cats = await Category.find({ advancePercentage: { $gt: 0 } }).lean();

  let sum = 0;
  for (const it of items) {
    const itCat = String(it.category || "").trim().toLowerCase();
    if (!itCat) continue;

    const c = cats.find(cat =>
      String(cat.id || "").toLowerCase() === itCat ||
      String(cat.name || "").toLowerCase() === itCat
    );
    if (!c) continue;

    const pct = Number(c.advancePercentage || 0);
    const catType = String(c.bookingType || "").toLowerCase();
    // Advance applies:
    // 1. If the category itself requires advance (any bookingType category with advancePercentage set)
    // 2. OR if booking is explicitly scheduled/prebook
    if (pct > 0 && (catType === "scheduled" || catType === "prebooking" || catType === "pre-book" || catType === "customize" || catType === "instant" || bType === "scheduled" || bType === "pre-book")) {
      sum += Math.ceil((Number(it.price) || 0) * (Number(it.quantity) || 1) * (pct / 100));
    }
  }
  return Math.max(sum, 0);
}
function computeTotals(items = [], coupon) {
  const total = items.reduce((sum, it) => sum + (Number(it.price) * (Number(it.quantity) || 1)), 0);
  let discount = 0;
  if (coupon) {
    if (coupon.discountType && coupon.discountValue > 0) {
      if (coupon.discountType === "flat") {
        discount = Number(coupon.discountValue);
      } else {
        discount = Math.round(total * (Number(coupon.discountValue) / 100));
      }
    } else if (coupon.type) {
      if (String(coupon.type).toUpperCase() === "FIXED") {
        discount = Number(coupon.value);
      } else {
        discount = Math.round(total * (Number(coupon.value) / 100));
      }
    }
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    if (coupon.minOrder && total < coupon.minOrder) {
      discount = 0;
    }
  }
  return { total, discount, finalTotal: Math.max(total - discount, 0) };
}

function bookingServicesToItems(services = []) {
  if (!Array.isArray(services)) return [];
  return services.map((s) => ({
    name: s?.name || "",
    price: Number(s?.price) || 0,
    duration: s?.duration || "",
    category: s?.category || "",
    serviceType: s?.serviceType || "",
    image: s?.image || "",
    quantity: Number(s?.quantity) || 1,
  }));
}

async function loadBookingSettings() {
  return resolveBookingSettings();
}

function parseHHMMToMinutes(v) {
  const m = String(v || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

async function attachProviderToBookings(bookings = []) {
  const raw = Array.from(new Set(
    (bookings || []).map((b) => String(b?.assignedProvider || "")).filter(Boolean)
  ));
  if (raw.length === 0) return bookings;

  const idIds = raw.filter((v) => mongoose.isValidObjectId(v));
  const phoneIds = raw.filter((v) => /^\d{10}$/.test(v));

  const provsById = idIds.length
    ? await ProviderAccount.find({ _id: { $in: idIds } }).select("name phone rating profilePhoto experience city totalJobs tag zones").lean()
    : [];
  const provsByPhone = phoneIds.length
    ? await ProviderAccount.find({ phone: { $in: phoneIds } }).select("name phone rating profilePhoto experience city totalJobs tag zones").lean()
    : [];

  const byKey = new Map();
  for (const p of [...(provsById || []), ...(provsByPhone || [])]) {
    byKey.set(p._id.toString(), p);
    if (p.phone) byKey.set(String(p.phone), p);
  }

  // Compute actual completed jobs count from Booking collection for each provider
  const providerIds = Array.from(new Set(
    [...(provsById || []), ...(provsByPhone || [])].map(p => p._id.toString())
  ));
  const completedJobsMap = new Map();
  if (providerIds.length > 0) {
    try {
      const jobCounts = await Booking.aggregate([
        { $match: { assignedProvider: { $in: providerIds }, status: "completed" } },
        { $group: { _id: "$assignedProvider", count: { $sum: 1 } } }
      ]);
      for (const j of jobCounts) {
        completedJobsMap.set(String(j._id), j.count);
      }
    } catch (err) {
      // Fallback: use totalJobs from ProviderAccount if aggregation fails
      console.error("[attachProviderToBookings] completedJobs aggregation failed:", err.message);
    }
  }

  return (bookings || []).map((b) => {
    const p = byKey.get(String(b.assignedProvider || ""));
    if (!p) return b;
    const pid = p._id.toString();
    const actualCompletedJobs = completedJobsMap.get(pid) || p.totalJobs || 0;
    const slot = {
      ...(b.slot || {}),
      provider: {
        id: pid,
        name: p.name || "",
        phone: p.phone || "",
        rating: p.rating || 0,
        profilePhoto: p.profilePhoto || "",
        experience: p.experience || "",
        city: p.city || "",
        totalJobs: actualCompletedJobs,
        tag: p.tag || "",
        zones: p.zones || [],
      },
    };
    return { ...b, slot };
  });
}


export async function list(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const customerId = req.user._id.toString();
  const q = {
    $or: [
      { customerId: customerId },
      { customerId: new mongoose.Types.ObjectId(customerId) }
    ]
  };

  let total = await Booking.countDocuments(q);
  let items = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();

  // FALLBACK: If no bookings found by ID, try finding by phone number to handle ID mismatches
  if (items.length === 0 && req.user.phone) {
    const phoneQ = { customerPhone: req.user.phone };
    const phoneItems = await Booking.find(phoneQ).sort({ createdAt: -1 }).limit(limit).lean();
    if (phoneItems.length > 0) {
      console.log(`[BookingList] Fallback to phone search found ${phoneItems.length} bookings for ${req.user.phone}`);
      items = phoneItems;
      total = await Booking.countDocuments(phoneQ);
    }
  }

  // DEBUG LOG TO FILE
  try {
    const allUserBookings = await Booking.find({ customerPhone: req.user.phone }).select('_id customerId status').lean();
    const logPath = path.join(process.cwd(), "booking_debug.log");
    const logMsg = `[${new Date().toISOString()}] DEBUG LIST:
      ReqUser: ${req.user._id} (${typeof req.user._id})
      SearchQuery: ${JSON.stringify(q)}
      ResultCount: ${items.length}
      PhoneMatchCount: ${allUserBookings.length}
      PhoneMatchDetails: ${JSON.stringify(allUserBookings)}\n`;
    fs.appendFileSync(logPath, logMsg);
  } catch (err) {
    console.error("[BookingDebugError]", err);
  }

  let bookings = (items || []).map((b) => ({
    ...b,
    id: b._id?.toString?.() || b.id,
    // Back-compat for UI: some components expect booking.items[] (older shape) instead of booking.services[].
    items: Array.isArray(b.items) ? b.items : bookingServicesToItems(b.services),
  }));
  bookings = await attachProviderToBookings(bookings);
  const bookingIds = bookings.map((b) => String(b.id || b._id || "")).filter(Boolean);
  const feedbackDocs = bookingIds.length > 0
    ? await Feedback.find({
      bookingId: { $in: bookingIds },
      customerId: req.user._id.toString(),
      type: "customer_to_provider",
    }).select("bookingId").lean()
    : [];
  const feedbackBookingIds = new Set((feedbackDocs || []).map((doc) => String(doc.bookingId || "")));
  bookings = bookings.map((booking) => ({
    ...booking,
    customerFeedbackSubmitted: feedbackBookingIds.has(String(booking.id || booking._id || "")),
  }));
  res.json({ bookings, page, limit, total });
}

export async function quote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const [couponDoc, advanceAmount, bookingSettings] = await Promise.all([
    req.body.couponCode ? Coupon.findOne({ code: req.body.couponCode, isActive: true }).lean() : null,
    computeAdvanceFromCategories(req.body.items || [], req.body.bookingType),
    resolveBookingSettings()
  ]);

  let coupon = couponDoc;
  if (coupon && coupon.expiryDate) {
    const expiry = new Date(coupon.expiryDate);
    if (!isNaN(expiry.getTime())) {
      expiry.setHours(23, 59, 59, 999);
      if (expiry < new Date()) {
        console.log(`[Quote] Coupon ${coupon.code} expired on ${coupon.expiryDate}, ignoring.`);
        coupon = null;
      }
    }
  }

  const totals = computeTotals(req.body.items, coupon);
  console.log(`[Quote] couponCode=${req.body.couponCode}, found=${!!coupon}, discount=${totals.discount}, total=${totals.total}, finalTotal=${totals.finalTotal}`);

  const subBenefits = await calculateCustomerSubscriptionBenefits({
    userId: req.user._id.toString(),
    total: totals.total,
    subtotalAfterCoupon: totals.finalTotal,
  });

  totals.discount += subBenefits.subscriptionDiscount;

  let originalConvenienceFee = 0;
  let convenienceFee = 0;

  if (totals.total <= (bookingSettings.convenienceFeeThreshold || 750)) {
    originalConvenienceFee = bookingSettings.convenienceFeeAmount || 49;
    convenienceFee = subBenefits.snapshot?.zeroConvenienceFee ? 0 : originalConvenienceFee;
  }

  // Wait, if I add it to finalTotal here, I should make sure it reflects properly.
  // Actually, I shouldn't modify finalTotal here if frontend handles it, but wait!
  // If frontend expects finalTotal to INCLUDE convenienceFee, then yes.
  totals.finalTotal = Math.max(totals.total - totals.discount + convenienceFee, 0);

  if (advanceAmount > 0) {
    advanceAmount = Math.min(advanceAmount + convenienceFee, totals.finalTotal);
  }

  res.json({
    ...totals,
    couponApplied: coupon ? coupon.code : null,
    advanceAmount,
    subscription: subBenefits.snapshot,
    subscriptionDiscount: subBenefits.subscriptionDiscount,
    discountFundedBy: coupon?.discountBorneBy || subBenefits.discountFundedBy || "admin",
    convenienceFee,
    originalConvenienceFee,
  });
}

export async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { items, slot, address, bookingType, couponCode, allowAutoFallback } = req.body;

  // ✅ NEW: Validate service availability on booking date (SAFETY NET)
  if (items?.length > 0 && slot?.date) {
    try {
      const { checkServiceExceptions, isTimeInRange } = await import("../../../lib/serviceAvailability.js");
      const serviceIds = items.map(item => item.id || item.serviceId).filter(Boolean);

      if (serviceIds.length > 0) {
        const blockedInfo = await checkServiceExceptions(serviceIds, slot.date);

        // Check full day block
        if (blockedInfo.isFullyBlocked) {
          console.log(`[Booking] Service "${blockedInfo.blockedService}" is blocked on ${slot.date}`);
          return res.status(400).json({
            error: `Service "${blockedInfo.blockedService}" is not available on ${slot.date} due to scheduling exceptions.`,
            code: "SERVICE_BLOCKED",
            blockedService: blockedInfo.blockedService
          });
        }

        // Check partial time block
        if (blockedInfo.partialBlocks?.length > 0 && slot?.time) {
          const isBlocked = blockedInfo.partialBlocks.some(block =>
            isTimeInRange(slot.time, block.startTime, block.endTime)
          );

          if (isBlocked) {
            console.log(`[Booking] Service "${blockedInfo.blockedService}" is blocked at ${slot.time} on ${slot.date}`);
            return res.status(400).json({
              error: `Service "${blockedInfo.blockedService}" is not available at ${slot.time} on ${slot.date}.`,
              code: "SERVICE_TIME_BLOCKED",
              blockedService: blockedInfo.blockedService
            });
          }
        }
      }
    } catch (err) {
      // ✅ Fail-open: If check fails, log but don't block booking
      console.error("[Booking] Service exception validation failed:", err);
    }
  }

  const fallbackAddr = (req.user?.addresses && req.user.addresses[0]) ? req.user.addresses[0] : {};
  // Persist booking city for analytics + filtering. Back-compat: if city not provided, fall back to area.
  const safeAddress = {
    houseNo: address?.houseNo || fallbackAddr.houseNo || "",
    area: address?.area || fallbackAddr.area || "",
    landmark: address?.landmark || fallbackAddr.landmark || "",
    city: address?.city || address?.area || fallbackAddr.city || fallbackAddr.area || "",
    cityId: address?.cityId || fallbackAddr.cityId || "",
    zone: address?.zone || fallbackAddr.zone || "",
    zoneId: address?.zoneId || fallbackAddr.zoneId || "",
    lat: address?.lat ?? fallbackAddr.lat ?? null,
    lng: address?.lng ?? fallbackAddr.lng ?? null,
  };

  // ✅ NEW: Dynamic proper zone resolution from coordinates
  if ((!safeAddress.zone || safeAddress.zone === safeAddress.area) && typeof safeAddress.lat === "number" && typeof safeAddress.lng === "number") {
    try {
      const resolvedZones = await findZonesContainingPoint(safeAddress.lat, safeAddress.lng, safeAddress.city);
      if (resolvedZones && resolvedZones.length > 0) {
        safeAddress.zone = resolvedZones[0];
        console.log(`[Booking] Resolved proper zone: ${safeAddress.zone} for coordinates: ${safeAddress.lat}, ${safeAddress.lng}`);
      }
    } catch (zoneErr) {
      console.error("[Booking] Zone resolution failed:", zoneErr);
    }
  }

  // Final fallback for zone if still empty
  if (!safeAddress.zone) {
    safeAddress.zone = safeAddress.area || safeAddress.city || "";
  }

  // ✅ CRITICAL FIX: Ensure CityId and ZoneId are resolved for NEW users
  // This prevents empty candidateProviders list which causes auto-cancellation
  if (!safeAddress.cityId || !safeAddress.zoneId) {
    if (typeof safeAddress.lat === "number" && typeof safeAddress.lng === "number") {
      try {
        const resolved = await resolveServiceLocation({
          lat: safeAddress.lat,
          lng: safeAddress.lng,
          cityId: safeAddress.cityId,
          cityName: safeAddress.city
        });

        if (resolved.insideServiceArea) {
          safeAddress.city = resolved.cityName || safeAddress.city;
          safeAddress.cityId = resolved.cityId || safeAddress.cityId;
          safeAddress.zone = resolved.zoneName || safeAddress.zone;
          safeAddress.zoneId = resolved.zoneId || safeAddress.zoneId;
          console.log(`[BookingFix] Resolved missing IDs for new user: cityId=${safeAddress.cityId}, zoneId=${safeAddress.zoneId}`);
        }
      } catch (err) {
        console.error("[BookingFix] Address resolution failed:", err);
      }
    }
  }
  const preferredProviderId = String(req.body.preferredProviderId || "").trim();
  const [couponDoc, advanceAmount, settings] = await Promise.all([
    couponCode ? Coupon.findOne({ code: couponCode, isActive: true }).lean() : null,
    computeAdvanceFromCategories(items, bookingType),
    loadBookingSettings()
  ]);

  let coupon = couponDoc;
  if (coupon && coupon.expiryDate) {
    const expiry = new Date(coupon.expiryDate);
    if (!isNaN(expiry.getTime())) {
      expiry.setHours(23, 59, 59, 999);
      if (expiry < new Date()) {
        coupon = null;
      }
    }
  }

  const totals = computeTotals(items, coupon);

  const customerSubscription = await calculateCustomerSubscriptionBenefits({
    userId: req.user._id.toString(),
    total: totals.total,
    subtotalAfterCoupon: totals.finalTotal,
  });

  totals.discount += customerSubscription.subscriptionDiscount;

  let originalConvenienceFee = 0;
  let convenienceFee = 0;

  if (totals.total <= (settings.convenienceFeeThreshold || 750)) {
    originalConvenienceFee = settings.convenienceFeeAmount || 49;
    convenienceFee = customerSubscription.snapshot?.zeroConvenienceFee ? 0 : originalConvenienceFee;
  }

  totals.finalTotal = Math.max(totals.total - totals.discount + convenienceFee, 0);

  if (advanceAmount > 0) {
    advanceAmount = Math.min(advanceAmount + convenienceFee, totals.finalTotal);
  }

  // Override customerSubscription.convenienceFee so it gets saved in Booking.create
  customerSubscription.convenienceFee = convenienceFee;
  if (settings?.minBookingAmount && totals.finalTotal < Number(settings.minBookingAmount)) {
    return res.status(400).json({ error: `Minimum booking amount is INR ${settings.minBookingAmount}.` });
  }
  if (settings?.maxServicesPerBooking && Array.isArray(items) && items.length > Number(settings.maxServicesPerBooking)) {
    return res.status(400).json({ error: `Maximum ${settings.maxServicesPerBooking} services allowed per booking.` });
  }
  const now = new Date();
  const [startH, startM] = (settings?.startTime || settings?.serviceStartTime || "09:00").split(":").map(Number);
  const [endH, endM] = (settings?.endTime || settings?.serviceEndTime || "21:00").split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const withinOffice = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  let notificationStatus = withinOffice ? "immediate" : "queued";

  // Admin toggle check: If autoAssign is false in OfficeSettings, global auto-assign is disabled
  const autoAssignAllowed = settings?.autoAssign !== false;

  // Use admin setting as base, but also respect if user explicitly asked for autoAssign (or if we want to force it)
  const autoAssign = autoAssignAllowed;

  // Build candidate provider list (zone-strict, no city fallback if zone exists)
  const requestedDate = String(slot?.date || "").trim();
  const requestedTime = String(slot?.time || "").trim();
  const requestedDurationMinutes = (items || []).reduce((sum, it) => {
    const per = parseDurationToMinutes(it?.duration, 60);
    const qty = Number(it?.quantity || 1);
    return sum + (per * (Number.isFinite(qty) ? qty : 1));
  }, 0);

  const { candidateProviders: initialCandidates } = await buildAssignmentCandidates({
    address: safeAddress,
    slot,
    items,
    settings,
    customerId: req.user._id.toString(),
    subscriptionSnapshot: customerSubscription.snapshot,
    requestedDurationMinutes,
    useCache: false,
  });
  let candidateProviders = initialCandidates;

  logDevAssignment("Booking create candidate discovery", {
    customerId: req.user._id?.toString?.() || "",
    preferredProviderId: preferredProviderId || "",
    slotDate: requestedDate,
    slotTime: requestedTime,
    bookingType: bookingType || "",
    city: safeAddress.city || "",
    cityId: safeAddress.cityId || "",
    zone: safeAddress.zone || "",
    zoneId: safeAddress.zoneId || "",
    requestedDurationMinutes,
    candidateProviders,
  });

  // Enforce booking window + lead time if slot is valid
  if (isIsoDate(requestedDate) && DEFAULT_TIME_SLOTS.includes(requestedTime)) {
    const slotStart = slotLabelToLocalDateTime(requestedDate, requestedTime);
    if (!slotStart) return res.status(400).json({ error: "Invalid booking slot" });
    const leadMs = Math.max(Number(settings?.minLeadTimeMinutes || 0), 0) * 60 * 1000;
    const bufferMs = Math.max(Number(settings?.bufferMinutes || 0), 0) * 60 * 1000;
    const effectiveLeadMs = Math.max(leadMs, bufferMs);
    const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minute grace period for checkout delays
    if (effectiveLeadMs > 0 && slotStart.getTime() < (now.getTime() + effectiveLeadMs - GRACE_PERIOD_MS)) {
      return res.status(400).json({ error: "Selected slot violates minimum lead time." });
    }
    const maxDays = Math.max(Number(settings?.maxBookingDays || 0), 0);
    if (maxDays > 0) {
      const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
      if (slotStart.getTime() > maxDate.getTime()) {
        return res.status(400).json({ error: "Selected slot exceeds maximum advance booking days." });
      }
    }
    const windowStartMin = parseHHMMToMinutes(settings?.startTime || settings?.serviceStartTime || "");
    const windowEndMin = parseHHMMToMinutes(settings?.endTime || settings?.serviceEndTime || "");
    const hm = parseSlotLabelToHM(requestedTime);
    if (windowStartMin !== null && windowEndMin !== null && hm) {
      const slotMin = hm.hour * 60 + hm.minute;
      if (!isTimeInWindow(slotMin, windowStartMin, windowEndMin)) {
        return res.status(400).json({ error: "Selected slot is outside service hours." });
      }
    }
  }

  const providerIsCandidate = (pid) => !!pid && candidateProviders.includes(pid);

  // LOGIC CHANGE: Check if preferred provider is busy
  if (preferredProviderId && !providerIsCandidate(preferredProviderId)) {
    return res.status(409).json({
      error: "Your selected provider is booked for the selected time slot.",
      code: "PREFERRED_PROVIDER_BUSY"
    });
  }

  // Preferred provider takes priority within the candidate list
  if (preferredProviderId && providerIsCandidate(preferredProviderId)) {
    candidateProviders = [preferredProviderId, ...candidateProviders.filter((x) => x !== preferredProviderId)];
    logDevAssignment("Preferred provider moved to the front of candidate chain", {
      preferredProviderId,
      candidateProviders,
    });
  }

  // Keep booking unassigned at create-time. Actual provider assignment happens on payment confirmation/COD confirmation.
  // This keeps slot UX open for other users until assignment stage is reached.
  let assignedProvider = "";
  let assignmentIndex = -1;
  let lastAssignedAt = null;
  let expiresAt = null;

  // If autoAssign is completely OFF or NO providers were found even in candidate list, it stays unassigned/admin-escalated.
  // CHANGED: Don't fail the booking - allow it to be created and escalated to vendor/admin
  // This prevents "No provider available" error when slot was shown as available
  // 
  // NOTE: This can happen when:
  // 1. Provider was available during slot selection but became busy before booking creation
  // 2. Another user booked the same provider in the meantime
  // 3. Provider went offline or changed availability
  //
  // FUTURE IMPROVEMENT: Pass candidateProvidersBySlot from frontend to backend
  // so we can use the same providers that were shown as available during slot selection
  if (!assignedProvider && candidateProviders.length === 0) {
    logDevAssignment("Booking create found no candidates for selected slot - allowing escalation", {
      slotDate: requestedDate,
      slotTime: requestedTime,
      city: safeAddress.city || "",
      zone: safeAddress.zone || "",
    });
    // Proceed to create booking without assigned provider - it will be escalated.
  }
  // candidateProviders already limited in buildAssignmentCandidates

  // Developer Log: Track assignment
  if (assignedProvider) {
    const isPreferred = assignedProvider === preferredProviderId;
    const isAnyPro = !preferredProviderId;
    // Fetch name for console logging
    let provName = "Unknown";
    let provPhone = "";
    try {
      const pDoc = await ProviderAccount.findById(assignedProvider).select("name phone").lean();
      if (pDoc) {
        provName = pDoc.name;
        provPhone = pDoc.phone || "";
      }
    } catch (e) { }

    let mode = "AUTO-ASSIGNED";
    if (isPreferred) mode = "PREFERRED";
    else if (isAnyPro) mode = "ANY-PROFESSIONAL (Random)";

    console.log(`[Booking] Assignment: ${mode} Provider = ${provName} (${provPhone}) (ID: ${assignedProvider})`);
    logDevAssignment("Booking created with assigned provider", {
      assignedProvider,
      assignmentIndex,
      providerName: provName,
      providerPhone: provPhone,
      mode,
      expiresAt,
      candidateProviders,
    });
  } else {
    console.log(`[Booking] Assignment: Deferred until payment/COD confirmation`);
    logDevAssignment("Booking created without assigned provider", {
      candidateProviders,
      adminEscalated: false,
      vendorEscalated: false,
      slotDate: requestedDate,
      slotTime: requestedTime,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    try {
      const list = await ProviderAccount.find({ _id: { $in: candidateProviders } }).select("name phone").lean();
      const view = (list || []).map((p) => ({ name: p.name || "", phone: p.phone || "" }));
      console.log(`[Booking] Zone free provider candidates (${requestedDate} ${requestedTime}):`, view);
    } catch { }
  }

  const useWallet = !!req.body.useWallet;
  let walletAmountUsed = 0;

  if (useWallet) {
    const userWalletBalance = Number(req.user.wallet?.balance || 0);
    if (userWalletBalance > 0) {
      // We can use up to the final total or the entire balance
      walletAmountUsed = Math.min(userWalletBalance, totals.finalTotal);
    }
  }

  // Calculate remaining advance
  let effectiveAdvance = advanceAmount;
  // For instant bookings, if wallet is used but doesn't cover the full total, 
  // we treat the required upfront as the full total to ensure Razorpay opens and status stays payment_pending.
  if (bookingType === "instant" && walletAmountUsed > 0 && walletAmountUsed < totals.finalTotal) {
    effectiveAdvance = totals.finalTotal;
  }
  const remainingAdvance = Math.max(effectiveAdvance - walletAmountUsed, 0);
  const isFullPayment = (totals.finalTotal <= walletAmountUsed);
  const isScheduledAdvancePaid = (bookingType !== "instant" && remainingAdvance === 0);

  // IMMEDIATELY deduct from wallet ONLY if:
  // 1. It's a full payment (Wallet covers everything)
  // 2. OR it's a scheduled booking and wallet covers the required advance
  if ((isFullPayment || isScheduledAdvancePaid) && walletAmountUsed > 0) {
    const u = await User.findById(req.user._id);
    if (u) {
      if (!u.wallet) u.wallet = { balance: 0, transactions: [] };
      u.wallet.balance = Math.max((u.wallet.balance || 0) - walletAmountUsed, 0);
      u.wallet.transactions.unshift({
        title: "Paid for Booking (Full Wallet)",
        amount: -walletAmountUsed,
        type: "debit",
        balanceAfter: u.wallet.balance,
        description: `Full payment for booking at ${requestedDate} ${requestedTime}`,
        at: new Date()
      });
      await u.save();
      console.log(`[WalletPayment] Full deduction of ₹${walletAmountUsed} from user ${u._id}.`);
    }
  }

  const booking = await Booking.create({
    customerId: req.user._id.toString(),
    customerName: req.user.name || "",
    customerPhone: req.user.phone || "",
    services: items.map(it => ({
      name: it.name, price: it.price, duration: it.duration, category: it.category, serviceType: it.serviceType, image: it.image, quantity: Number(it.quantity) || 1,
    })),
    totalAmount: totals.finalTotal,
    discount: totals.discount,
    discountFundedBy: (coupon?.discountBorneBy || customerSubscription.discountFundedBy || "admin"),
    convenienceFee: customerSubscription.convenienceFee,
    walletAmountUsed,
    prepaidAmount: walletAmountUsed,
    balanceAmount: Math.max(totals.finalTotal - walletAmountUsed, 0),
    paymentStatus: (walletAmountUsed >= totals.finalTotal) ? "Fully Paid" : (walletAmountUsed > 0 ? "Partially Paid" : "Pending"),
    address: safeAddress,
    slot,
    bookingType,
    status: (remainingAdvance > 0) ? "payment_pending" : "pending",
    paymentSources: (walletAmountUsed > 0) ? [{
      source: "wallet",
      amount: walletAmountUsed,
      paidAt: new Date()
    }] : [],
    notificationStatus,
    assignedProvider,
    maintainProvider: preferredProviderId || "",
    otp: (Math.floor(100000 + Math.random() * 900000)).toString(),
    beforeImages: [],
    afterImages: [],
    productImages: [],
    providerImages: [],
    providerFeedback: "",
    candidateProviders,
    rejectedProviders: [],
    assignmentIndex,
    lastAssignedAt,
    expiresAt,
    adminEscalated: false,
  });

  logDevAssignment("Booking persisted", {
    bookingId: booking._id?.toString?.() || "",
    assignedProvider: booking.assignedProvider || "",
    assignmentIndex: booking.assignmentIndex,
    expiresAt: booking.expiresAt || null,
    candidateProviders: booking.candidateProviders || [],
    status: booking.status || "",
  });

  // EXTREME PERSISTENCE LOG
  try {
    const check = await Booking.findById(booking._id);
    const fs = await import("fs");
    const path = await import("path");
    const logPath = path.join(process.cwd(), "booking_creation.log");
    const logMsg = `[${new Date().toISOString()}] CREATED:
      ID: ${booking._id}
      User: ${booking.customerId}
      Phone: ${booking.customerPhone}
      Status: ${booking.status}
      InDB: ${!!check}\n`;
    fs.appendFileSync(logPath, logMsg);
  } catch (err) { }
  let order = null;
  // Use the remainingAdvance already calculated above
  if (remainingAdvance > 0 && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const rzp = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      });
      order = await rzp.orders.create({
        amount: Math.round(remainingAdvance * 100),
        currency: "INR",
        receipt: `swm_${booking._id}`,
        notes: { bookingId: booking._id.toString() },
      });
      // Save order info to booking for later verification if needed
      booking.paymentOrder = {
        id: order.id,
        amount: advanceAmount,
        currency: "INR",
        receipt: order.receipt,
        createdAt: new Date(),
      };
      await booking.save();
    } catch (e) {
      order = null;
    }
  }
  {
    const base = { ...booking.toObject(), id: booking._id.toString() };
    const enriched = (await attachProviderToBookings([{
      ...base,
      items: Array.isArray(base.items) ? base.items : bookingServicesToItems(base.services),
    }]))[0];
    res.status(201).json({
      booking: enriched,
      totals,
      advanceAmount: remainingAdvance,
      order,
    });
  }
  if (notificationStatus === "queued") {
    await BookingLog.create({
      action: "booking:queue",
      userId: req.user._id.toString(),
      bookingId: booking._id.toString(),
      meta: { reason: "outside_office_hours" },
    });
  }
  await BookingLog.create({
    action: "booking:create",
    userId: req.user._id.toString(),
    bookingId: booking._id.toString(),
    meta: {
      totals,
      advanceAmount,
      subscriptionDiscount: customerSubscription.subscriptionDiscount,
      discountFundedBy: customerSubscription.discountFundedBy,
      subscriptionPlanId: customerSubscription.snapshot.planId,
    }
  });
  const bookingId = booking._id.toString();

  if (customerSubscription.subscriptionDiscount > 0) {
    let fundedUserId = "";
    if (customerSubscription.discountFundedBy === "provider" && assignedProvider) {
      fundedUserId = assignedProvider;
    } else if (customerSubscription.discountFundedBy === "vendor") {
      const cityVendor = await Vendor.findOne({
        city: { $regex: new RegExp(`^${safeAddress.city || ""}$`, "i") },
        status: "approved",
      }).lean();
      fundedUserId = cityVendor?._id?.toString?.() || "";
    }
    await createLedgerEntry({
      userId: fundedUserId || "platform",
      userType:
        customerSubscription.discountFundedBy === "provider"
          ? "provider"
          : customerSubscription.discountFundedBy === "vendor"
            ? "vendor"
            : "customer",
      subscriptionId: customerSubscription.snapshot.planId || "",
      planId: customerSubscription.snapshot.planId || "",
      entryType:
        customerSubscription.discountFundedBy === "provider"
          ? "provider_settlement_adjustment"
          : customerSubscription.discountFundedBy === "vendor"
            ? "vendor_billing_adjustment"
            : "discount_adjustment",
      direction: "debit",
      amount: Number(customerSubscription.subscriptionDiscount || 0),
      meta: {
        bookingId,
        fundedBy: customerSubscription.discountFundedBy,
        customerId: req.user._id.toString(),
      },
    });
  }

  // Trigger VoIP Push to iOS providers for background ringing
  try {
    const { sendVoipPush } = await import("../../../lib/push.js");
    const PushDeviceModule = await import("../../../models/PushDevice.js");
    const PushDevice = PushDeviceModule.default;

    // We send VoIP to the candidate providers (or the assigned one)
    const targetProviderIds = assignedProvider ? [assignedProvider] : candidateProviders;

    if (targetProviderIds && targetProviderIds.length > 0) {
      const devices = await PushDevice.find({
        recipientId: { $in: targetProviderIds },
        platform: { $regex: /^ios$/i },
        voipToken: { $exists: true, $ne: "" },
        isActive: true
      }).lean();

      for (const device of devices) {
        await sendVoipPush(device.voipToken, bookingId, req.user.name || "Customer", "provider");
      }
    }
  } catch (err) {
    console.error("[Booking] VoIP Push error:", err);
  }

  // Notifications will be sent after payment verification or COD confirmation.
}


export async function confirmCOD(req, res) {
  const { id } = req.params;
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  if (booking.status !== "payment_pending") {
    return res.json({ success: true, booking });
  }

  // Safety check: calculate if advance was required
  const items = bookingServicesToItems(booking.services);
  const advanceAmount = await computeAdvanceFromCategories(items, booking.bookingType);
  if (advanceAmount > 0) {
    return res.status(400).json({ error: "Advance payment is required for this booking." });
  }

  booking.status = "pending";

  // Assign provider now (deferred assignment model) if still unassigned and candidates exist.
  if (!booking.assignedProvider && Array.isArray(booking.candidateProviders) && booking.candidateProviders.length > 0) {
    const picked = await pickNextProviderForBooking(booking, 0);
    if (picked?.providerId) {
      booking.assignedProvider = picked.providerId;
      booking.assignmentIndex = picked.index;
      booking.lastAssignedAt = new Date();
      booking.expiresAt = computeExpiresAt(booking.lastAssignedAt);
      booking.adminEscalated = false;
      booking.vendorEscalated = false;
      logDevAssignment("COD confirmation assigned provider", {
        bookingId: booking._id?.toString?.() || "",
        assignedProvider: booking.assignedProvider,
        assignmentIndex: booking.assignmentIndex,
        expiresAt: booking.expiresAt,
      });
    }
  }

  // Critical Fix: If a provider was already assigned (during slot choice), 
  // verify they are still approved/active BEFORE confirming and notifying them.
  if (booking.assignedProvider) {
    const { canAssignProviderToBooking } = await import("../../../lib/assignment.js");
    const stillEligible = await canAssignProviderToBooking(booking.assignedProvider, booking);
    if (!stillEligible) {
      console.log(`[ConfirmCOD] Clearing ineligible/blocked provider ${booking.assignedProvider} from booking ${booking._id}`);
      booking.assignedProvider = "";
      booking.assignmentIndex = -1;
      booking.expiresAt = null;
    }
  }

  await booking.save();
  try {
    if (booking.assignedProvider && booking?.slot?.date) {
      await invalidateProviderSlots(booking.assignedProvider, booking.slot.date);
    }
  } catch { }

  try {
    const bookingId = booking._id.toString();
    await notify({
      recipientId: req.user._id.toString(),
      recipientRole: "user",
      type: "booking_created",
      meta: { bookingId },
    });

    // Notify provider and user about assignment
    if (booking.assignedProvider) {
      // Notify provider
      await notify({
        recipientId: booking.assignedProvider,
        recipientRole: "provider",
        type: "booking_assigned",
        meta: { bookingId },
        respectProviderQuietHours: true,
      });

      // NOTE: User notification for 'booking_assigned' is intentionally omitted here 
      // during the initial creation flow to avoid redundancy with 'booking_created'.
      // Assignment notifications to the user will be sent when manually assigned by admin/vendor.
    }
  } catch (err) {
    console.error("[ConfirmCOD] Notification error:", err.message);
  }

  res.json({ success: true, booking });
}

export async function getById(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() }).lean();
  if (!booking) return res.status(404).json({ error: "Not found" });
  const base = {
    ...booking,
    id: booking._id?.toString?.() || booking.id,
    items: Array.isArray(booking.items) ? booking.items : bookingServicesToItems(booking.services),
  };
  const enriched = (await attachProviderToBookings([base]))[0];
  res.json({ booking: enriched });
}

export async function track(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() }).lean();
  if (!booking) return res.status(404).json({ error: "Not found" });

  const lat = booking.address?.lat;
  const lng = booking.address?.lng;
  const userLocation = (typeof lat === "number" && typeof lng === "number") ? { lat, lng } : null;

  let providerLocation = null;
  let providerMeta = null;
  const providerId = String(booking.assignedProvider || "").trim();
  if (providerId) {
    // 1. First, check if the booking has a persisted location for instant rendering
    if (booking.lastProviderLocation?.lat && booking.lastProviderLocation?.lng) {
      providerLocation = {
        lat: booking.lastProviderLocation.lat,
        lng: booking.lastProviderLocation.lng
      };
    }

    // 2. Fetch the latest from ProviderAccount if possible (fallback/latest)
    let provider = null;
    if (mongoose.isValidObjectId(providerId)) {
      provider = await ProviderAccount.findById(providerId).select("name currentLocation").lean();
    } else if (/^\d{10}$/.test(providerId)) {
      provider = await ProviderAccount.findOne({ phone: providerId }).select("name currentLocation").lean();
    }

    if (provider) {
      const plat = provider.currentLocation?.lat;
      const plng = provider.currentLocation?.lng;
      if (typeof plat === "number" && typeof plng === "number") {
        providerLocation = { lat: plat, lng: plng };
      }
      providerMeta = { id: provider._id?.toString?.() || "", name: provider.name || "" };
    }
  }

  res.json({
    bookingId: booking._id?.toString?.() || id,
    status: booking.status, // Added status for real-time polling updates
    userLocation,
    providerLocation,
    providerMeta,
  });
}

export async function createCustomEnquiry(req, res) {
  const { name, phone, eventType, noOfPeople, date, timeSlot, selectedServices, notes, address } = req.body;
  const fallbackAddr = (req.user?.addresses && req.user.addresses[0]) ? req.user.addresses[0] : {};

  const houseNo = (address?.houseNo || fallbackAddr.houseNo || "").trim();
  const area = (address?.area || fallbackAddr.area || "").trim();
  const city = (address?.city || fallbackAddr.city || "").trim();

  if (!houseNo || !area || !city) {
    return res.status(400).json({ error: "Address details (House/Flat No, Area, and City) are mandatory." });
  }
  const items = (selectedServices || []).map((s) => ({
    id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0, image: s.image || "",
  }));
  const peopleCount = Number(noOfPeople);
  const doc = await CustomEnquiry.create({
    userId: req.user._id.toString(),
    name, phone, eventType, noOfPeople,
    peopleCount: Number.isFinite(peopleCount) ? peopleCount : 0,
    scheduledAt: { date, timeSlot },
    items,
    notes: notes || "",
    address: {
      houseNo: address?.houseNo || fallbackAddr.houseNo || "",
      area: address?.area || fallbackAddr.area || "",
      landmark: address?.landmark || fallbackAddr.landmark || "",
      lat: (address?.lat !== undefined && address?.lat !== null && address?.lat !== "") ? Number(address.lat) : null,
      lng: (address?.lng !== undefined && address?.lng !== null && address?.lng !== "") ? Number(address.lng) : null,
      city: address?.city || fallbackAddr.city || "",
    },
    status: "enquiry_created",
    paymentStatus: "pending",
    otp: (Math.floor(100000 + Math.random() * 900000)).toString(),
    timeline: [{ action: "enquiry_created" }],
  });
  try {
    await notify({
      recipientId: req.user._id.toString(),
      recipientRole: "user",
      type: "custom_enquiry_created",
      meta: { enquiryId: doc._id.toString() },
    });
    await notify({
      recipientId: "ADMIN001",
      recipientRole: "admin",
      type: "custom_quote_submitted",
      meta: { enquiryId: doc._id.toString() },
    });
    const city = String(doc.address?.city || doc.address?.area || "").trim();
    let vendorNotified = false;
    if (city && city.toLowerCase() !== "n/a") {
      const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
      if (vendor) {
        await notify({
          recipientId: vendor._id?.toString(),
          recipientRole: "vendor",
          type: "custom_quote_submitted",
          meta: { enquiryId: doc._id.toString(), city },
        });
        vendorNotified = true;
      }
    }
    if (!vendorNotified) {
      await notify({
        recipientId: "GLOBAL_VENDOR_FALLBACK",
        recipientRole: "vendor",
        type: "custom_quote_submitted",
        meta: { enquiryId: doc._id.toString(), city: city || "N/A" },
      });
    }
  } catch { }
  res.status(201).json({ enquiry: doc });
}

export async function listCustomEnquiries(req, res) {
  const items = await CustomEnquiry.find({ userId: req.user._id.toString() }).sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function userAcceptCustomEnquiry(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });
  if (enq.quote?.expiryAt) {
    const exp = new Date(enq.quote.expiryAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      enq.status = "quote_expired";
      enq.timeline.push({ action: "quote_expired", meta: { at: exp.toISOString() } });
      await enq.save();
      return res.status(409).json({ error: "Quote has expired. Please request a new quote.", code: "QUOTE_EXPIRED" });
    }
  }
  const isZeroAdvance = Number(enq.quote?.prebookAmount || 0) === 0;
  if (isZeroAdvance) {
    enq.paymentStatus = "paid";
    enq.prebookAmountPaid = 0;
    enq.prebookPaidAt = new Date();
    enq.status = "advance_paid";
    enq.timeline.push({ action: "advance_paid", meta: { amount: 0 } });
  } else {
    enq.status = "waiting_for_customer_payment";
    enq.timeline.push({ action: "waiting_for_customer_payment" });
  }
  await enq.save();

  if (isZeroAdvance) {
    try {
      // Notify User
      await notify({
        recipientId: enq.userId,
        recipientRole: "user",
        type: "custom_advance_paid",
        meta: { enquiryId: enq._id.toString(), amount: 0 },
      });

      // Notify Admin with ringtone sound
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        type: "custom_advance_paid",
        meta: { enquiryId: enq._id.toString(), amount: 0, sound: "ringtone" },
      });

      // Notify Vendor with ringtone sound
      const city = String(enq.address?.city || enq.address?.area || "").trim();
      let vendorNotified = false;
      if (city && city.toLowerCase() !== "n/a") {
        const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
        if (vendor) {
          await notify({
            recipientId: vendor._id?.toString(),
            recipientRole: "vendor",
            type: "custom_advance_paid",
            meta: { enquiryId: enq._id.toString(), amount: 0, city, sound: "ringtone" },
          });
          vendorNotified = true;
        }
      }
      if (!vendorNotified) {
        await notify({
          recipientId: "GLOBAL_VENDOR_FALLBACK",
          recipientRole: "vendor",
          type: "custom_advance_paid",
          meta: { enquiryId: enq._id.toString(), amount: 0, city: city || "N/A", sound: "ringtone" },
        });
      }
    } catch (err) {
      console.error("[AcceptEnquiry] Notification failed:", err);
    }
  }

  res.json({ enquiry: enq });
}

export async function userMarkCustomAdvancePaid(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });
  if (enq.quote?.expiryAt) {
    const exp = new Date(enq.quote.expiryAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      enq.status = "quote_expired";
      enq.timeline.push({ action: "quote_expired", meta: { at: exp.toISOString() } });
      await enq.save();
      return res.status(409).json({ error: "Quote has expired. Please request a new quote.", code: "QUOTE_EXPIRED" });
    }
  }
  const paid = (typeof req.body.amount !== 'undefined' && !isNaN(Number(req.body.amount))) ? Number(req.body.amount) : Number(enq.quote?.prebookAmount || 0);
  enq.paymentStatus = "paid";
  enq.prebookAmountPaid = paid;
  enq.prebookPaidAt = new Date();
  enq.status = "advance_paid";
  enq.timeline.push({ action: "advance_paid", meta: { amount: paid } });
  await enq.save();

  try {
    // Notify User
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      type: "custom_advance_paid",
      meta: { enquiryId: enq._id.toString(), amount: paid },
    });

    // Notify Admin with ringtone sound
    await notify({
      recipientId: "ADMIN001",
      recipientRole: "admin",
      type: "custom_advance_paid",
      meta: { enquiryId: enq._id.toString(), amount: paid, sound: "ringtone" },
    });

    // Notify Vendor with ringtone sound
    const city = String(enq.address?.city || enq.address?.area || "").trim();
    let vendorNotified = false;
    if (city && city.toLowerCase() !== "n/a") {
      const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
      if (vendor) {
        await notify({
          recipientId: vendor._id?.toString(),
          recipientRole: "vendor",
          type: "custom_advance_paid",
          meta: { enquiryId: enq._id.toString(), amount: paid, city, sound: "ringtone" },
        });
        vendorNotified = true;
      }
    }
    if (!vendorNotified) {
      await notify({
        recipientId: "GLOBAL_VENDOR_FALLBACK",
        recipientRole: "vendor",
        type: "custom_advance_paid",
        meta: { enquiryId: enq._id.toString(), amount: paid, city: city || "N/A", sound: "ringtone" },
      });
    }
  } catch (err) {
    console.error("[MarkAdvancePaid] Notification failed:", err);
  }

  res.json({ enquiry: enq });
}

export async function userRejectCustomEnquiry(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });

  const st = String(enq.status || "").toLowerCase();
  if (["service_completed", "completed"].includes(st)) {
    return res.status(409).json({ error: "Completed enquiries cannot be rejected." });
  }

  enq.status = "rejected";
  enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
  enq.timeline.push({
    action: "rejected",
    meta: { by: "customer", paymentStatus: enq.paymentStatus || "pending" },
  });
  await enq.save();
  res.json({ enquiry: enq });
}

// Admin helpers
export async function adminListCustomEnquiries(_req, res) {
  const items = await CustomEnquiry.find().sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function adminPriceQuote(req, res) {
  const { id } = req.params;
  const { items, totalAmount, discountPrice, notes, prebookAmount, totalServiceTime, quoteExpiryHours, quoteExpiryAt } = req.body;
  const enq = await CustomEnquiry.findById(id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  let expiryAt = null;
  if (quoteExpiryAt) {
    const dt = new Date(quoteExpiryAt);
    expiryAt = Number.isNaN(dt.getTime()) ? null : dt;
  } else if (quoteExpiryHours) {
    const hours = Number(quoteExpiryHours);
    if (Number.isFinite(hours) && hours > 0) {
      expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }
  enq.quote = {
    items: (items || []).map((s) => ({ id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0, image: s.image || "" })),
    totalAmount: Number(totalAmount) || 0,
    discountPrice: Number(discountPrice) || 0,
    notes: notes || "",
    prebookAmount: Number(prebookAmount) || 0,
    totalServiceTime: String(totalServiceTime || ""),
    expiryAt,
  };
  enq.status = "admin_approved";
  enq.timeline.push({ action: "admin_approved", meta: { totalAmount: enq.quote.totalAmount, discountPrice: enq.quote.discountPrice } });
  await enq.save();

  try {
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      type: "custom_quote_submitted",
      meta: { enquiryId: enq._id.toString() },
    });
  } catch (err) {
    console.error("[AdminPriceQuote] Failed to notify user:", err);
  }

  res.json({ enquiry: enq });
}

export async function adminFinalApprove(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findById(id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  const createBookingNow = req.body?.createBooking !== false;
  let booking = null;
  if (createBookingNow) {
    const items = (enq.quote?.items?.length > 0 ? enq.quote.items : (enq.items?.length > 0 ? enq.items : []));
    const total = (enq.quote?.totalAmount || items.reduce((s, it) => s + (Number(it.price) * (it.quantity || 1)), 0));

    console.log(`[ForceCreate] Processing Enquiry: ${enq._id}. Items count: ${items.length}, Total: ${total}`);

    const bookingUser = await User.findById(enq.userId);
    const primaryAddress = (bookingUser?.addresses && bookingUser.addresses[0]) || {};

    try {
      booking = await Booking.create({
        customerId: enq.userId,
        customerName: enq.name || bookingUser?.name || "Customer",
        customerPhone: enq.phone || bookingUser?.phone || "",
        services: items.map(it => ({
          name: it.name,
          price: Number(it.price) || 0,
          duration: "60",
          category: it.category || it.categoryName || "",
          serviceType: it.serviceType || ""
        })),
        totalAmount: total,
        prepaidAmount: Number(enq.quote?.prebookAmount) || 0,
        balanceAmount: total - (Number(enq.quote?.prebookAmount) || 0),
        address: {
          houseNo: enq.address?.houseNo || primaryAddress.houseNo || "",
          area: enq.address?.area || primaryAddress.area || "",
          landmark: enq.address?.landmark || primaryAddress.landmark || "",
          city: enq.address?.city || primaryAddress.city || "",
          cityId: enq.address?.cityId || primaryAddress.cityId || "",
          zone: enq.address?.zone || primaryAddress.zone || "",
          zoneId: enq.address?.zoneId || primaryAddress.zoneId || "",
          lat: (enq.address?.lat !== undefined && enq.address?.lat !== null) ? enq.address.lat : null,
          lng: (enq.address?.lng !== undefined && enq.address?.lng !== null) ? enq.address.lng : null,
        },
        cityId: enq.address?.cityId || primaryAddress.cityId || "",
        zoneId: enq.address?.zoneId || primaryAddress.zoneId || "",
        slot: {
          date: enq.scheduledAt?.date || new Date().toISOString().slice(0, 10),
          time: enq.scheduledAt?.timeSlot || "10:00"
        },
        bookingType: "customized",
        status: "pending",
        otp: enq.otp || (Math.floor(100000 + Math.random() * 900000)).toString(),
        assignedProvider: req.body?.maintainerProvider || enq.maintainerProvider || "",
        maintainProvider: req.body?.maintainerProvider || enq.maintainerProvider || "",
        teamMembers: Array.isArray(req.body?.teamMembers) ? req.body.teamMembers : (Array.isArray(enq.teamMembers) ? enq.teamMembers : []),
      });

      console.log(`[ForceCreate] ✅ Booking Created Successfully: ${booking._id}`);
      enq.bookingId = booking._id.toString();
    } catch (createErr) {
      console.error(`[ForceCreate] ❌ Booking Creation FAILED for Enquiry ${enq._id}:`, createErr.message);
      return res.status(500).json({ error: "Failed to create booking record: " + createErr.message });
    }

    // Create notification for the assigned provider
    if (booking.assignedProvider) {
      try {
        await notify({
          recipientId: booking.assignedProvider,
          recipientRole: "provider",
          type: "booking_assigned",
          meta: { bookingId: booking._id.toString() },
          respectProviderQuietHours: true,
        });
      } catch { }
    } else {
      // If no provider is manually assigned, trigger the automated assignment flow immediately
      try {
        const { findNextCandidate } = await import("../../../lib/assignment.js");
        await findNextCandidate(booking._id.toString());
      } catch (err) {
        console.error("[ForceCreate] Failed to trigger auto-assignment:", err);
      }
    }
  }
  enq.status = "final_approved";
  enq.timeline.push({ action: "final_approved", meta: { bookingId: booking?._id?.toString?.() || "" } });
  await enq.save();
  try {
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      type: "custom_approved",
      meta: { enquiryId: enq._id?.toString?.(), bookingId: booking?._id?.toString?.() || "" },
    });
  } catch { }
  res.json({ enquiry: enq, booking });
}

export async function cancel(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const status = (booking.status || "").toLowerCase();
  const restrictedStatuses = ["arrived", "in_progress", "completed", "cancelled", "rejected"];
  if (restrictedStatuses.includes(status)) {
    return res.status(400).json({
      error: `Cannot cancel booking with current status: ${booking.status}`
    });
  }

  const subscription = await getSubscriptionSnapshot(req.user._id.toString(), "customer");

  // Calculate refund policy
  const refundPolicy = calculateRefundPolicy(booking, "customer", subscription);

  // Ensure advance is non-refundable for pre-bookings ONLY if explicitly required, but current policy is 100% refund
  // const requiredAdvance = await computeAdvanceFromCategories(items, booking.bookingType);
  const refundableBase = booking.prepaidAmount || 0;

  const refundAmount = Math.round(refundableBase * (refundPolicy.refundPercentage / 100));
  const cancellationCharge = (booking.prepaidAmount || 0) - refundAmount;

  console.log(`[Cancel] Booking #${id.slice(-6)}: refundPolicy=${JSON.stringify(refundPolicy)}, refundAmount=₹${refundAmount}, charge=₹${cancellationCharge}`);

  // Update booking status
  const oldStatus = booking.status;
  booking.status = "cancelled";
  booking.cancelledBy = "customer";
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason || "";
  booking.cancellationCharge = cancellationCharge;

  // Process refund if prepaid amount exists
  let refundResult = null;
  if (refundAmount > 0 && booking.prepaidAmount > 0) {
    try {
      const user = await User.findById(req.user._id);
      refundResult = await processSmartRefund({
        booking,
        user,
        refundAmount,
        reason: reason || "booking_cancellation"
      });

      console.log(`[Cancel] Refund processed: status=${refundResult.status}, totalRefunded=₹${refundResult.totalRefunded}`);
    } catch (error) {
      console.error(`[Cancel] Refund processing failed:`, error);
      booking.refundStatus = "failed";
      booking.refunds = [{
        source: "razorpay",
        amount: refundAmount,
        status: "failed",
        error: error.message
      }];
    }
  }

  // Credit provider compensation logic removed as per request

  // Refund commission if it was charged (e.g. manual assignment or accepted booking)
  if (booking.assignedProvider) {
    await refundProviderCommissionIfNeeded(booking, booking.assignedProvider, "customer_cancellation");
  }

  await booking.save();

  await BookingLog.create({
    action: "booking:cancel",
    userId: req.user._id.toString(),
    bookingId: id,
    meta: {
      oldStatus,
      by: "customer",
      refundAmount,
      cancellationCharge,
      refundPolicy: refundPolicy.reason
    }
  });

  // Socket notifications
  try {
    const io = getIO();
    const payload = {
      id: booking._id.toString(),
      status: "cancelled",
      customerName: booking.customerName,
      city: booking.address?.city || ""
    };

    // To Provider
    if (booking.assignedProvider) {
      io?.of("/bookings").emit("status:update", { id: booking._id.toString(), status: "cancelled", providerId: booking.assignedProvider });
    }

    // To Admin and Vendor (City based)
    io?.of("/admin").emit("booking:cancelled", payload);
    io?.of("/vendor").emit("booking:cancelled", payload);

    // Create DB Notifications
    if (booking.assignedProvider) {
      await notify({
        recipientId: booking.assignedProvider,
        recipientRole: "provider",
        type: "booking_cancelled",
        meta: { bookingId: booking._id.toString(), reason: "cancelled by customer" },
        respectProviderQuietHours: true,
      });
    }
    try {
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        type: "booking_cancelled",
        meta: { bookingId: booking._id.toString(), city: booking.address?.city || "", reason: "cancelled by customer" },
      });
      const city = booking.address?.city || "";
      if (city) {
        const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}`, "i") }, status: "approved" }).lean();
        if (vendor) {
          await notify({
            recipientId: vendor._id?.toString(),
            recipientRole: "vendor",
            type: "booking_cancelled",
            meta: { bookingId: booking._id.toString(), city, reason: "cancelled by customer" },
          });
        }
      }
    } catch { }
  } catch (err) {
    console.error("Socket notification failed:", err);
  }

  res.json({
    booking,
    refund: refundResult ? {
      amount: refundAmount,
      status: refundResult.status,
      breakdown: refundResult.refunds
    } : null,
    cancellationCharge,
    message: refundAmount > 0
      ? `Booking cancelled. Refund of ₹${refundAmount} is being processed.`
      : "Booking cancelled successfully."
  });
}

/**
 * Fetches chat history for a specific booking.
 * Verified to ensure requester is either the customer or the assigned provider.
 */
export async function getChatHistory(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid booking ID" });

    const booking = await Booking.findById(id).select("customerId assignedProvider status").lean();
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const userId = req.user._id.toString();
    const isCustomer = booking.customerId === userId;
    const isProvider = booking.assignedProvider === userId;

    if (!isCustomer && !isProvider) {
      return res.status(403).json({ error: "Unauthorized access to chat history" });
    }

    const BookingChat = (await import("../../../models/BookingChat.js")).default;
    const messages = await BookingChat.find({ bookingId: id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ messages });
  } catch (err) {
    console.error("[ChatHistory] Error:", err);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
}

/**
 * Initiates Exotel Call Masking between customer and provider.
 */
export async function callMask(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid booking ID" });

    let booking = await Booking.findById(id).lean();
    if (!booking) {
      booking = await CustomEnquiry.findById(id).lean();
      if (booking) {
        // Map CustomEnquiry fields to Booking fields for consistency
        booking.customerId = booking.userId;
        booking.customerPhone = booking.phone;
      } else {
        return res.status(404).json({ error: "Booking/Enquiry not found" });
      }
    }

    // Extract numbers
    const customerPhone = booking.customerPhone || booking.phone;
    let providerPhone = "";

    if (booking.slot?.provider?.phone) {
      providerPhone = booking.slot.provider.phone;
    } else if (booking.teamMembers?.[0]?.phone) {
      providerPhone = booking.teamMembers[0].phone;
    } else if (booking.assignedProvider || booking.maintainProvider || booking.maintainerProvider) {
      const pId = booking.assignedProvider || booking.maintainProvider || booking.maintainerProvider;
      const providerObj = await ProviderAccount.findById(pId).lean();
      if (providerObj?.phone) {
        providerPhone = providerObj.phone;
      } else if (/^\d{10}$/.test(pId) || /^\+\d+$/.test(pId)) {
        providerPhone = pId;
      }
    }

    if (!customerPhone || !providerPhone) {
      return res.status(400).json({ error: "Customer or Provider phone number not found for this booking" });
    }

    // Determine who is making the call
    const userId = req.user._id.toString();
    const isCustomer = String(booking.customerId || "") === userId;
    
    // Check if the current user is any of the assigned providers (for both normal and custom bookings)
    const providerIds = [
      booking.assignedProvider,
      booking.maintainProvider,
      booking.maintainerProvider,
      ...(booking.teamMembers?.map(m => m.id) || [])
    ].map(id => String(id || ""));
    const isProvider = providerIds.includes(userId);
    
    const isAdmin = req.user.role === 'admin';

    // Security Check: Block unauthorized users
    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ error: "You are not authorized to initiate calls for this booking" });
    }

    let fromNumber = "";
    let toNumber = "";

    if (isCustomer) {
      fromNumber = customerPhone;
      toNumber = providerPhone;
    } else {
      fromNumber = providerPhone;
      toNumber = customerPhone;
    }

    // Helper to format numbers for Exotel (+91prefix for 10-digit Indian numbers)
    const formatExotelPhone = (num) => {
      if (!num) return "";
      let clean = String(num).replace(/\D/g, "");
      if (clean.length === 10) {
        return "+91" + clean;
      }
      if (clean.length === 12 && clean.startsWith("91")) {
        return "+" + clean;
      }
      return num;
    };

    const exotelFrom = formatExotelPhone(fromNumber);
    const exotelTo = formatExotelPhone(toNumber);

    // Import Exotel credentials
    const { EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_EXOPHONE } = await import("../../../config.js");

    if (!EXOTEL_API_KEY || !EXOTEL_API_TOKEN) {
      return res.status(500).json({ error: "Exotel Call Masking is not configured on the server" });
    }

    // Exotel Connect Call API
    const url = `https://api.exotel.com/v1/Accounts/${EXOTEL_ACCOUNT_SID}/Calls/connect.json`;

    // Prepare urlencoded form body
    const details = {
      From: exotelFrom,
      To: exotelTo,
      CallerId: EXOTEL_EXOPHONE,
      CallType: "transact"
    };

    const formBody = Object.keys(details)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(details[key]))
      .join('&');

    const authHeader = 'Basic ' + Buffer.from(EXOTEL_API_KEY + ':' + EXOTEL_API_TOKEN).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: formBody
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Exotel API Error]", data);
      return res.status(response.status).json({ error: data?.RestResponse?.Error?.Message || "Failed to trigger call via Exotel" });
    }

    console.log("[Exotel Call Triggered Successfully]", data?.RestResponse?.Call);
    return res.json({ success: true, message: "Call initiated. Exotel will call you shortly.", callSid: data?.RestResponse?.Call?.Sid });

  } catch (err) {
    console.error("[CallMask] Error:", err);
    return res.status(500).json({ error: "Internal server error triggering call masking" });
  }
}
