import Booking from "../models/Booking.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import LeaveRequest from "../models/LeaveRequest.js";
import mongoose from "mongoose";
import { redis } from "../startup/redis.js";
import { DEFAULT_TIME_SLOTS, defaultSlotsMap, slotLabelToLocalDateTime, parseSlotLabelToHM, parseDurationToMinutes, isTimeInWindow } from "./slots.js";
import { isoDateToLocalEnd, isoDateToLocalStart, toIsoDateFromAny, getIndiaDate } from "./isoDateTime.js";

async function getVersion(providerId, date) {
  try {
    const v = await redis.get(`slots:ver:${providerId}:${date}`);
    return v || "0";
  } catch {
    return "0";
  }
}

async function cacheKey(providerId, date, settings, requestedDurationMinutes) {
  const settingsKey = settings?.updatedAt ? new Date(settings.updatedAt).getTime() : 0;
  const ver = await getVersion(providerId, date);
  const durKey = Math.max(Number(requestedDurationMinutes || 0), 0);
  return `slots:${providerId}:${date}:${ver}:${settingsKey}:${durKey}`;
}

export async function invalidateProviderSlots(providerId, dates = []) {
  const list = Array.isArray(dates) ? dates : [dates];
  for (const d of list) {
    if (!d) continue;
    try {
      await redis.incr(`slots:ver:${providerId}:${d}`);
    } catch {}
  }
}

export async function invalidateProviderSlotsForNextDays(providerId, days = 30, fromDate = new Date()) {
  const safeDays = Math.max(Number(days || 0), 0);
  if (!providerId || safeDays <= 0) return;
  const dates = [];
  const base = new Date(fromDate);
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  await invalidateProviderSlots(providerId, dates);
}

export async function computeAvailableSlots(providerId, date, settings, opts = {}) {
  const useCache = false; // Temporarily disabled for live debugging
  const requestedDurationMinutes = Math.max(Number(opts.requestedDurationMinutes || 0), 0);
  /* 
  if (useCache) {
    try {
      const key = await cacheKey(providerId, date, settings, requestedDurationMinutes);
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit);
    } catch {}
  }
  */

  const dayStart = isoDateToLocalStart(date);
  const dayEnd = isoDateToLocalEnd(date);
  if (!providerId || !dayStart || !dayEnd) {
    const slotMap = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slotMap[s] = false; });
    return { date, slots: [], slotMap, reason: "invalid_date" };
  }

  const leave = await LeaveRequest.findOne({
    providerId,
    status: "approved",
    $or: [
      { endAt: { $ne: null, $gte: dayStart }, startAt: { $lte: dayEnd } },
      { endAt: null, startAt: { $gte: dayStart, $lte: dayEnd } },
    ],
  }).lean();
  if (leave) {
    const slotMap = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slotMap[s] = false; });
    return { date, slots: [], slotMap, reason: "on_leave" };
  }

  const availDoc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
  
  // Explicit Blocked Provider Check and fetch phone for robust search
  const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
  const provDetails = await ProviderAccount.findById(providerId).select("approvalStatus phone").lean();
  if (provDetails && provDetails.approvalStatus === "blocked") {
    const slotMap = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slotMap[s] = false; });
    return { date, slots: [], slotMap, reason: "provider_blocked" };
  }
  console.log(`[Availability] Computing for Provider: ${providerId}, Date: ${date}, Duration: ${requestedDurationMinutes}m`);

  const provPhoneRaw = String(provDetails?.phone || "").trim();
  const provName = String(provDetails?.name || "").trim();
  
  // Find ALL provider IDs that share this phone number OR name (special case for Muskan testing)
  let allRelatedProviderIds = [String(providerId)];
  const relatedCriteria = [];
  if (provPhoneRaw) relatedCriteria.push({ phone: provPhoneRaw });
  if (provName.toLowerCase().includes("muskan")) relatedCriteria.push({ name: new RegExp(provName.trim(), "i") });

  if (relatedCriteria.length > 0) {
    const relatedAccounts = await ProviderAccount.find({ $or: relatedCriteria }).select("_id name phone").lean();
    allRelatedProviderIds = [...new Set(relatedAccounts.map(a => String(a._id)))];
    console.log(`[Availability] Related Accounts for ${provName}: ${allRelatedProviderIds.join(", ")}`);
  }

  const phoneVariants = provPhoneRaw ? [
    provPhoneRaw,
    provPhoneRaw.startsWith("+91") ? provPhoneRaw.slice(3) : `+91${provPhoneRaw}`
  ] : [];

  // Helper to get YYYY-MM-DD from any date string without timezone shift
  const toYYYYMMDD = (d) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).trim();
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch { return String(d).trim(); }
  };

  const targetDateStandard = toYYYYMMDD(date);
  console.log(`[Availability] Target Date: ${targetDateStandard}`);

  // FIXED: Treat empty array as "no availability set" and default to TRUE
  const baseMap = (availDoc && availDoc.availableSlots && availDoc.availableSlots.length > 0)
    ? (() => {
      const m = {};
      DEFAULT_TIME_SLOTS.forEach((s) => { m[s] = false; });
      for (const s of availDoc.availableSlots) {
        if (DEFAULT_TIME_SLOTS.includes(s)) m[s] = true;
      }
      return m;
    })()
    : defaultSlotsMap(settings?.serviceStartTime || settings?.startTime, settings?.serviceEndTime || settings?.endTime);

  const excludeBookingId = opts.excludeBookingId ? String(opts.excludeBookingId) : null;

  // Fetch all active bookings for ANY of the related IDs or phone variants
  const allProviderBookings = await Booking.find({
    $or: [
      { assignedProvider: { $in: allRelatedProviderIds } },
      ...allRelatedProviderIds.filter(id => mongoose.isValidObjectId(id)).map(id => ({ assignedProvider: new mongoose.Types.ObjectId(id) })),
      { assignedProvider: { $in: phoneVariants } }
    ],
    status: { $nin: ["cancelled", "rejected", "missed"] },
    ...(excludeBookingId && mongoose.isValidObjectId(excludeBookingId) ? { _id: { $ne: excludeBookingId } } : {}),
  }).select("slot slotStartAt slotEndAt services status createdAt items").lean();

  console.log(`[Availability] Found ${allProviderBookings.length} total active bookings for matched group`);

  // Filter bookings that match the requested date (Timezone-safe comparison)
  const providerBookings = allProviderBookings.filter(b => {
    const bDateStr = String(b?.slot?.date || "").trim();
    if (!bDateStr) return false;
    const isMatch = toYYYYMMDD(bDateStr) === targetDateStandard;
    if (isMatch) console.log(`[Availability] ✅ MATCHED Booking ${b._id} on ${bDateStr} at ${b?.slot?.time} (Status: ${b.status})`);
    return isMatch;
  });

  console.log(`[Availability] ${providerBookings.length} bookings match date ${targetDateStandard}`);

  
  // Use a case-insensitive set for exact slot blocking
  const bookedSet = new Set((providerBookings || []).map((b) => {
    const t = String(b?.slot?.time || "").toUpperCase().trim();
    console.log(`[Availability] Blocking exact slot: ${t}`);
    return t;
  }).filter(Boolean));
  
  // Buffer: Use 45m default as requested
  const bufferMin = Math.max(Number(settings?.bufferMinutes ?? settings?.providerBufferMinutes ?? 45), 0);
  const busyStatuses = new Set([
    "incoming",
    "assigned",
    "accepted",
    "travelling",
    "arrived",
    "in_progress",
    "upcoming",
    "pending",
    "payment_pending",
    "advance_paid",
    "confirmed",
    "documentation",
    "scheduled"
  ]);
  const busyIntervals = [];
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  for (const b of (providerBookings || [])) {
    const st = String(b?.status || "").toLowerCase();
    if (!busyStatuses.has(st)) continue;

    // Special case: payment_pending is only busy if it's less than 10 minutes old (Temporary Hold)
    if (st === "payment_pending" && b.createdAt) {
      const age = Date.now() - new Date(b.createdAt).getTime();
      if (age > TEN_MINUTES_MS) continue; // Skip expired holds
    }

    const start = b?.slotStartAt ? new Date(b.slotStartAt) : slotLabelToLocalDateTime(date, b?.slot?.time);
    if (!start || Number.isNaN(start.getTime())) continue;
    const services = Array.isArray(b?.services) ? b.services : (b.items || []);
    const totalMinutes = services.reduce((sum, it) => sum + parseDurationToMinutes(it?.duration, 60), 0) || 60;
    const end = new Date(start.getTime() + (totalMinutes + bufferMin) * 60 * 1000);
    if (!Number.isNaN(end.getTime())) {
      busyIntervals.push({ start, end, bookingId: b._id.toString(), status: b.status });
    }
  }

  if (busyIntervals.length > 0) {
    console.log(`[Availability Debug] Found ${busyIntervals.length} busy intervals for provider ${providerId} on ${date}:`);
    busyIntervals.forEach(it => {
      console.log(`   - Booking ${it.bookingId} (${it.status}): ${it.start.toLocaleTimeString()} to ${it.end.toLocaleTimeString()}`);
    });
  }

  // Priority: startTime (OfficeSettings/Admin) > serviceStartTime (BookingSettings/Default)
  const windowStartMin = (settings?.startTime || settings?.serviceStartTime) ? parseHHMMToMinutes(settings.startTime || settings.serviceStartTime) : null;
  const windowEndMin = (settings?.endTime || settings?.serviceEndTime) ? parseHHMMToMinutes(settings.endTime || settings.serviceEndTime) : null;
  
  const isToday = date === getIndiaDate();
  const now = new Date();
  
  // Use bufferMinutes from OfficeSettings (Admin) or fallback to lead time
  const bufferMs = Math.max(Number(settings?.bufferMinutes || 30), 0) * 60 * 1000;
  const leadMs = Math.max(Number(settings?.minLeadTimeMinutes || 0), 0) * 60 * 1000;
  
  // Dynamic Lead Time Calculation with 2-minute UI buffer for checkout window
  const effectiveLeadMs = Math.max(bufferMs, leadMs) + (2 * 60 * 1000); 
  
  console.log(`[SLOTS DEBUG] Provider: ${providerId}, Date: ${date}, effectiveLead: ${Math.round(effectiveLeadMs/60000)}m`);

  const slotMap = {};
  const slots = [];
  for (const s of DEFAULT_TIME_SLOTS) {
    let ok = baseMap[s] === true && !bookedSet.has(s.toUpperCase().trim());
    const slotStart = ok ? slotLabelToLocalDateTime(date, s) : null;
    
    if (ok && isToday && slotStart) {
      // Enforce Dynamic Lead Time for today's slots
      if (!opts.ignoreLeadTime && slotStart.getTime() < (now.getTime() + effectiveLeadMs)) ok = false;
    }
    
    if (ok && !opts.ignoreServiceWindow && windowStartMin !== null && windowEndMin !== null) {
      const hm = parseSlotLabelToHM(s);
      if (hm) {
        const slotMin = hm.hour * 60 + hm.minute;
        if (!isTimeInWindow(slotMin, windowStartMin, windowEndMin)) ok = false;
      }
    }
    if (ok && slotStart && busyIntervals.length > 0) {
      const windowEnd = requestedDurationMinutes > 0
        ? new Date(slotStart.getTime() + (requestedDurationMinutes + bufferMin) * 60 * 1000)
        : null;
      for (const interval of busyIntervals) {
        if (requestedDurationMinutes > 0 && windowEnd) {
          // Changed to inclusive (<= and >=) to ensure a gap between services as requested
          if (slotStart <= interval.end && windowEnd >= interval.start) {
            ok = false;
            break;
          }
        } else if (slotStart >= interval.start && slotStart <= interval.end) {
          // Changed to inclusive (<=) to ensure a gap
          ok = false;
          break;
        }
      }
    }
    slotMap[s] = ok;
    if (ok) slots.push(s);
    else {
      // Small debug log for blocked slots
      if (isToday && slotStart && !opts.ignoreLeadTime && slotStart.getTime() < (now.getTime() + effectiveLeadMs)) {
         // Silently track lead time block
      }
    }
  }
  console.log(`[SLOTS DEBUG] Finished. Found ${slots.length} slots for ${providerId}`);

  const isFullyBooked = slots.length === 0;
  const reason = isFullyBooked ? (isToday ? "all_slots_past_or_busy" : "no_slots_found") : null;
  const result = { date, slots, slotMap, isFullyBooked, isLeave: false, reason };
  if (useCache) {
    try {
      const key = await cacheKey(providerId, date, settings, requestedDurationMinutes);
      await redis.set(key, JSON.stringify(result), { EX: 60 });
    } catch {}
  }
  return result;
}

function parseHHMMToMinutes(v) {
  const m = String(v || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}
