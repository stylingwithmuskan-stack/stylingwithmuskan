export function isIsoDate(dateStr) {
  return typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function isoDateToLocalStart(dateStr) {
  if (!isIsoDate(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isoDateToLocalEnd(dateStr) {
  if (!isIsoDate(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function toIsoDateFromAny(input) {
  // Accept "YYYY-MM-DD", "YYYY-MM-DDTHH:mm", Date, etc.
  if (!input) return "";
  if (typeof input === "string") {
    const s = input.trim();
    if (isIsoDate(s)) return s;
    // datetime-local input: "YYYY-MM-DDTHH:mm"
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export function daysBetweenInclusive(startIso, endIso) {
  const s = isoDateToLocalStart(startIso);
  const e = isoDateToLocalStart(endIso);
  if (!s || !e) return null;
  const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

export function isoDateRangeIncludesWeekend(startIso, endIso) {
  const s = isoDateToLocalStart(startIso);
  const e = isoDateToLocalStart(endIso);
  if (!s || !e) return null;
  if (e.getTime() < s.getTime()) return null;
  for (let t = s.getTime(); t <= e.getTime(); t += 24 * 60 * 60 * 1000) {
    const dow = new Date(t).getDay(); // 0 Sun .. 6 Sat
    if (dow === 0 || dow === 6) return true;
  }
  return false;
}

