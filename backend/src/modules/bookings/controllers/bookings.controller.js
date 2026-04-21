import { validationResult } from "express-validator";
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
import { DEFAULT_TIME_SLOTS, slotLabelToLocalDateTime, parseSlotLabelToHM, parseDurationToMinutes } from "../../../lib/slots.js";
import { isIsoDate } from "../../../lib/isoDateTime.js";
import { computeExpiresAt, pickNextProviderForBooking } from "../../../lib/assignment.js";
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

function logDevAssignment(message, payload = {}) {
  if (process.env.NODE_ENV === "production") return;
  try {
    console.log(`[AssignmentFlow] ${message}`, payload);
  } catch {}
}

async function computeAdvanceFromCategories(items = [], bookingType = "instant") {
  // Logic: Instant bookings never require advance payment.
  const bType = String(bookingType || "instant").toLowerCase();
  if (bType === "instant") return 0;

  const catIds = Array.from(new Set(items.map((it) => it.category).filter(Boolean)));
  const cats = await Category.find({ id: { $in: catIds } }).lean();
  const byId = new Map(cats.map((c) => [c.id, c]));
  let sum = 0;
  for (const it of items) {
    const c = byId.get(it.category);
    if (!c) continue;
    const pct = Number(c.advancePercentage || 0);
    const catType = String(c.bookingType || "").toLowerCase();
    // Advance applies if category is scheduled/prebook/customize OR if explicitly requested as scheduled/prebook
    if (pct > 0 && (catType === "scheduled" || catType === "prebooking" || catType === "pre-book" || catType === "customize" || bType === "scheduled" || bType === "pre-book")) {
      sum += Math.ceil((Number(it.price) || 0) * (Number(it.quantity) || 1) * (pct / 100));
    }
  }
  return Math.max(sum, 0);
}
function computeTotals(items = [], coupon) {
  const total = items.reduce((sum, it) => sum + (Number(it.price) * (Number(it.quantity) || 1)), 0);
  let discount = 0;
  if (coupon) {
    if (coupon.type) {
      if (String(coupon.type).toUpperCase() === "FIXED") {
        discount = Number(coupon.value);
      } else {
        discount = Math.round(total * (Number(coupon.value) / 100));
      }
    } else if (coupon.discountType) {
      if (coupon.discountType === "flat") {
        discount = Number(coupon.discountValue);
      } else {
        discount = Math.round(total * (Number(coupon.discountValue) / 100));
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
    quantity: Number(s?.quantity) || 1,
  }));
}

async function loadBookingSettings() {
  const [s, office] = await Promise.all([
    BookingSettings.findOne().lean(),
    OfficeSettings.findOne().lean()
  ]);
  const base = s || {
    minBookingAmount: 500,
    minLeadTimeMinutes: 30,
    providerBufferMinutes: 30,
    serviceStartTime: "08:00",
    serviceEndTime: "19:00",
    slotIntervalMinutes: 30,
    maxBookingDays: 6,
    maxServicesPerBooking: 10,
    providerSearchLimit: 15,
    bookingHoldMinutes: 10,
    maxServiceRadiusKm: 5,
    providerNotificationStartTime: "07:00",
    providerNotificationEndTime: "22:00",
    allowPayAfterService: true,
    prebookingRequired: false,
  };
  if (office?.bufferMinutes !== undefined) {
    base.bufferMinutes = office.bufferMinutes;
  }
  return base;
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
    ? await ProviderAccount.find({ _id: { $in: idIds } }).select("name phone rating profilePhoto experience city").lean()
    : [];
  const provsByPhone = phoneIds.length
    ? await ProviderAccount.find({ phone: { $in: phoneIds } }).select("name phone rating profilePhoto experience city").lean()
    : [];

  const byKey = new Map();
  for (const p of [...(provsById || []), ...(provsByPhone || [])]) {
    byKey.set(p._id.toString(), p);
    if (p.phone) byKey.set(String(p.phone), p);
  }
  return (bookings || []).map((b) => {
    const p = byKey.get(String(b.assignedProvider || ""));
    if (!p) return b;
    const slot = {
      ...(b.slot || {}),
      provider: {
        id: p._id.toString(),
        name: p.name || "",
        rating: p.rating || 0,
        profilePhoto: p.profilePhoto || "",
        experience: p.experience || "",
        city: p.city || "",
      },
    };
    return { ...b, slot };
  });
}

export async function list(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const q = { customerId: req.user._id.toString() };
  const total = await Booking.countDocuments(q);
  const items = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
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
  let coupon = null;
  if (req.body.couponCode) {
    coupon = await Coupon.findOne({ code: req.body.couponCode, isActive: true }).lean();
  }
  const totals = computeTotals(req.body.items, coupon);
  const subBenefits = await calculateCustomerSubscriptionBenefits({
    userId: req.user._id.toString(),
    total: totals.total,
    subtotalAfterCoupon: totals.finalTotal,
  });
  totals.discount += subBenefits.subscriptionDiscount;
  totals.finalTotal = Math.max(totals.total - totals.discount, 0);
  const advanceAmount = await computeAdvanceFromCategories(req.body.items || [], req.body.bookingType);
  res.json({
    ...totals,
    couponApplied: coupon ? coupon.code : null,
    advanceAmount,
    subscription: subBenefits.snapshot,
    subscriptionDiscount: subBenefits.subscriptionDiscount,
    discountFundedBy: subBenefits.discountFundedBy,
  });
}

export async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { items, slot, address, bookingType, couponCode, allowAutoFallback } = req.body;
  const fallbackAddr = (req.user?.addresses && req.user.addresses[0]) ? req.user.addresses[0] : {};
  // Persist booking city for analytics + filtering. Back-compat: if city not provided, fall back to area.
  const safeAddress = {
    houseNo: address?.houseNo || fallbackAddr.houseNo || "",
    area: address?.area || fallbackAddr.area || "",
    landmark: address?.landmark || fallbackAddr.landmark || "",
    city: address?.city || address?.area || fallbackAddr.city || fallbackAddr.area || "",
    cityId: address?.cityId || fallbackAddr.cityId || "",
    zone: address?.zone || fallbackAddr.zone || address?.area || fallbackAddr.area || "",
    zoneId: address?.zoneId || fallbackAddr.zoneId || "",
    lat: address?.lat ?? fallbackAddr.lat ?? null,
    lng: address?.lng ?? fallbackAddr.lng ?? null,
  };
  const preferredProviderId = String(req.body.preferredProviderId || "").trim();
  let coupon = null;
  if (couponCode) coupon = await Coupon.findOne({ code: couponCode, isActive: true }).lean();
  const totals = computeTotals(items, coupon);
  const customerSubscription = await calculateCustomerSubscriptionBenefits({
    userId: req.user._id.toString(),
    total: totals.total,
    subtotalAfterCoupon: totals.finalTotal,
  });
  const advanceAmount = await computeAdvanceFromCategories(items, bookingType);
  totals.discount += customerSubscription.subscriptionDiscount;
  totals.finalTotal = Math.max(totals.total - totals.discount, 0);

  const settings = await loadBookingSettings();
  if (settings?.minBookingAmount && totals.finalTotal < Number(settings.minBookingAmount)) {
    return res.status(400).json({ error: `Minimum booking amount is INR ${settings.minBookingAmount}.` });
  }
  if (settings?.maxServicesPerBooking && Array.isArray(items) && items.length > Number(settings.maxServicesPerBooking)) {
    return res.status(400).json({ error: `Maximum ${settings.maxServicesPerBooking} services allowed per booking.` });
  }
  const office = await OfficeSettings.findOne().lean();
  const now = new Date();
  const [startH, startM] = (office?.startTime || "09:00").split(":").map(Number);
  const [endH, endM] = (office?.endTime || "21:00").split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const withinOffice = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  let notificationStatus = withinOffice ? "immediate" : "queued";
  
  // Admin toggle check: If autoAssign is false in OfficeSettings, global auto-assign is disabled
  const autoAssignAllowed = office?.autoAssign !== false;
  
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
    if (effectiveLeadMs > 0 && slotStart.getTime() < (now.getTime() + effectiveLeadMs)) {
      return res.status(400).json({ error: "Selected slot violates minimum lead time." });
    }
    const maxDays = Math.max(Number(settings?.maxBookingDays || 0), 0);
    if (maxDays > 0) {
      const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
      if (slotStart.getTime() > maxDate.getTime()) {
        return res.status(400).json({ error: "Selected slot exceeds maximum advance booking days." });
      }
    }
    const windowStartMin = parseHHMMToMinutes(settings?.serviceStartTime || "");
    const windowEndMin = parseHHMMToMinutes(settings?.serviceEndTime || "");
    const hm = parseSlotLabelToHM(requestedTime);
    if (windowStartMin !== null && windowEndMin !== null && hm) {
      const slotMin = hm.hour * 60 + hm.minute;
      if (slotMin < windowStartMin || slotMin > windowEndMin) {
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

  let assignedProvider = "";
  let assignmentIndex = -1;
  let lastAssignedAt = null;
  let expiresAt = null;
  if (autoAssignAllowed && candidateProviders.length > 0) {
    const picked = await pickNextProviderForBooking(
      { candidateProviders, rejectedProviders: [], slot, _id: null },
      0
    );
    if (picked?.providerId) {
      assignedProvider = picked.providerId;
      assignmentIndex = picked.index;
      lastAssignedAt = new Date();
      expiresAt = computeExpiresAt(lastAssignedAt);
      logDevAssignment("Initial auto assignment selected provider", {
        bookingTempId: "pending-create",
        assignedProvider,
        assignmentIndex,
        expiresAt,
        candidateProviders,
      });
    }
  }

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
    } catch (e) {}
    
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
    console.log(`[Booking] Assignment: NO Provider assigned (pending auto-assign pool)`);
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
    } catch {}
  }

  const booking = await Booking.create({
    customerId: req.user._id.toString(),
    customerName: req.user.name || "",
    customerPhone: req.user.phone || "",
    services: items.map(it => ({
      name: it.name, price: it.price, duration: it.duration, category: it.category, serviceType: it.serviceType, quantity: Number(it.quantity) || 1,
    })),
    totalAmount: totals.finalTotal,
    discount: totals.discount,
    convenienceFee: customerSubscription.convenienceFee,
    prepaidAmount: 0,
    balanceAmount: totals.finalTotal,
    paymentStatus: "Pending",
    address: safeAddress,
    slot,
    bookingType,
    status: "payment_pending",
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
    adminEscalated: !assignedProvider,
  });

  logDevAssignment("Booking persisted", {
    bookingId: booking._id?.toString?.() || "",
    assignedProvider: booking.assignedProvider || "",
    assignmentIndex: booking.assignmentIndex,
    expiresAt: booking.expiresAt || null,
    candidateProviders: booking.candidateProviders || [],
    status: booking.status || "",
  });
  try {
    if (assignedProvider && booking?.slot?.date) {
      await invalidateProviderSlots(assignedProvider, booking.slot.date);
    }
  } catch {}
  let order = null;
  if (advanceAmount > 0 && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const rzp = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      });
      order = await rzp.orders.create({
        amount: Math.round(advanceAmount * 100),
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
      advanceAmount,
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
    const bookingId = booking._id.toString();
    await notify({
      recipientId: req.user._id.toString(),
      recipientRole: "user",
      type: "booking_created",
      meta: { bookingId },
    });

    if (booking.assignedProvider) {
      await notify({
        recipientId: booking.assignedProvider,
        recipientRole: "provider",
        type: "booking_assigned",
        meta: { bookingId },
        respectProviderQuietHours: true,
      });
      await notify({
        recipientId: req.user._id.toString(),
        recipientRole: "user",
        type: "booking_assigned",
        meta: { bookingId },
      });
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
  const items = (selectedServices || []).map((s) => ({
    id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0,
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
      lat: address?.lat ?? fallbackAddr.lat ?? null,
      lng: address?.lng ?? fallbackAddr.lng ?? null,
      city: address?.city || fallbackAddr.city || "",
    },
    status: "enquiry_created",
    paymentStatus: "pending",
    timeline: [{ action: "enquiry_created" }],
  });
  try {
    await notify({
      recipientId: "ADMIN001",
      recipientRole: "admin",
      type: "custom_quote_submitted",
      meta: { enquiryId: doc._id.toString() },
    });
    const city = doc.address?.city || doc.address?.area || "";
    if (city) {
      const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
      if (vendor) {
        await notify({
          recipientId: vendor._id?.toString(),
          recipientRole: "vendor",
          type: "custom_quote_submitted",
          meta: { enquiryId: doc._id.toString(), city },
        });
      }
    }
  } catch {}
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
  enq.status = "waiting_for_customer_payment";
  enq.timeline.push({ action: "waiting_for_customer_payment" });
  await enq.save();
  res.json({ enquiry: enq });
}

export async function userMarkCustomAdvancePaid(req, res) {
  const { id } = req.params;
  const amount = Number(req.body.amount || 0);
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
  const paid = amount > 0 ? amount : Number(enq.quote?.prebookAmount || 0);
  enq.paymentStatus = "paid";
  enq.prebookAmountPaid = paid;
  enq.prebookPaidAt = new Date();
  enq.status = "advance_paid";
  enq.timeline.push({ action: "advance_paid", meta: { amount: paid } });
  await enq.save();
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
    items: (items || []).map((s) => ({ id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0 })),
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
  res.json({ enquiry: enq });
}

export async function adminFinalApprove(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findById(id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  const createBookingNow = req.body?.createBooking !== false;
  let booking = null;
  if (createBookingNow) {
    // Convert to a normal booking with quoted items
    const items = (enq.quote?.items || enq.items || []);
    const total = (enq.quote?.totalAmount ?? items.reduce((s, it) => s + (Number(it.price) * (it.quantity || 1)), 0));
    booking = await Booking.create({
      customerId: enq.userId,
      customerName: enq.name || "",
      services: items.map(it => ({ name: it.name, price: it.price, duration: "", category: it.category, serviceType: it.serviceType })),
      totalAmount: total,
      prepaidAmount: 0,
      balanceAmount: total,
      address: {
        houseNo: enq.address?.houseNo || "",
        area: enq.address?.area || "",
        landmark: enq.address?.landmark || "",
        city: enq.address?.city || enq.address?.area || "",
        lat: enq.address?.lat ?? null,
        lng: enq.address?.lng ?? null,
      },
      slot: { date: enq.scheduledAt?.date || new Date().toISOString().slice(0, 10), time: enq.scheduledAt?.timeSlot || "10:00" },
      bookingType: "customized",
      status: "final_approved",
      assignedProvider: req.body?.maintainerProvider || enq.maintainerProvider || "",
      maintainProvider: req.body?.maintainerProvider || enq.maintainerProvider || "",
      teamMembers: Array.isArray(req.body?.teamMembers) ? req.body.teamMembers : (Array.isArray(enq.teamMembers) ? enq.teamMembers : []),
    });
    enq.bookingId = booking._id.toString();

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
      } catch {}
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
  } catch {}
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
  const refundAmount = Math.round((booking.prepaidAmount || 0) * (refundPolicy.refundPercentage / 100));
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
    } catch {}
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
