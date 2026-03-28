import Vendor from "../../../models/Vendor.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Booking from "../../../models/Booking.js";
import User from "../../../models/User.js";
import Coupon from "../../../models/Coupon.js";
import { uploadBuffer } from "../../../startup/cloudinary.js";
import SOSAlert from "../../../models/SOSAlert.js";
import { CommissionSettings } from "../../../models/Settings.js";
import { City, Zone } from "../../../models/CityZone.js";

import CustomEnquiry from "../../../models/CustomEnquiry.js";

const DEFAULT_TZ = "Asia/Kolkata";

function normalizeCity(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "all cities") return "";
  return s;
}

function normalizeTz(v) {
  const tz = String(v || "").trim() || DEFAULT_TZ;
  try {
    // Throws RangeError for invalid IANA tz names
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function getZonedYearMonth(date, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit" });
  const parts = dtf.formatToParts(date);
  const vals = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return { year: Number(vals.year), month: Number(vals.month) };
}

function parsePeriod(period, tz) {
  if (typeof period === "string" && period.trim()) {
    const raw = period.trim();
    if (raw === "overall") return "overall";
    const m = raw.match(/^(\d{4})-(\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mm = Number(m[2]);
      if (y >= 1970 && mm >= 1 && mm <= 12) return { year: y, month: mm };
    }
  }
  return getZonedYearMonth(new Date(), tz);
}

function getTimeZoneOffsetMinutes(tz, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const vals = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(vals.year),
    Number(vals.month) - 1,
    Number(vals.day),
    Number(vals.hour),
    Number(vals.minute),
    Number(vals.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, tz) {
  const baseUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = new Date(baseUtcMs);
  const off1 = getTimeZoneOffsetMinutes(tz, guess);
  let utc = new Date(baseUtcMs - off1 * 60000);
  const off2 = getTimeZoneOffsetMinutes(tz, utc);
  if (off2 !== off1) utc = new Date(baseUtcMs - off2 * 60000);
  return utc;
}

function monthRangeUtc({ year, month }, tz) {
  const start = zonedTimeToUtc({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, tz);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = zonedTimeToUtc({ year: nextMonth.year, month: nextMonth.month, day: 1, hour: 0, minute: 0, second: 0 }, tz);
  return { start, end, nextMonth };
}

function ymKey({ year, month }) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths({ year, month }, delta) {
  const idx = year * 12 + (month - 1) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { year: y, month: m };
}

function cityPredicate(city) {
  const c = normalizeCity(city);
  if (!c) return {};
  return { $or: [{ "address.city": c }, { "address.area": c }] };
}

export async function listVendors(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const total = await Vendor.countDocuments();
  const items = await Vendor.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ vendors: items, page, limit, total });
}

export async function listProviders(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const total = await ProviderAccount.countDocuments({ registrationComplete: true });
  const items = await ProviderAccount.find({ registrationComplete: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ providers: items, page, limit, total });
}

export async function listBookings(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const total = await Booking.countDocuments();
  const items = await Booking.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ bookings: items, page, limit, total });
}

export async function listCustomers(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const total = await User.countDocuments();
  const items = await User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ customers: items, page, limit, total });
}

export async function listCoupons(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const total = await Coupon.countDocuments();
  const items = await Coupon.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ coupons: items, page, limit, total });
}

export async function uploadBanner(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image" });
  const up = await uploadBuffer(req.file.buffer, "banners");
  res.json({ url: up.secure_url });
}

export async function uploadSpotlightVideo(req, res) {
  if (!req.file) return res.status(400).json({ error: "No video" });
  const up = await uploadBuffer(req.file.buffer, "reels", {
    resource_type: "video",
  });
  res.json({ url: up.secure_url });
}

export async function uploadGalleryImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image" });
  const up = await uploadBuffer(req.file.buffer, "gallery");
  res.json({ url: up.secure_url });
}

export async function metricsOverview(req, res) {
  const tz = normalizeTz(req.query.tz);
  const city = normalizeCity(req.query.city);
  const period = parsePeriod(req.query.period, tz);
  const isOverall = period === "overall";
  const { start, end } = isOverall ? { start: null, end: null } : monthRangeUtc(period, tz);

  const bookingMatch = { ...cityPredicate(city) };
  if (!isOverall) {
    bookingMatch.createdAt = { $gte: start, $lt: end };
  }

  const [vendorCount, totalSPs, activeSPs, pendingSPs, commissionSettings, bookingAgg, sosCount] = await Promise.all([
    Vendor.countDocuments(city ? { city } : {}),
    ProviderAccount.countDocuments({ registrationComplete: true, ...(city ? { city } : {}) }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "approved", ...(city ? { city } : {}) }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "pending", ...(city ? { city } : {}) }),
    CommissionSettings.findOne().lean(),
    Booking.aggregate([
      { $match: bookingMatch },
      {
        $facet: {
          totals: [{ $count: "count" }],
          active: [
            { $match: { status: { $in: ["accepted", "travelling", "arrived", "in_progress"] } } },
            { $count: "count" },
          ],
          completedRevenue: [
            { $match: { status: "completed" } },
            { $group: { _id: null, revenue: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
          ],
          cancelled: [
            { $match: { status: { $in: ["cancelled", "rejected"] } } },
            { $count: "count" },
          ],
          customers: [
            { $match: { customerId: { $ne: null } } },
            { $group: { _id: "$customerId" } },
            { $count: "count" },
          ],
          zones: [
            {
              $addFields: {
                zone: {
                  $cond: [
                    { $and: [{ $ne: ["$address.area", null] }, { $ne: ["$address.area", ""] }] },
                    "$address.area",
                    "$address.city",
                  ],
                },
              },
            },
            { $match: { zone: { $nin: [null, ""] } } },
            { $group: { _id: "$zone", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
        },
      },
    ]),
    SOSAlert.countDocuments({ status: { $ne: "resolved" } }),
  ]);

  const f = (Array.isArray(bookingAgg) && bookingAgg[0]) ? bookingAgg[0] : {};
  const totalBookings = Number(f?.totals?.[0]?.count || 0);
  const activeBookings = Number(f?.active?.[0]?.count || 0);
  const totalRevenue = Number(f?.completedRevenue?.[0]?.revenue || 0);
  const cancelledCount = Number(f?.cancelled?.[0]?.count || 0);
  const customerCount = Number(f?.customers?.[0]?.count || 0);
  const zones = Array.isArray(f?.zones) ? f.zones.map((z) => [z._id, z.count]) : [];

  const ratePct = Math.max(0, Number(commissionSettings?.rate ?? 15));
  const commissionEarned = Math.round(totalRevenue * (ratePct / 100));

  res.json({
    overview: {
      totalVendors: vendorCount || 0,
      totalSPs: totalSPs || 0,
      activeSPs: activeSPs || 0,
      pendingSPs: pendingSPs || 0,
      totalBookings,
      activeBookings,
      totalRevenue,
      commissionEarned,
      cancellationRate: totalBookings ? Math.round((cancelledCount / totalBookings) * 100) : 0,
      customerCount,
      sosActive: sosCount || 0,
      // Optional: used by existing UI's Zone-wise Analysis section
      zones,
    },
  });
}

export async function metricsRevenueByMonth(req, res) {
  const tz = normalizeTz(req.query.tz);
  const city = normalizeCity(req.query.city);
  let period = parsePeriod(req.query.period, tz);
  if (period === "overall") period = getZonedYearMonth(new Date(), tz);
  const months = Math.max(1, Math.min(parseInt(req.query.months) || 6, 24));

  const endRange = monthRangeUtc(period, tz).end; // exclusive
  const startPeriod = addMonths(period, -(months - 1));
  const startRange = monthRangeUtc(startPeriod, tz).start;

  const commissionSettings = await CommissionSettings.findOne().lean();
  const ratePct = Math.max(0, Number(commissionSettings?.rate ?? 15));

  const agg = await Booking.aggregate([
    {
      $match: {
        status: "completed",
        createdAt: { $gte: startRange, $lt: endRange },
        ...cityPredicate(city),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tz } },
        revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byKey = new Map((agg || []).map((r) => [String(r._id), Number(r.revenue || 0)]));
  const series = [];
  for (let i = 0; i < months; i++) {
    const p = addMonths(startPeriod, i);
    const key = ymKey(p);
    const revenue = byKey.get(key) || 0;
    const d = new Date(Date.UTC(p.year, p.month - 1, 1));
    const label = d.toLocaleString("en-US", { month: "short" });
    series.push({
      key,
      month: label,
      revenue,
      commission: Math.round(revenue * (ratePct / 100)),
    });
  }

  res.json({ series });
}

export async function metricsCustomersByMonth(req, res) {
  const tz = normalizeTz(req.query.tz);
  const city = normalizeCity(req.query.city);
  let period = parsePeriod(req.query.period, tz);
  if (period === "overall") period = getZonedYearMonth(new Date(), tz);
  const months = Math.max(1, Math.min(parseInt(req.query.months) || 6, 24));

  const endRange = monthRangeUtc(period, tz).end; // exclusive
  const startPeriod = addMonths(period, -(months - 1));
  const startRange = monthRangeUtc(startPeriod, tz).start;

  const agg = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startRange, $lt: endRange },
        ...cityPredicate(city),
        customerId: { $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tz } },
          customerId: "$customerId",
        },
      },
    },
    { $group: { _id: "$_id.month", customers: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const byKey = new Map((agg || []).map((r) => [String(r._id), Number(r.customers || 0)]));
  const series = [];
  for (let i = 0; i < months; i++) {
    const p = addMonths(startPeriod, i);
    const key = ymKey(p);
    const customers = byKey.get(key) || 0;
    const d = new Date(Date.UTC(p.year, p.month - 1, 1));
    const label = d.toLocaleString("en-US", { month: "short" });
    series.push({ key, month: label, customers });
  }

  res.json({ series });
}

export async function metricsProvidersByMonth(req, res) {
  const tz = normalizeTz(req.query.tz);
  const city = normalizeCity(req.query.city);
  let period = parsePeriod(req.query.period, tz);
  if (period === "overall") period = getZonedYearMonth(new Date(), tz);
  const months = Math.max(1, Math.min(parseInt(req.query.months) || 6, 24));

  const endRange = monthRangeUtc(period, tz).end; // exclusive
  const startPeriod = addMonths(period, -(months - 1));
  const startRange = monthRangeUtc(startPeriod, tz).start;

  // Active SPs inferred from bookings in each month (distinct assignedProvider), filtered by booking city + time range.
  const agg = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: startRange, $lt: endRange },
        ...cityPredicate(city),
        assignedProvider: { $nin: [null, ""] },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tz } },
          providerId: "$assignedProvider",
        },
      },
    },
    { $group: { _id: "$_id.month", providers: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const byKey = new Map((agg || []).map((r) => [String(r._id), Number(r.providers || 0)]));
  const series = [];
  for (let i = 0; i < months; i++) {
    const p = addMonths(startPeriod, i);
    const key = ymKey(p);
    const providers = byKey.get(key) || 0;
    const d = new Date(Date.UTC(p.year, p.month - 1, 1));
    const label = d.toLocaleString("en-US", { month: "short" });
    series.push({ key, month: label, providers });
  }

  res.json({ series });
}

export async function metricsBookingTrend(req, res) {
  const tz = normalizeTz(req.query.tz);
  const city = normalizeCity(req.query.city);
  let period = parsePeriod(req.query.period, tz);
  if (period === "overall") period = getZonedYearMonth(new Date(), tz);
  const days = Math.max(1, Math.min(parseInt(req.query.days) || 7, 31));

  const now = new Date();
  const currentPeriod = getZonedYearMonth(now, tz);
  const selectedKey = ymKey(period);
  const currentKey = ymKey(currentPeriod);

  const { end: selectedEndExclusive } = monthRangeUtc(period, tz);
  const windowEnd = selectedKey < currentKey ? selectedEndExclusive : now;
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 3600 * 1000);

  const agg = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: windowStart, $lt: windowEnd },
        ...cityPredicate(city),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%u", date: "$createdAt", timezone: tz } }, // ISO day of week: 1..7 (Mon..Sun)
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDow = new Map((agg || []).map((r) => [String(r._id), Number(r.count || 0)]));
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const series = labels.map((day, idx) => {
    const key = String(idx + 1);
    return { day, bookings: byDow.get(key) || 0 };
  });
  res.json({ series });
}

export async function metricsCities(_req, res) {
  const [vCities, pCities, bCities, bAreas, cityDocs] = await Promise.all([
    Vendor.distinct("city", { city: { $nin: [null, ""] } }),
    ProviderAccount.distinct("city", { city: { $nin: [null, ""] } }),
    Booking.distinct("address.city", { "address.city": { $nin: [null, ""] } }),
    Booking.distinct("address.area", { "address.area": { $nin: [null, ""] } }),
    City.find().sort({ name: 1 }).lean(),
  ]);
  const set = new Set();
  for (const arr of [vCities, pCities, bCities, bAreas]) {
    for (const c of arr || []) {
      const s = String(c || "").trim();
      if (s) set.add(s);
    }
  }
  for (const cDoc of cityDocs || []) {
    if (cDoc.name) set.add(cDoc.name.trim());
  }
  const cities = ["All Cities", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  res.json({ cities });
}

// ───── CUSTOM ENQUIRIES ─────

export async function listCustomEnquiries(_req, res) {
  const items = await CustomEnquiry.find().sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function customEnquiryPriceQuote(req, res) {
  const { totalAmount, discountPrice, notes } = req.body;
  const item = await CustomEnquiry.findByIdAndUpdate(
    req.params.id,
    { 
      status: "admin_approved",
      totalAmount,
      discountPrice,
      adminNotes: notes || ""
    },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ enquiry: item });
}

export async function customEnquiryFinalApprove(req, res) {
  const item = await CustomEnquiry.findByIdAndUpdate(
    req.params.id,
    { status: "final_approved" },
    { new: true }
  );
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ enquiry: item });
}

// ───── CITIES & ZONES ─────

export async function listCities(_req, res) {
  const cities = await City.find().sort({ name: 1 }).lean();
  res.json({ cities });
}

export async function createCity(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const city = await City.create({ name });
  res.json({ city });
}

export async function listZones(req, res) {
  const { cityId } = req.params;
  const zones = await Zone.find({ city: cityId }).sort({ name: 1 }).lean();
  res.json({ zones });
}

export async function createZone(req, res) {
  const { cityId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const zone = await Zone.create({ name, city: cityId });
  res.json({ zone });
}

export async function updateCity(req, res) {
  const { cityId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const city = await City.findByIdAndUpdate(cityId, { name }, { new: true });
  if (!city) return res.status(404).json({ error: "City not found" });
  res.json({ city });
}

export async function deleteCity(req, res) {
  const { cityId } = req.params;
  // Also delete associated zones
  await Zone.deleteMany({ city: cityId });
  const city = await City.findByIdAndDelete(cityId);
  if (!city) return res.status(404).json({ error: "City not found" });
  res.json({ success: true });
}

export async function updateZone(req, res) {
  const { zoneId } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const zone = await Zone.findByIdAndUpdate(zoneId, { name }, { new: true });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  res.json({ zone });
}

export async function deleteZone(req, res) {
  const { zoneId } = req.params;
  const zone = await Zone.findByIdAndDelete(zoneId);
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  res.json({ success: true });
}

export async function getZoneStats(req, res) {
  const { zoneId } = req.params;
  const zone = await Zone.findById(zoneId).populate("city").lean();
  if (!zone) return res.status(404).json({ error: "Zone not found" });

  // For now, we match by zone name in Vendor/Provider/Booking models
  // In a real scenario, we should migrate these models to use zoneId
  const [vendors, providers, bookings] = await Promise.all([
    Vendor.find({ area: zone.name }).lean(),
    ProviderAccount.find({ area: zone.name }).lean(),
    Booking.find({ "address.area": zone.name }).lean(),
  ]);

  const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const repeatCustomers = bookings.filter(b => b.isRepeatCustomer).length; // Assuming field exists or can be calculated

  res.json({
    zone,
    vendors,
    providers,
    metrics: {
      totalRevenue,
      repeatCustomers,
      totalBookings: bookings.length
    }
  });
}

