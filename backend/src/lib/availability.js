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
  const useCache = opts.useCache !== false;
  const requestedDurationMinutes = Math.max(Number(opts.requestedDurationMinutes || 0), 0);
  if (useCache) {
    try {
      const key = await cacheKey(providerId, date, settings, requestedDurationMinutes);
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit);
    } catch {}
  }

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
  
  // Explicit Blocked Provider Check (as requested)
  // Although usually handled in routes, this adds an extra layer of safety.
  const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
  const provCheck = await ProviderAccount.findById(providerId).select("approvalStatus").lean();
  if (provCheck && provCheck.approvalStatus === "blocked") {
    const slotMap = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slotMap[s] = false; });
    return { date, slots: [], slotMap, reason: "provider_blocked" };
  }

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
  if (excludeBookingId) {
    console.log(`[Availability Debug] Excluding current booking ${excludeBookingId} from busy check`);
  }
  const providerBookings = await Booking.find({
    assignedProvider: providerId,
    "slot.date": date,
    status: { $ne: "cancelled" },
    ...(excludeBookingId && mongoose.isValidObjectId(excludeBookingId) ? { _id: { $ne: excludeBookingId } } : {}),
  }).select("slot slotStartAt slotEndAt services status createdAt").lean();
  const bookedSet = new Set((providerBookings || []).map((b) => String(b?.slot?.time || "")).filter(Boolean));

  // Buffer: Use providerBufferMinutes from settings or bufferMinutes from officeSettings (fallback 30)
  const bufferMin = Math.max(Number(settings?.bufferMinutes ?? settings?.providerBufferMinutes ?? 30), 0);
  const busyStatuses = new Set([
    "accepted",
    "travelling",
    "arrived",
    "in_progress",
    "upcoming",
    "pending",
    "payment_pending",
    "advance_paid",
    "confirmed",
    "documentation"
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
  
  // Dynamic Lead Time Calculation with 10-minute UI buffer for checkout window
  const effectiveLeadMs = Math.max(bufferMs, leadMs) + (10 * 60 * 1000); 
  
  console.log(`[SLOTS DEBUG] Provider: ${providerId}, Date: ${date}, effectiveLead: ${Math.round(effectiveLeadMs/60000)}m`);

  const slotMap = {};
  const slots = [];
  for (const s of DEFAULT_TIME_SLOTS) {
    let ok = baseMap[s] === true && !bookedSet.has(s);
    const slotStart = ok ? slotLabelToLocalDateTime(date, s) : null;
    
    if (ok && isToday && slotStart) {
      // Enforce Dynamic Lead Time for today's slots
      if (!opts.ignoreLeadTime && slotStart.getTime() < (now.getTime() + effectiveLeadMs)) ok = false;
    }
    
    if (ok && windowStartMin !== null && windowEndMin !== null) {
      const hm = parseSlotLabelToHM(s);
      if (hm) {
        const slotMin = hm.hour * 60 + hm.minute;
        if (!isTimeInWindow(slotMin, windowStartMin, windowEndMin)) ok = false;
        
        if (ok && requestedDurationMinutes > 0) {
          const requiredEndMin = slotMin + requestedDurationMinutes + bufferMin;
          // For overnight windows, the end time enforcement is slightly more complex.
          // But for now, we enforce that the service must finish within the (possibly wrapped) window.
          if (windowStartMin <= windowEndMin) {
            if (requiredEndMin > windowEndMin) ok = false;
          } else {
            // In overnight case, if it started after windowStartMin, it can go up to windowEndMin (next day)
            // If it started before windowEndMin, it must finish before windowEndMin
            if (slotMin >= windowStartMin) {
               // Service starts late night, can cross midnight but must end before next day's windowEndMin
               // (Technically 1440 + windowEndMin is the boundary)
               if (requiredEndMin > (1440 + windowEndMin)) ok = false;
            } else {
               // Service starts early morning, must end before windowEndMin
               if (requiredEndMin > windowEndMin) ok = false;
            }
          }
        }
      }
    }
    if (ok && slotStart && busyIntervals.length > 0) {
      const windowEnd = requestedDurationMinutes > 0
        ? new Date(slotStart.getTime() + (requestedDurationMinutes + bufferMin) * 60 * 1000)
        : null;
      for (const interval of busyIntervals) {
        if (requestedDurationMinutes > 0 && windowEnd) {
          if (slotStart < interval.end && windowEnd > interval.start) {
            ok = false;
            break;
          }
        } else if (slotStart >= interval.start && slotStart < interval.end) {
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

  const result = { date, slots, slotMap };
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
