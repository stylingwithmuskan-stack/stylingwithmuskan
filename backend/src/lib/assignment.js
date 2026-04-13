import Booking from "../models/Booking.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { computeAvailableSlots } from "./availability.js";
import { DEFAULT_TIME_SLOTS, defaultSlotsMap, isIsoDate, parseDurationToMinutes, slotLabelToLocalDateTime } from "./slots.js";
import { isoDateToLocalEnd, isoDateToLocalStart } from "./isoDateTime.js";
import { notify } from "./notify.js";
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

async function isProviderEligibleForBooking(providerId, booking) {
  const acc = await ProviderAccount.findById(providerId).lean();
  if (!acc) return false;
  if (acc.approvalStatus !== "approved") return false;
  if (acc.registrationComplete !== true) return false;
  if (acc.isOnline !== true) return false;

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

  // Slot availability: provider's custom availability OR default schedule (9 AM - 5 PM).
  const availDoc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
  if (Array.isArray(availDoc?.availableSlots) && availDoc.availableSlots.length > 0) {
    if (!availDoc.availableSlots.includes(time)) return false;
  } else {
    const base = defaultSlotsMap();
    if (base[time] !== true) return false;
  }

  const requestedDurationMinutes = getBookingRequestedDurationMinutes(booking);
  const settings = await loadAssignmentSettings();
  const avail = await computeAvailableSlots(providerId, date, settings, {
    requestedDurationMinutes,
    useCache: false,
  });
  if (avail?.slotMap?.[time] !== true) return false;

  return true;
}

async function loadAssignmentSettings() {
  const [bookingSettings, officeSettings] = await Promise.all([
    BookingSettings.findOne().lean(),
    OfficeSettings.findOne().lean(),
  ]);
  return { ...(bookingSettings || {}), ...(officeSettings || {}) };
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
  const bookingForCheck = {
    ...booking,
    slot: overrideSlot,
    services: Array.isArray(booking.services) ? booking.services : booking.items,
  };
  return isProviderEligibleForBooking(providerId, bookingForCheck);
}

export async function pickNextProviderForBooking(booking, startIndex = 0) {
  const candidates = Array.isArray(booking?.candidateProviders) ? booking.candidateProviders : [];
  if (!candidates.length) return null;

  const rejected = new Set(Array.isArray(booking?.rejectedProviders) ? booking.rejectedProviders : []);
  let idx = Math.max(Number(startIndex) || 0, 0);
  while (idx < candidates.length) {
    const cand = String(candidates[idx] || "");
    if (!cand) { idx++; continue; }
    if (rejected.has(cand)) { idx++; continue; }
    // Only assign if the provider is still eligible at the time of reassignment.
    // This prevents assignment to offline/leave/conflicting providers.
    // Note: candidate list already filtered for specialty at creation time.
    // eslint-disable-next-line no-await-in-loop
    const ok = await isProviderEligibleForBooking(cand, booking);
    if (ok) return { providerId: cand, index: idx };
    idx++;
  }
  return null;
}

const EXHAUSTED_CHAIN_VENDOR_WINDOW_MS = 60 * 60 * 1000;

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
  } catch {}
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
  } catch {}
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
      if (vendor) {
        await notify({
          recipientId: vendor._id?.toString(),
          recipientRole: "vendor",
          type: "booking_escalated",
          meta: { bookingId: booking._id.toString(), city, reason: escalationReason },
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
    } catch {}

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
  } catch {}

  return {
    kind: "auto_cancel",
    vendorId: vendor?._id?.toString?.() || "",
    city,
    remainingMs: disposition.remainingMs,
    slotStart: disposition.slotStart,
  };
}

