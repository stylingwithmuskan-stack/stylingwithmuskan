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

// Helper function for coordinate validation
function isValidCoordinate(coord) {
  if (!coord) return false;
  if (typeof coord.lat !== 'number') return false;
  if (typeof coord.lng !== 'number') return false;
  if (coord.lat < -90 || coord.lat > 90) return false;
  if (coord.lng < -180 || coord.lng > 180) return false;
  return true;
}

export async function createZone(req, res) {
  const { cityId } = req.params;
  const { name, coordinates } = req.body;
  
  // Existing validation
  if (!name) return res.status(400).json({ error: "Name is required" });
  
  // NEW: Validate coordinates if provided
  if (coordinates !== undefined && coordinates !== null) {
    if (!Array.isArray(coordinates) || coordinates.length !== 5) {
      return res.status(400).json({ 
        error: "Coordinates must be an array of exactly 5 points" 
      });
    }
    
    for (const coord of coordinates) {
      if (!isValidCoordinate(coord)) {
        return res.status(400).json({ 
          error: "Invalid coordinate format or values" 
        });
      }
    }
  }
  
  // Create zone with optional coordinates
  const zone = await Zone.create({ 
    name, 
    city: cityId,
    ...(coordinates && { coordinates }) // Only include if provided
  });
  
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
  const { name, coordinates } = req.body;
  
  const updates = {};
  if (name) updates.name = name;
  
  // NEW: Validate and include coordinates if provided
  if (coordinates !== undefined) {
    if (coordinates === null) {
      updates.coordinates = null; // Allow clearing coordinates
    } else {
      if (!Array.isArray(coordinates) || coordinates.length !== 5) {
        return res.status(400).json({ 
          error: "Coordinates must be an array of exactly 5 points" 
        });
      }
      for (const coord of coordinates) {
        if (!isValidCoordinate(coord)) {
          return res.status(400).json({ 
            error: "Invalid coordinate format or values" 
          });
        }
      }
      updates.coordinates = coordinates;
    }
  }
  
  const zone = await Zone.findByIdAndUpdate(zoneId, updates, { new: true });
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

// ───── PAYOUTS (Finance Management) ─────

export async function listPayouts(req, res) {
  const { city, status, startDate, endDate, query } = req.query;
  const filter = { status: "completed" }; // Only completed bookings are eligible for payouts

  if (city && city !== "All Cities") {
    filter.$or = [{ "address.city": city }, { "address.area": city }];
  }
  if (status && status !== "All") {
    filter.payoutStatus = status;
  }
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const ed = new Date(endDate);
      ed.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = ed;
    }
  }

  // Fetch bookings with basic provider info
  const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();
  
  // Enhance with provider name if possible
  const providerIds = [...new Set(bookings.map(b => b.assignedProvider).filter(Boolean))];
  const providers = await ProviderAccount.find({ _id: { $in: providerIds } }, "name city").lean();
  const provMap = new Map(providers.map(p => [p._id.toString(), p]));

  const payouts = bookings.map(b => ({
    id: b._id.toString(),
    spName: provMap.get(b.assignedProvider)?.name || "Unknown SP",
    city: b.address?.city || b.address?.area || "Unknown",
    amount: b.totalAmount || 0,
    status: b.payoutStatus || "pending",
    date: b.createdAt.toISOString().split("T")[0],
    vendorId: b.maintainProvider || "",
    bookingId: b._id.toString(),
  }));

  // Simple client-side search simulation if query exists
  let filtered = payouts;
  if (query) {
    const q = query.toLowerCase();
    filtered = payouts.filter(p => 
      p.spName.toLowerCase().includes(q) || 
      p.id.toLowerCase().includes(q) ||
      p.bookingId.toLowerCase().includes(q)
    );
  }

  res.json({ payouts: filtered });
}

export async function updatePayoutStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!["pending", "completed", "on_hold"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const b = await Booking.findByIdAndUpdate(id, { payoutStatus: status }, { new: true });
  if (!b) return res.status(404).json({ error: "Booking not found" });

  res.json({ success: true, booking: b });
}


// ───── FEEDBACK MANAGEMENT ─────
import Feedback from "../../../models/Feedback.js";

export async function listFeedback(req, res) {
  try {
    const { type, rating, search, page = 1, limit = 50 } = req.query;
    const query = { status: "active" };

    // Filter by type
    if (type && ["customer_to_provider", "provider_to_customer"].includes(type)) {
      query.type = type;
    }

    // Filter by rating
    if (rating) {
      const r = Number(rating);
      if (r >= 1 && r <= 5) query.rating = r;
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { customerName: searchRegex },
        { providerName: searchRegex },
        { serviceName: searchRegex },
        { bookingId: searchRegex },
        { comment: searchRegex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Feedback.countDocuments(query);

    res.json({
      feedback: feedbacks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Error listing feedback:", error);
    res.status(500).json({ error: "Could not fetch feedback" });
  }
}

export async function getFeedbackStats(req, res) {
  try {
    const allFeedback = await Feedback.find({ status: "active" }).lean();

    // Basic stats
    const totalReviews = allFeedback.length;
    const avgRating = totalReviews > 0 
      ? (allFeedback.reduce((sum, f) => sum + f.rating, 0) / totalReviews).toFixed(1)
      : "0.0";
    
    const customerToSP = allFeedback.filter(f => f.type === "customer_to_provider").length;
    const spToCustomer = allFeedback.filter(f => f.type === "provider_to_customer").length;
    const positiveCount = allFeedback.filter(f => f.rating >= 4).length;
    const negativeCount = allFeedback.filter(f => f.rating <= 2).length;

    // Service-wise analysis
    const serviceMap = {};
    allFeedback.forEach(f => {
      const svc = f.serviceName || "General";
      if (!serviceMap[svc]) serviceMap[svc] = { count: 0, total: 0 };
      serviceMap[svc].count += 1;
      serviceMap[svc].total += f.rating;
    });
    const serviceAnalysis = Object.entries(serviceMap)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avg: (data.total / data.count).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Tag analysis
    const tagMap = {};
    allFeedback.forEach(f => {
      (f.tags || []).forEach(t => {
        tagMap[t] = (tagMap[t] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Rating distribution
    const ratingDistribution = {
      1: allFeedback.filter(f => f.rating === 1).length,
      2: allFeedback.filter(f => f.rating === 2).length,
      3: allFeedback.filter(f => f.rating === 3).length,
      4: allFeedback.filter(f => f.rating === 4).length,
      5: allFeedback.filter(f => f.rating === 5).length,
    };

    res.json({
      stats: {
        totalReviews,
        avgRating,
        customerToSP,
        spToCustomer,
        positiveCount,
        negativeCount,
        serviceAnalysis,
        topTags,
        ratingDistribution,
      },
    });
  } catch (error) {
    console.error("Error calculating feedback stats:", error);
    res.status(500).json({ error: "Could not calculate feedback stats" });
  }
}

export async function deleteFeedback(req, res) {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found" });

    // Update provider rating if it was customer feedback
    if (feedback.type === "customer_to_provider" && feedback.providerId) {
      const { updateProviderRating } = await import("../../../lib/updateProviderRating.js");
      await updateProviderRating(feedback.providerId);
    }

    res.json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ error: "Could not delete feedback" });
  }
}

export async function updateFeedbackStatus(req, res) {
  try {
    const { status } = req.body;
    if (!["active", "hidden", "flagged"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!feedback) return res.status(404).json({ error: "Feedback not found" });

    // Update provider rating if status changed
    if (feedback.type === "customer_to_provider" && feedback.providerId) {
      const { updateProviderRating } = await import("../../../lib/updateProviderRating.js");
      await updateProviderRating(feedback.providerId);
    }

    res.json({ feedback });
  } catch (error) {
    console.error("Error updating feedback status:", error);
    res.status(500).json({ error: "Could not update feedback status" });
  }
}

// ───── CUSTOMER COD MANAGEMENT ─────
export async function toggleCustomerCOD(req, res) {
  try {
    const User = (await import("../../../models/User.js")).default;
    const userId = req.params.id;
    const { codDisabled } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        codDisabled: !!codDisabled,
        codDisabledAt: codDisabled ? new Date() : null,
        codDisabledBy: codDisabled ? (req.auth?.sub || "admin") : "",
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (error) {
    console.error("Error toggling customer COD:", error);
    res.status(500).json({ error: "Could not update COD status" });
  }
}

export async function updateCustomerStatus(req, res) {
  try {
    const User = (await import("../../../models/User.js")).default;
    const userId = req.params.id;
    const { status } = req.body;

    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (error) {
    console.error("Error updating customer status:", error);
    res.status(500).json({ error: "Could not update customer status" });
  }
}


// List pending zone creation requests (vendor-approved new zones) - Phase 4
export async function listPendingZoneCreations(req, res) {
  try {
    // Find all providers with vendor-approved new zone requests
    const providers = await ProviderAccount.find({
      pendingZoneRequests: {
        $elemMatch: {
          isNewZone: true,
          vendorStatus: "approved",
          adminStatus: "pending"
        }
      }
    }).select('name phone address currentLocation city pendingZoneRequests').lean();

    // Flatten and format pending zone creation requests
    const requests = [];
    for (const provider of providers) {
      if (!provider.pendingZoneRequests) continue;
      
      for (const request of provider.pendingZoneRequests) {
        // Only include vendor-approved new zones pending admin action
        if (request.isNewZone && request.vendorStatus === "approved" && request.adminStatus === "pending") {
          requests.push({
            _id: request._id,
            providerId: provider._id,
            providerName: provider.name,
            providerPhone: provider.phone,
            providerAddress: provider.address,
            providerLocation: provider.currentLocation,
            providerCity: provider.city,
            zoneName: request.zoneName,
            requestedAt: request.requestedAt,
            vendorReviewedAt: request.vendorReviewedAt,
            vendorReviewedBy: request.vendorReviewedBy
          });
        }
      }
    }

    // Sort by vendor review date (newest first)
    requests.sort((a, b) => new Date(b.vendorReviewedAt) - new Date(a.vendorReviewedAt));

    res.json({ requests });
  } catch (error) {
    console.error('[Admin] Failed to list pending zone creations:', error);
    res.status(500).json({ error: 'Failed to fetch pending zone creations' });
  }
}

// Create zone from provider request - Phase 4
export async function createZoneFromRequest(req, res) {
  try {
    const { providerId, requestId, cityId, zoneName, coordinates } = req.body;

    // Validate inputs
    if (!providerId || !requestId || !cityId || !zoneName || !coordinates) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate coordinates (must be array of 5 lat/lng pairs)
    if (!Array.isArray(coordinates) || coordinates.length !== 5) {
      return res.status(400).json({ error: 'Coordinates must be an array of exactly 5 points' });
    }

    for (const coord of coordinates) {
      if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
        return res.status(400).json({ error: 'Invalid coordinate format' });
      }
      if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) {
        return res.status(400).json({ error: 'Coordinate values out of range' });
      }
    }

    // Find provider and request
    const provider = await ProviderAccount.findById(providerId);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const request = provider.pendingZoneRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Zone request not found' });
    }

    if (request.adminStatus !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Create the zone
    const zone = await Zone.create({
      name: zoneName,
      city: cityId,
      status: 'active',
      coordinates
    });

    // Update request status
    request.adminStatus = 'approved';
    request.adminReviewedAt = new Date();
    request.adminReviewedBy = req.auth?.sub || 'admin';

    // Add zone to provider's zones array
    if (!provider.zones.includes(zoneName)) {
      provider.zones.push(zoneName);
    }

    await provider.save();

    // Send notifications
    try {
      await (await import("../../../lib/notify.js")).notify({
        recipientId: provider._id.toString(),
        recipientRole: "provider",
        title: "New Zone Created",
        message: `Your requested zone "${zoneName}" has been created by admin. You can now serve customers in this area.`,
        type: "zone_created",
        meta: { zoneId: zone._id.toString(), zoneName },
      });

      // Notify vendor
      if (request.vendorReviewedBy) {
        const Vendor = (await import("../../../models/Vendor.js")).default;
        const vendor = await Vendor.findOne({ 
          city: { $regex: new RegExp(`^${provider.city}$`, "i") },
          status: "approved"
        }).lean();
        
        if (vendor) {
          await (await import("../../../lib/notify.js")).notify({
            recipientId: vendor._id.toString(),
            recipientRole: "vendor",
            title: "Zone Created",
            message: `Admin created zone "${zoneName}" for provider ${provider.name}.`,
            type: "zone_created",
            meta: { zoneId: zone._id.toString(), zoneName, providerId: provider._id.toString() },
          });
        }
      }
    } catch (notifyError) {
      console.error('[Admin] Failed to send zone creation notifications:', notifyError);
    }

    res.status(201).json({ 
      success: true, 
      zone,
      message: `Zone "${zoneName}" created and assigned to provider ${provider.name}`
    });
  } catch (error) {
    console.error('[Admin] Failed to create zone from request:', error);
    res.status(500).json({ error: 'Failed to create zone' });
  }
}

// Reject zone creation request - Phase 4
export async function rejectZoneCreationRequest(req, res) {
  try {
    const { providerId, requestId, reason } = req.body;

    if (!providerId || !requestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const provider = await ProviderAccount.findById(providerId);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const request = provider.pendingZoneRequests.id(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Zone request not found' });
    }

    if (request.adminStatus !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update request status
    request.adminStatus = 'rejected';
    request.adminReviewedAt = new Date();
    request.adminReviewedBy = req.auth?.sub || 'admin';
    request.rejectionReason = reason || 'Rejected by admin';

    await provider.save();

    // Send notification
    try {
      await (await import("../../../lib/notify.js")).notify({
        recipientId: provider._id.toString(),
        recipientRole: "provider",
        title: "Zone Request Rejected",
        message: `Your zone request for "${request.zoneName}" was rejected by admin. ${reason ? `Reason: ${reason}` : ''}`,
        type: "zone_request_rejected",
        meta: { zoneName: request.zoneName, reason },
      });
    } catch (notifyError) {
      console.error('[Admin] Failed to send rejection notification:', notifyError);
    }

    res.json({ 
      success: true,
      message: `Zone request for "${request.zoneName}" rejected`
    });
  } catch (error) {
    console.error('[Admin] Failed to reject zone request:', error);
    res.status(500).json({ error: 'Failed to reject zone request' });
  }
}
