import Booking from "../models/Booking.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { DEFAULT_TIME_SLOTS, defaultSlotsMap, isIsoDate } from "./slots.js";
import { isoDateToLocalEnd, isoDateToLocalStart } from "./isoDateTime.js";

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

  // Booking conflict check.
  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    assignedProvider: String(providerId),
    "slot.date": date,
    "slot.time": time,
    status: { $ne: "cancelled" },
  }).lean();
  if (conflict) return false;

  return true;
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

