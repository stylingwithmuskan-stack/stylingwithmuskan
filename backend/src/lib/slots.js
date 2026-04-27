export const DEFAULT_TIME_SLOTS = [
  "12:00 AM", "12:30 AM", "01:00 AM", "01:30 AM", "02:00 AM", "02:30 AM", "03:00 AM", "03:30 AM",
  "04:00 AM", "04:30 AM", "05:00 AM", "05:30 AM", "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM",
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

export function isIsoDate(dateStr) {
  return typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function isValidSlotLabel(s) {
  return typeof s === "string" && DEFAULT_TIME_SLOTS.includes(s);
}

export function defaultSlotsMap(startTime = "07:00", endTime = "22:00") {
  const map = {};
  const startMin = parseHHMMToMinutes(startTime) ?? 420;  // 7:00 AM
  const endMin = parseHHMMToMinutes(endTime) ?? 1320;     // 10:00 PM

  DEFAULT_TIME_SLOTS.forEach((slot) => {
    const hm = parseSlotLabelToHM(slot);
    if (!hm) {
      map[slot] = false;
      return;
    }
    const slotMin = hm.hour * 60 + hm.minute;
    if (startMin <= endMin) {
      map[slot] = slotMin >= startMin && slotMin <= endMin;
    } else {
      // Overnight case
      map[slot] = slotMin >= startMin || slotMin <= endMin;
    }
  });
  return map;
}

function parseHHMMToMinutes(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

export function normalizeSlotsPayload(slots) {
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) {
    return { ok: false, error: "Invalid slots payload" };
  }
  const out = {};
  for (const slot of DEFAULT_TIME_SLOTS) {
    const v = slots[slot];
    if (v === undefined) continue;
    if (typeof v !== "boolean") return { ok: false, error: `Invalid slot value for ${slot}` };
    out[slot] = v;
  }
  return { ok: true, slots: out };
}

export function slotsMapToAvailableSlots(map) {
  return DEFAULT_TIME_SLOTS.filter((s) => map[s] === true);
}

export function parseSlotLabelToHM(label) {
  // Expects labels like "09:00 AM", "12:00 PM", "01:00 PM"
  if (typeof label !== "string") return null;
  const m = label.trim().match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
  if (ampm === "AM") {
    if (hh === 12) hh = 0;
  } else {
    if (hh !== 12) hh += 12;
  }
  return { hour: hh, minute: mm };
}

export function slotLabelToLocalDateTime(dateIso, slotLabel) {
  // dateIso: "YYYY-MM-DD"
  const hm = parseSlotLabelToHM(slotLabel);
  if (!hm) return null;
  if (typeof dateIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;

  // Create an ISO string with +05:30 offset to ensure absolute time is correct relative to IST
  const isoStr = `${dateIso}T${String(hm.hour).padStart(2, "0")}:${String(hm.minute).padStart(2, "0")}:00+05:30`;
  const dt = new Date(isoStr);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseDurationToMinutes(input, fallbackMinutes = 60) {
  if (typeof input === "number" && !Number.isNaN(input)) {
    return Math.max(15, Math.min(Math.round(input), 12 * 60));
  }
  if (!input || typeof input !== "string") return fallbackMinutes;
  const s = input.toLowerCase()
    .replace(/hours?/g, "h")
    .replace(/hrs?/g, "h")
    .replace(/minutes?/g, "m")
    .replace(/mins?/g, "m");

  const range = s.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    const max = Math.max(parseInt(range[1], 10), parseInt(range[2], 10));
    if (s.includes("h")) return Math.max(15, Math.min(max * 60, 12 * 60));
    if (s.includes("m")) return Math.max(15, Math.min(max, 12 * 60));
    return Math.max(15, Math.min(max, 12 * 60));
  }

  let minutes = 0;
  const hMatch = s.match(/(\d+)\s*h/);
  const mMatch = s.match(/(\d+)\s*m/);
  if (hMatch) minutes += parseInt(hMatch[1], 10) * 60;
  if (mMatch) minutes += parseInt(mMatch[1], 10);
  if (minutes === 0) {
    const num = s.match(/(\d+)/);
    minutes = num ? parseInt(num[1], 10) : fallbackMinutes;
  }
  return Math.max(15, Math.min(minutes, 12 * 60));
}
