import Booking from "../models/Booking.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { computeAvailableSlots } from "./availability.js";
import { DEFAULT_TIME_SLOTS, isIsoDate, parseDurationToMinutes, slotLabelToLocalDateTime } from "./slots.js";
import { resolveBookingSettings } from "./settings.js";
import { isoDateToLocalEnd, isoDateToLocalStart } from "./isoDateTime.js";
import { notify, notifyMany } from "./notify.js";
import { processSmartRefund } from "./refund.service.js";
import { getIO } from "../startup/socket.js";

export function getAcceptWindowMs() {
  const mins = Number(process.env.BOOKING_ACCEPT_WINDOW_MINUTES);
  if (Number.isFinite(mins) && mins > 0) return Math.round(mins * 60 * 1000);
  return 10 * 60 * 1000;
}

export function computeExpiresAt(now = new Date()) {
  return new Date(now.getTime() + getAcceptWindowMs());
}

async function isProviderEligibleForBooking(providerId, booking, opts = {}) {
  const acc = await ProviderAccount.findById(providerId).lean();
  if (!acc) return false;
  if (acc.approvalStatus !== "approved") return false;
  // Relaxed for local testing: allow providers who haven't 100% finished registration docs
  // if (acc.registrationComplete !== true) return false;
  // Relaxed: Don't strictly require isOnline for eligibility, 
  // as providers may be available for future slots even if offline now.
  // if (acc.isOnline !== true) return false;

  const date = String(booking?.slot?.date || "").trim();
  const time = String(booking?.slot?.time || "").trim();
  const knownDate = isIsoDate(date);
  const knownSlot = DEFAULT_TIME_SLOTS.includes(time);
  if (!knownDate || !knownSlot) return true;

  // Leave check (approved leave blocks whole day).
  const dayStart = isoDateToLocalStart(date);
  const dayEnd = isoDateToLocalEnd(date);
  if (dayStart && dayEnd) {
    const leave = await LeaveRequest.findOne({
      providerId,
      status: "approved",
      $or: [
        { endAt: { $ne: null, $gte: dayStart }, startAt: { $lte: dayEnd } },
        { endAt: null, startAt: { $gte: dayStart, $lte: dayEnd } },
      ],
    }).lean();
    if (leave) return false;
  }

  const requestedDurationMinutes = getBookingRequestedDurationMinutes(booking);
  const settings = await loadAssignmentSettings();
  const avail = await computeAvailableSlots(providerId, date, settings, {
    requestedDurationMinutes,
    useCache: false,
    excludeBookingId: booking._id ? String(booking._id) : null,
    ignoreLeadTime: opts.ignoreLeadTime === true,
    ignoreServiceWindow: opts.ignoreServiceWindow === true,
  });
  const res = avail?.slotMap?.[time] === true;
  if (!res) {
    console.log(`[Assignment Debug] Provider ${providerId} is NOT eligible for booking at ${time}. Reason: slot_busy or window_mismatch. Available slots:`, avail?.slots);
  }

  return res;
}

async function loadAssignmentSettings() {
  return resolveBookingSettings();
}

export function getBookingRequestedDurationMinutes(booking) {
  const services = Array.isArray(booking?.services)
    ? booking.services
    : Array.isArray(booking?.items)
      ? booking.items
      : [];
  return services.reduce((sum, it) => {
    const per = parseDurationToMinutes(it?.duration, 60);
    const qty = Number(it?.quantity || 1);
    return sum + (per * (Number.isFinite(qty) ? qty : 1));
  }, 0);
}

export async function canAssignProviderToBooking(providerId, booking, opts = {}) {
  if (!providerId || !booking) return false;
  const overrideSlot = opts.slot || booking.slot || {};
  // Extract _id before spread — Mongoose doc getters are lost during { ...doc }
  const bookingId = booking._id || booking.id;
  const bookingForCheck = {
    ...(booking.toObject ? booking.toObject() : booking),
    _id: bookingId,
    slot: overrideSlot,
    services: Array.isArray(booking.services) ? booking.services : booking.items,
  };
  console.log(`[Assignment Debug] canAssignProviderToBooking: providerId=${providerId}, bookingId=${bookingId}, slot=${overrideSlot?.date} ${overrideSlot?.time}, ignoreLeadTime=${opts.ignoreLeadTime}`);
  return isProviderEligibleForBooking(providerId, bookingForCheck, opts);
}

export async function pickNextProviderForBooking(booking, startIndex = 0) {
  const candidates = Array.isArray(booking?.candidateProviders) ? booking.candidateProviders : [];
  console.log(`[Assignment] pickNextProviderForBooking called for booking ${booking._id}, Candidate Array Length: ${candidates.length}, StartIdx: ${startIndex}`);
  if (!candidates.length) {
    console.log(`[Assignment] Returning null early because candidates array is empty.`);
    return null;
  }

  const rejected = new Set(Array.isArray(booking?.rejectedProviders) ? booking.rejectedProviders : []);
  console.log(`[DEBUG_ASSIGN] Booking: ${booking._id}, Rejected Count: ${rejected.size}`);

  // User requested Max 5 providers limit (Now 1)
  if (rejected.size >= 1) {
    console.log(`[DEBUG_ASSIGN] Reached limit (1). Returning NULL to escalate.`);
    return null;
  }
  let idx = Math.max(Number(startIndex) || 0, 0);
  console.log(`[DEBUG_ASSIGN] Attempting to find next candidate from Index: ${idx}`);

  while (idx < candidates.length) {
    const cand = String(candidates[idx] || "");
    if (!cand) {
      console.log(`[Assignment] Skipping cand at idx ${idx}: invalid ID`);
      idx++;
      continue;
    }
    if (rejected.has(cand)) {
      console.log(`[Assignment] Skipping cand ${cand} at idx ${idx}: already rejected`);
      idx++;
      continue;
    }

    console.log(`[Assignment] Checking eligibility for cand ${cand} at idx ${idx}...`);
    // eslint-disable-next-line no-await-in-loop
    const ok = await isProviderEligibleForBooking(cand, booking, { ignoreLeadTime: true });

    console.log(`[Assignment] Eligibility for cand ${cand} returned: ${ok}`);
    if (ok) return { providerId: cand, index: idx };
    idx++;
  }
  console.log(`[Assignment] Exhausted all candidates, returning null.`);
  return null;
}

/**
 * Higher-level wrapper to find next candidate and actually update/notify them.
 * Used for custom bookings "Force Create" and auto-reassignment scenarios.
 */
export async function findNextCandidate(bookingId) {
  const Booking = (await import("../models/Booking.js")).default;
  const { buildAssignmentCandidates } = await import("./assignmentCandidates.js");
  const { resolveBookingSettings } = await import("./settings.js");

  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  // Build candidates if missing or empty
  if (!booking.candidateProviders || booking.candidateProviders.length === 0) {
    console.log(`[Assignment] Building candidates for booking ${bookingId}...`);
    const settings = await resolveBookingSettings();
    const { candidateProviders } = await buildAssignmentCandidates({
      address: booking.address,
      slot: booking.slot,
      items: booking.services || booking.items || [],
      settings,
      customerId: booking.customerId?.toString(),
      useCache: false,
      ignoreLeadTime: true // ✅ Force Create should ignore lead time
    });
    booking.candidateProviders = candidateProviders;
    await booking.save();
    console.log(`[Assignment] Found ${candidateProviders.length} candidates for booking ${bookingId}: ${candidateProviders.join(', ')}`);
  }

  const now = new Date();
  const picked = await pickNextProviderForBooking(booking, 0);

  if (picked?.providerId) {
    booking.assignedProvider = picked.providerId;
    booking.assignmentIndex = picked.index;
    booking.status = "pending";
    booking.lastAssignedAt = now;
    booking.expiresAt = computeExpiresAt(now);
    booking.adminEscalated = false;

    await booking.save();

    try {
      const io = getIO();
      io?.of("/bookings").emit("status:update", { id: booking._id.toString(), status: "pending" });
      io?.of("/bookings").to(booking._id.toString()).emit("booking:update", { id: booking._id.toString() });
    } catch (err) { }

    try {
      await notify({
        recipientId: picked.providerId,
        recipientRole: "provider",
        type: "booking_assigned",
        meta: { bookingId: booking._id.toString() },
        respectProviderQuietHours: true,
      });
    } catch (err) { }

    return picked.providerId;
  } else {
    // No providers found? Escalate to admin/vendor
    console.log(`[Assignment] No candidates found for booking ${bookingId}. Escalating.`);
    const { handleExhaustedAssignmentChain } = await import("./assignment.js");
    await handleExhaustedAssignmentChain({
      booking,
      now,
      escalationReason: "no candidates found on initial search",
    });
    await booking.save();
    return null;
  }
}

const EXHAUSTED_CHAIN_VENDOR_WINDOW_MS = 15 * 60 * 1000;

function getBookingCityInfo(booking) {
  return {
    city: String(booking?.address?.city || "").trim(),
    cityId: String(booking?.address?.cityId || "").trim(),
  };
}

async function findApprovedVendorForBooking(booking) {
  const { city, cityId } = getBookingCityInfo(booking);
  if (cityId) {
    const exact = await Vendor.findOne({ cityId, status: "approved" }).lean();
    if (exact) return exact;
  }
  if (!city) return null;
  return Vendor.findOne({
    city: { $regex: new RegExp(`^${String(city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    status: "approved",
  }).lean();
}

export function getExhaustedAssignmentDisposition(booking, now = new Date()) {
  const slotStart = slotLabelToLocalDateTime(booking?.slot?.date, booking?.slot?.time);
  if (!slotStart) {
    return { kind: "vendor_escalation", slotStart: null, remainingMs: null };
  }
  const effectiveNow = new Date(now);
  effectiveNow.setSeconds(0, 0);
  const remainingMs = slotStart.getTime() - effectiveNow.getTime();
  return {
    kind: remainingMs >= EXHAUSTED_CHAIN_VENDOR_WINDOW_MS ? "vendor_escalation" : "auto_cancel",
    slotStart,
    remainingMs,
  };
}

async function refundProviderCommissionIfNeeded(booking, providerId, reason = "system_auto_cancel") {
  if (!providerId || !booking?.commissionChargedAt || booking?.commissionRefundedAt || Number(booking?.commissionAmount || 0) <= 0) {
    return false;
  }
  const acc = await ProviderAccount.findById(providerId);
  if (!acc) return false;
  acc.credits = Number(acc.credits || 0) + Number(booking.commissionAmount || 0);
  await acc.save();
  booking.commissionRefundedAt = new Date();
  await ProviderWalletTxn.create({
    providerId,
    bookingId: booking._id.toString(),
    type: "commission_refund",
    amount: Number(booking.commissionAmount || 0),
    balanceAfter: acc.credits,
    meta: { reason },
  });
  try {
    await notify({
      recipientId: providerId,
      recipientRole: "provider",
      type: "commission_refund",
      meta: { bookingId: booking._id.toString(), amount: Number(booking.commissionAmount || 0) },
      respectProviderQuietHours: true,
    });
  } catch { }
  return true;
}

async function processFullUserRefundIfNeeded(booking, reason = "system_auto_cancel_no_provider") {
  const refundAmount = Math.round(Number(booking?.prepaidAmount || 0));
  if (refundAmount <= 0) return null;
  const user = await User.findById(booking?.customerId);
  if (!user) {
    booking.refundStatus = "failed";
    booking.refunds = [{
      source: "unknown",
      amount: refundAmount,
      status: "failed",
      error: "Customer not found for refund",
    }];
    return null;
  }
  try {
    return await processSmartRefund({
      booking,
      user,
      refundAmount,
      reason,
    });
  } catch (error) {
    booking.refundStatus = "failed";
    booking.refunds = [{
      source: "razorpay",
      amount: refundAmount,
      status: "failed",
      error: error.message,
    }];
    return null;
  }
}

function emitExhaustedAssignmentEvents({ bookingId, fromProvider = "", kind }) {
  try {
    const io = getIO();
    io?.of("/bookings").emit("assignment:changed", {
      id: bookingId,
      fromProvider,
      toProvider: "",
      reason: kind === "auto_cancel" ? "candidate_exhausted_cancelled" : "candidate_exhausted_vendor",
    });
    io?.of("/bookings").emit("status:update", {
      id: bookingId,
      status: kind === "auto_cancel" ? "cancelled" : "pending",
    });
  } catch { }
}

export async function handleExhaustedAssignmentChain({
  booking,
  now = new Date(),
  fromProvider = "",
  escalationReason = "manual assignment needed",
  cancellationReason = "No provider accepted before service window",
} = {}) {
  if (!booking) throw new Error("Booking is required");

  const disposition = getExhaustedAssignmentDisposition(booking, now);
  const { city } = getBookingCityInfo(booking);
  const previousProvider = String(fromProvider || booking?.assignedProvider || "").trim();

  if (disposition.kind === "vendor_escalation") {
    const vendor = await findApprovedVendorForBooking(booking);
    booking.assignedProvider = "";
    booking.vendorEscalated = Boolean(vendor);
    booking.vendorEscalatedAt = now;
    booking.adminEscalated = !vendor;
    booking.status = "pending";
    booking.expiresAt = null;
    await booking.save();

    emitExhaustedAssignmentEvents({
      bookingId: booking._id.toString(),
      fromProvider: previousProvider,
      kind: "vendor_escalation",
    });

    try {
      const searchCity = city.trim();
      console.log(`[Escalation] Searching for vendors in city: "${searchCity}"`);
      
      const vendors = await Vendor.find({
        city: new RegExp(searchCity, "i"),
        status: "approved"
      }).lean();

      console.log(`[Escalation] Found ${vendors.length} approved vendors.`);

      if (vendors.length > 0 || vendor) {
        const vendorIds = Array.from(new Set([
          ...vendors.map(v => v._id.toString()),
          ...(vendor ? [vendor._id.toString()] : [])
        ])).filter(Boolean);
        
        console.log(`[Escalation] 🔔 NOTIFYING VENDORS: Role=vendor, IDs=[${vendorIds.join(", ")}], Type=NEW_ORDER`);
        
        await notifyMany(vendorIds, {
          recipientRole: "vendor",
          type: "NEW_ORDER",
          meta: { bookingId: booking._id.toString(), city, reason: escalationReason },
        });
      } else {
        console.warn(`[Escalation] ❌ NO APPROVED VENDORS FOUND for city: "${city}". FORCING GLOBAL BROADCAST. Role=vendor`);
        // Fail-safe: Broadcast to ALL vendors if city-specific ones are missing
        await notify({
          recipientId: "GLOBAL_VENDOR_FALLBACK",
          recipientRole: "vendor",
          type: "NEW_ORDER",
          meta: { bookingId: booking._id.toString(), city, reason: "fallback_broadcast" },
        });
      }
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        type: "booking_escalated",
        meta: {
          bookingId: booking._id.toString(),
          city,
          vendorId: vendor?._id?.toString?.() || "",
          reason: vendor ? "escalated to vendor" : "no vendor found",
        },
      });
    } catch (err) {
      console.error("[Escalation] ❌ Notification chain failed:", err.message);
    }

    return {
      kind: "vendor_escalation",
      vendorId: vendor?._id?.toString?.() || "",
      city,
      remainingMs: disposition.remainingMs,
      slotStart: disposition.slotStart,
    };
  }

  booking.status = "cancelled";
  booking.cancelledBy = "system";
  booking.cancelledAt = now;
  booking.cancellationReason = cancellationReason;
  booking.assignedProvider = "";
  booking.expiresAt = null;
  booking.vendorEscalated = false;
  booking.vendorEscalatedAt = null;
  booking.adminEscalated = false;

  await refundProviderCommissionIfNeeded(booking, previousProvider, "system_auto_cancel_no_provider");
  await processFullUserRefundIfNeeded(booking, "system_auto_cancel_no_provider");
  await booking.save();

  emitExhaustedAssignmentEvents({
    bookingId: booking._id.toString(),
    fromProvider: previousProvider,
    kind: "auto_cancel",
  });

  const vendor = await findApprovedVendorForBooking(booking);
  try {
    if (booking.customerId) {
      await notify({
        recipientId: booking.customerId,
        recipientRole: "user",
        type: "booking_cancelled",
        meta: { bookingId: booking._id.toString(), reason: "no provider accepted before service window" },
      });
    }
    if (vendor) {
      await notify({
        recipientId: vendor._id?.toString(),
        recipientRole: "vendor",
        type: "booking_cancelled",
        meta: { bookingId: booking._id.toString(), city, reason: "no provider accepted before service window" },
      });
    }
    await notify({
      recipientId: "ADMIN001",
      recipientRole: "admin",
      type: "booking_cancelled",
      meta: { bookingId: booking._id.toString(), city, reason: "no provider accepted before service window" },
    });
  } catch (err) {
    console.error("[AutoCancel] ❌ Notification chain failed:", err.message);
  }

  return {
    kind: "auto_cancel",
    vendorId: vendor?._id?.toString?.() || "",
    city,
    remainingMs: disposition.remainingMs,
    slotStart: disposition.slotStart,
  };
}

