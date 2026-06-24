import Vendor from "../../../models/Vendor.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Booking from "../../../models/Booking.js";
import User from "../../../models/User.js";
import mongoose from "mongoose";
import Coupon from "../../../models/Coupon.js";
import { uploadBuffer } from "../../../startup/cloudinary.js";
import SOSAlert from "../../../models/SOSAlert.js";
import { CommissionSettings } from "../../../models/Settings.js";
import { City, Zone } from "../../../models/CityZone.js";
import { syncCityCenterFromZone } from "../../../lib/locationResolution.js";
import { validatePolygon } from "../../../lib/polygonValidation.js";

import CustomEnquiry from "../../../models/CustomEnquiry.js";
import ProviderWalletTxn from "../../../models/ProviderWalletTxn.js";
import { canAssignProviderToBooking } from "../../../lib/assignment.js";
import { providerMatchesAllServiceIds } from "../../../lib/serviceMatching.js";
import { bumpContentVersion } from "../../../lib/contentCache.js";

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
  const regex = new RegExp("^" + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
  return { $or: [{ "address.city": regex }, { "address.area": regex }, { "address.zone": regex }] };
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
  const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
  const { status, tab, search } = req.query;

  const query = { registrationComplete: true };

  // Handle both 'status' and 'tab' query params for compatibility
  const activeTab = status || tab || "all";

  if (activeTab === "active" || activeTab === "approved") {
    query.approvalStatus = "approved";
  } else if (activeTab === "pending") {
    query.approvalStatus = { $in: ["pending", "pending_vendor", "pending_admin"] };
  } else if (activeTab === "blocked") {
    query.approvalStatus = "blocked";
  } else if (activeTab === "rejected") {
    query.approvalStatus = "rejected";
  }

  if (search) {
    const searchRegex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
      { city: searchRegex }
    ];
  }

  // Fetch counts for all tabs in parallel
  let [items, filteredTotal, totalAll, activeCount, pendingCount, blockedCount] = await Promise.all([
    ProviderAccount.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ProviderAccount.countDocuments(query),
    ProviderAccount.countDocuments({ registrationComplete: true }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "approved" }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: { $in: ["pending", "pending_vendor", "pending_admin"] } }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "blocked" }),
  ]);

  // ✅ SMART RESET: If we are in a filtered tab (Active/Pending) and the page is empty,
  // serve Page 1 data immediately to avoid the 1-2 second delay/flicker.
  let effectivePage = page;
  if (activeTab !== "all" && page > 1 && (items.length === 0 || (page - 1) * limit >= filteredTotal)) {
    effectivePage = 1;
    items = await ProviderAccount.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
  }

  // ✅ ENRICH WITH DYNAMIC STATS (Proper DB calculation)
  const providerIds = items.map(p => p._id.toString());
  if (providerIds.length > 0) {
    try {
      const statsAgg = await Booking.aggregate([
        {
          $match: {
            $or: [
              { assignedProvider: { $in: providerIds } },
              { rejectedProviders: { $in: providerIds } }
            ]
          }
        },
        {
          $facet: {
            completed: [
              { $match: { status: "completed", assignedProvider: { $in: providerIds } } },
              {
                $group: {
                  _id: "$assignedProvider",
                  revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
                  commission: { $sum: { $ifNull: ["$commissionAmount", 0] } },
                  count: { $sum: 1 }
                }
              }
            ],
            cancelled: [
              { $match: { status: "cancelled", assignedProvider: { $in: providerIds } } },
              { $group: { _id: "$assignedProvider", count: { $sum: 1 } } }
            ],
            accepted: [
              {
                $match: {
                  status: { $nin: ["pending", "incoming", "unassigned", "payment_pending"] },
                  assignedProvider: { $in: providerIds },
                  lastAssignedAt: { $ne: null }
                }
              },
              {
                $group: {
                  _id: "$assignedProvider",
                  avgAcceptTimeMs: { $avg: { $subtract: ["$updatedAt", "$lastAssignedAt"] } }
                }
              }
            ],
            missed: [
              { $unwind: "$rejectedProviders" },
              { $match: { rejectedProviders: { $in: providerIds } } },
              { $group: { _id: "$rejectedProviders", count: { $sum: 1 } } }
            ]
          }
        }
      ]);

      const aggResult = statsAgg[0] || {};
      const completedMap = new Map((aggResult.completed || []).map(s => [s._id, s]));
      const cancelledMap = new Map((aggResult.cancelled || []).map(s => [s._id, s.count]));
      const acceptedMap = new Map((aggResult.accepted || []).map(s => [s._id, s.avgAcceptTimeMs]));
      const missedMap = new Map((aggResult.missed || []).map(s => [s._id, s.count]));

      items = items.map(p => {
        const pId = p._id.toString();
        const comp = completedMap.get(pId) || { revenue: 0, commission: 0, count: 0 };
        const cancCount = cancelledMap.get(pId) || 0;
        const missedCount = missedMap.get(pId) || 0;
        const avgTimeMs = acceptedMap.get(pId) || 0;

        const totalWorkHistory = comp.count + cancCount;
        const cancelRate = totalWorkHistory > 0 ? Math.round((cancCount / totalWorkHistory) * 100) : 0;
        const avgTimeMin = avgTimeMs > 0 ? Math.round(avgTimeMs / (1000 * 60)) : 0;

        return {
          ...p,
          dynamicStats: {
            bookings: comp.count || p.totalJobs || 0,
            cancelled: `${cancelRate}%`,
            missed: missedCount,
            revenue: comp.revenue,
            commission: comp.commission,
            acceptTime: avgTimeMin > 0 ? (avgTimeMin > 60 ? `${Math.round(avgTimeMin / 60)} hr` : `${avgTimeMin} min`) : "5 min"
          }
        };
      });
    } catch (err) {
      console.error("[AdminStats] Aggregation failed:", err.message);
    }
  }

  res.json({
    providers: items,
    page: effectivePage,
    limit,
    total: filteredTotal,
    totalCount: activeTab === "all" ? totalAll : filteredTotal,
    stats: {
      all: totalAll,
      active: activeCount,
      pending: pendingCount,
      blocked: blockedCount
    }
  });
}

export async function listBookings(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const { tab, search, bookingType } = req.query;

  const STATUS_GROUPS = {
    active: ["accepted", "travelling", "arrived", "in_progress"],
    pending: ["incoming", "pending", "unassigned", "payment_pending", "documentation", "vendor_assigned", "admin_approved", "user_accepted", "team_assigned", "final_approved", "advance_paid"],
    completed: ["completed"],
    missed: ["cancelled", "missed", "rejected"]
  };

  const query = {};

  // Status Group Filter (tab)
  if (tab && STATUS_GROUPS[tab]) {
    query.status = { $in: STATUS_GROUPS[tab] };
  }

  // Booking Type Filter
  if (bookingType && bookingType !== "all") {
    query.bookingType = new RegExp(bookingType, "i");
  }

  // Search Filter
  if (search) {
    const searchRegex = new RegExp(search, "i");
    const orConditions = [
      { id: searchRegex },
      { customerName: searchRegex },
      { customerPhone: searchRegex },
      { serviceType: searchRegex }
    ];
    // If search looks like a Booking ID (e.g. B-123) or is just a number
    if (mongoose.Types.ObjectId.isValid(search)) {
      orConditions.push({ _id: search });
    }
    query.$or = orConditions;
  }

  // Execute main queries in parallel
  const [items, total, statsTotal, statsActive, statsPending, statsUnassigned, statsQueued] = await Promise.all([
    Booking.find(query)
      .select("id customerId customerName customerPhone totalAmount discountPrice slot address status serviceType bookingType createdAt assignedProvider maintainProvider maintainerProvider teamMembers notificationStatus services imagesApproved prepaidAmount balanceAmount paymentStatus eventType categoryName otp")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(query),
    Booking.estimatedDocumentCount(),
    Booking.countDocuments({ status: { $in: STATUS_GROUPS.active } }),
    Booking.countDocuments({ status: { $in: STATUS_GROUPS.pending } }),
    Booking.countDocuments({ status: { $in: ["unassigned", "incoming", "pending"] } }),
    Booking.countDocuments({ notificationStatus: "queued" })
  ]);

  // Extract stats
  const stats = {
    total: statsTotal || 0,
    active: statsActive || 0,
    pending: statsPending || 0,
    unassigned: statsUnassigned || 0,
    queued: statsQueued || 0
  };

  // Enrich with provider details (Names/Phones)
  const providerIds = Array.from(new Set(
    items.flatMap(b => [b.assignedProvider, b.maintainProvider, b.maintainerProvider].filter(Boolean))
  ));

  const provMap = new Map();
  if (providerIds.length) {
    const providers = await ProviderAccount.find({ _id: { $in: providerIds } }, "name phone").lean();
    providers.forEach(p => provMap.set(p._id.toString(), p));
  }

  const enriched = items.map(b => {
    const p = provMap.get(String(b.assignedProvider || ""));
    const mp = provMap.get(String(b.maintainProvider || b.maintainerProvider || ""));
    return {
      ...b,
      // Use customerPhone already on booking to avoid redundant User lookup
      phone: b.customerPhone || "",
      assignedProviderName: p?.name || "",
      assignedProviderPhone: p?.phone || "",
      maintainProviderName: mp?.name || "",
      maintainProviderPhone: mp?.phone || ""
    };
  });

  res.json({ bookings: enriched, page, limit, total, stats });
}

export async function getAvailableProvidersForBooking(req, res) {
  const bookingId = req.params.id;
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const city = (booking.address?.city || "").trim();
  const cityId = (booking.address?.cityId || "").trim();
  const zoneId = (booking.address?.zoneId || "").trim();

  let pQuery = {
    approvalStatus: "approved",
    registrationComplete: true,
  };

  // Lenient city matching: Match by cityId OR city name
  const cityMatch = [];
  if (cityId) cityMatch.push({ cityId });
  if (city) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cityMatch.push({ city: new RegExp(escaped, "i") });
  }

  if (cityMatch.length > 0) {
    pQuery.$or = cityMatch;
  }

  // NOTE: We removed the strict zoneId filter from the query to ensure admins can see all city providers.
  // This helps when providers are misconfigured or when admins want to override zone boundaries.

  const allProviders = await ProviderAccount.find(pQuery).lean();

  const availableProviders = [];
  for (const provider of allProviders) {
    // eslint-disable-next-line no-await-in-loop
    const isAvailable = await canAssignProviderToBooking(
      provider._id.toString(),
      booking,
      { ignoreLeadTime: true, ignoreServiceWindow: true }
    );

    if (isAvailable) {
      // Check specialty match
      // eslint-disable-next-line no-await-in-loop
      const matchesSpecialty = await providerMatchesAllServiceIds(
        provider,
        (booking.services || booking.items || []).map(s => s.id).filter(Boolean)
      );

      // Check zone match
      const pZoneIds = [
        ...(provider.serviceZoneIds || []),
        ...(provider.zoneIds || []),
        provider.baseZoneId
      ].filter(Boolean).map(id => String(id));

      const inZone = zoneId ? pZoneIds.includes(zoneId) : true;

      availableProviders.push({
        _id: provider._id,
        name: provider.name,
        phone: provider.phone,
        rating: provider.rating || 0,
        totalJobs: provider.totalJobs || 0,
        credits: provider.credits || 0,
        specialties: [
          ...(provider.documents?.primaryCategory || []),
          ...(provider.documents?.specializations || []),
          ...(provider.primaryCategory || []),
          ...(provider.specializations || []),
        ],
        inZone,
        matchesSpecialty,
      });
    }
  }

  // Sort: In-Zone & Specialty Match providers first
  availableProviders.sort((a, b) => {
    if (a.inZone !== b.inZone) return a.inZone ? -1 : 1;
    if (a.matchesSpecialty !== b.matchesSpecialty) return a.matchesSpecialty ? -1 : 1;
    return (b.rating || 0) - (a.rating || 0);
  });

  res.json({ availableProviders });
}


export async function listCustomers(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 1000, 5000);
  const { search } = req.query;

  const query = {};
  if (search) {
    const searchRegex = new RegExp(String(search).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"), "i");
    query.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex }
    ];
  }

  const total = await User.countDocuments(query);
  const items = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ customers: items, page, limit, total });
}

export async function updateCustomerWallet(req, res) {
  try {
    const { id } = req.params;
    const { balance } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "Customer not found" });

    const oldBalance = Number(user.wallet?.balance || 0);
    const newBalance = Number(balance);
    const diff = newBalance - oldBalance;

    if (!user.wallet) user.wallet = { balance: 0, transactions: [] };
    user.wallet.balance = newBalance;
    user.wallet.transactions.unshift({
      title: "Admin Adjustment",
      amount: diff,
      type: diff >= 0 ? "credit" : "debit",
      balanceAfter: newBalance,
      at: new Date(),
      description: `Balance adjusted by admin from ₹${oldBalance} to ₹${newBalance}`
    });

    await user.save();
    res.json({ success: true, balance: newBalance });
  } catch (error) {
    res.status(500).json({ error: "Failed to update wallet balance" });
  }
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

  // Case-insensitive regex for city filter queries on Vendors and ProviderAccounts
  const cityQuery = city ? { city: new RegExp("^" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } : {};

  // Case-insensitive regex for city filter queries on Users (via their addresses)
  const userCityQuery = city ? { "addresses.city": new RegExp("^" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") } : {};
  let userQuery = { ...userCityQuery };
  if (!isOverall) {
    userQuery.createdAt = { $gte: start, $lt: end };
  }

  const [vendorCount, totalSPs, activeSPs, pendingSPs, commissionSettings, bookingAgg, sosCount, activeZones, customerCount] = await Promise.all([
    Vendor.countDocuments(cityQuery),
    ProviderAccount.countDocuments({ registrationComplete: true, ...cityQuery }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "approved", ...cityQuery }),
    ProviderAccount.countDocuments({ registrationComplete: true, approvalStatus: "pending", ...cityQuery }),
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
          zones: [
            {
              $addFields: {
                zone: {
                  $cond: [
                    { $and: [{ $ne: ["$address.zone", null] }, { $ne: ["$address.zone", ""] }] },
                    "$address.zone",
                    {
                      $cond: [
                        { $and: [{ $ne: ["$address.area", null] }, { $ne: ["$address.area", ""] }] },
                        "$address.area",
                        "$address.city",
                      ],
                    },
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
    // Fetch active zones
    (async () => {
      try {
        if (city) {
          const cityDoc = await City.findOne({ name: new RegExp("^" + city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") }).lean();
          if (cityDoc) {
            return await Zone.find({ city: cityDoc._id, status: "active" }).lean();
          }
          return [];
        }
        return await Zone.find({ status: "active" }).lean();
      } catch (err) {
        console.error("[metricsOverview] Failed to fetch active zones:", err.message);
        return [];
      }
    })(),
    User.countDocuments(userQuery)
  ]);

  const f = (Array.isArray(bookingAgg) && bookingAgg[0]) ? bookingAgg[0] : {};
  const totalBookings = Number(f?.totals?.[0]?.count || 0);
  const activeBookings = Number(f?.active?.[0]?.count || 0);
  const totalRevenue = Number(f?.completedRevenue?.[0]?.revenue || 0);
  const cancelledCount = Number(f?.cancelled?.[0]?.count || 0);

  // Map and combine zones case-insensitively using activeZones
  const processedZonesMap = new Map();
  if (activeZones && activeZones.length > 0) {
    const activeZoneMap = new Map();
    activeZones.forEach(z => {
      if (z.name) {
        activeZoneMap.set(z.name.toLowerCase().trim(), z.name.trim());
      }
    });

    // Initialize all active zones with 0 count
    for (const officialName of activeZoneMap.values()) {
      processedZonesMap.set(officialName, 0);
    }

    if (Array.isArray(f?.zones)) {
      f.zones.forEach(z => {
        const rawZone = String(z._id || "").toLowerCase().trim();
        if (activeZoneMap.has(rawZone)) {
          const officialName = activeZoneMap.get(rawZone);
          processedZonesMap.set(officialName, (processedZonesMap.get(officialName) || 0) + z.count);
        }
      });
    }
  } else {
    // Fallback: combine raw zones case-insensitively if activeZones list is empty or fails
    if (Array.isArray(f?.zones)) {
      const rawToDisplay = new Map(); // lowercase -> original case
      f.zones.forEach(z => {
        const name = String(z._id || "").trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (!rawToDisplay.has(lower)) {
          rawToDisplay.set(lower, name);
        }
        const officialName = rawToDisplay.get(lower);
        processedZonesMap.set(officialName, (processedZonesMap.get(officialName) || 0) + z.count);
      });
    }
  }

  const zones = Array.from(processedZonesMap.entries())
    .sort((a, b) => b[1] - a[1]);

  const ratePct = Math.max(0, Number(commissionSettings?.rate ?? 15));
  const commissionEarned = Math.round(totalRevenue * (ratePct / 100));

  // --- GROWTH TREND CALCULATION ---
  let trends = { revenue: 0, bookings: 0, customers: 0, commission: 0 };
  if (!isOverall) {
    const prevPeriod = addMonths(period, -1);
    const { start: prevStart, end: prevEnd } = monthRangeUtc(prevPeriod, tz);

    const prevBookingMatch = { ...cityPredicate(city), createdAt: { $gte: prevStart, $lt: prevEnd } };
    const prevUserQuery = { ...userCityQuery, createdAt: { $gte: prevStart, $lt: prevEnd } };

    const [prevAgg, prevCustomers] = await Promise.all([
      Booking.aggregate([
        { $match: prevBookingMatch },
        {
          $facet: {
            totals: [{ $count: "count" }],
            completedRevenue: [
              { $match: { status: "completed" } },
              { $group: { _id: null, revenue: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
            ],
          },
        },
      ]),
      User.countDocuments(prevUserQuery)
    ]);

    const p = (Array.isArray(prevAgg) && prevAgg[0]) ? prevAgg[0] : {};
    const prevBookings = Number(p?.totals?.[0]?.count || 0);
    const prevRevenue = Number(p?.completedRevenue?.[0]?.revenue || 0);
    const prevCommission = Math.round(prevRevenue * (ratePct / 100));

    const calcGrowth = (curr, prev) => {
      if (!prev || prev <= 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    trends = {
      revenue: calcGrowth(totalRevenue, prevRevenue),
      bookings: calcGrowth(totalBookings, prevBookings),
      customers: calcGrowth(customerCount, prevCustomers),
      commission: calcGrowth(commissionEarned, prevCommission),
    };
  }

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
      zones,
      trends,
      commissionRate: ratePct,
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

  const userCityQuery = city ? { "addresses.city": new RegExp("^" + city.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "$", "i") } : {};

  const agg = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startRange, $lt: endRange },
        ...userCityQuery,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tz } },
        customers: { $sum: 1 },
      },
    },
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

  const cityQuery = city ? { city: new RegExp("^" + city.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "$", "i") } : {};

  const agg = await ProviderAccount.aggregate([
    {
      $match: {
        createdAt: { $gte: startRange, $lt: endRange },
        registrationComplete: true,
        ...cityQuery,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: tz } },
        providers: { $sum: 1 },
      },
    },
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
  const cityDocs = await City.find().sort({ name: 1 }).lean();

  const set = new Set();
  for (const cDoc of cityDocs || []) {
    if (cDoc.name) {
      const s = String(cDoc.name).trim();
      if (s) set.add(s);
    }
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
  const { totalAmount, discountPrice, notes, items, prebookAmount, totalServiceTime, quoteExpiryHours } = req.body;

  const enq = await CustomEnquiry.findById(req.params.id);
  if (!enq) return res.status(404).json({ error: "Not found" });

  let expiryAt = null;
  if (quoteExpiryHours) {
    const hours = Number(quoteExpiryHours);
    if (Number.isFinite(hours) && hours > 0) {
      expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }

  enq.quote = {
    ...(enq.quote || {}),
    totalAmount: Number(totalAmount) || 0,
    discountPrice: Number(discountPrice) || 0,
    notes: notes || enq.quote?.notes || "",
    prebookAmount: Number(prebookAmount) || enq.quote?.prebookAmount || 0,
    totalServiceTime: String(totalServiceTime || enq.quote?.totalServiceTime || ""),
    expiryAt: expiryAt || enq.quote?.expiryAt || null,
    items: Array.isArray(items) ? items : (enq.quote?.items?.length ? enq.quote.items : enq.items),
  };

  enq.status = "admin_approved";
  enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
  enq.timeline.push({
    at: new Date(),
    action: "admin_approved",
    meta: { totalAmount: enq.quote.totalAmount, discountPrice: enq.quote.discountPrice }
  });

  await enq.save();

  try {
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      type: "custom_quote_submitted",
      meta: { enquiryId: enq._id?.toString?.() },
    });
  } catch { }

  res.json({ enquiry: enq });
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
  const { name, mapCenterLat, mapCenterLng, mapZoom, activeVendorId } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const city = await City.create({
    name,
    mapCenterLat: Number.isFinite(Number(mapCenterLat)) ? Number(mapCenterLat) : null,
    mapCenterLng: Number.isFinite(Number(mapCenterLng)) ? Number(mapCenterLng) : null,
    mapZoom: Number.isFinite(Number(mapZoom)) ? Number(mapZoom) : 12,
    activeVendorId: String(activeVendorId || "").trim(),
  });
  res.json({ city });
}

export async function listZones(req, res) {
  const { cityId } = req.params;
  const zones = await Zone.find({ city: cityId }).populate("city").sort({ name: 1 }).lean();
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

  // Validate coordinates if provided
  if (coordinates !== undefined && coordinates !== null) {
    // Flexible validation: 3-10 points
    const MIN_POINTS = 3;
    const MAX_POINTS = 10;

    if (!Array.isArray(coordinates)) {
      return res.status(400).json({
        error: "Coordinates must be an array"
      });
    }

    if (coordinates.length < MIN_POINTS || coordinates.length > MAX_POINTS) {
      return res.status(400).json({
        error: `Coordinates must have between ${MIN_POINTS} and ${MAX_POINTS} points. Received: ${coordinates.length}`
      });
    }

    // Validate each coordinate format
    for (let i = 0; i < coordinates.length; i++) {
      if (!isValidCoordinate(coordinates[i])) {
        return res.status(400).json({
          error: `Invalid coordinate format at point ${i + 1}`
        });
      }
    }

    // Validate polygon geometry
    const validation = validatePolygon(coordinates);
    if (!validation.isValid) {
      return res.status(400).json({
        error: "Invalid polygon geometry",
        details: validation.errors,
        area: validation.areaKm,
        perimeter: validation.perimeterKm
      });
    }

    // Log zone metrics for monitoring
    console.log(`[Zone Create] ${name}:`, {
      points: coordinates.length,
      area: `${validation.areaKm} km²`,
      perimeter: `${validation.perimeterKm} km`
    });
  }

  // Create zone with optional coordinates
  const zone = await Zone.create({
    name,
    city: cityId,
    ...(coordinates && { coordinates }) // Only include if provided
  });
  if (coordinates) await syncCityCenterFromZone(cityId, coordinates);

  // Trigger notifications for providers in this city
  setImmediate(() => {
    notifyProvidersOfNewZone(cityId, name).catch(err =>
      console.error("[AdminController] Async notification failed:", err.message)
    );
  });

  res.json({ zone });
}

/**
 * Internal helper to notify all approved providers in a city about a new zone.
 */
async function notifyProvidersOfNewZone(cityId, zoneName, excludeId = null) {
  try {
    const { notifyMany } = await import("../../../lib/notify.js");
    // Find all approved providers in this city
    const query = {
      cityId: String(cityId),
      approvalStatus: "approved",
      registrationComplete: true
    };
    if (excludeId) query._id = { $ne: excludeId };

    console.log(`[AdminController] Looking for providers in cityId: ${cityId} to notify about zone: ${zoneName}`);
    const providers = await ProviderAccount.find(query, "_id").lean();

    if (providers.length > 0) {
      const recipientIds = providers.map(p => String(p._id));
      console.log(`[AdminController] Found ${providers.length} providers. IDs:`, recipientIds);
      await notifyMany(recipientIds, {
        recipientRole: "provider",
        type: "zone_added",
        meta: { zoneName, cityId },
        emit: true
      });
      console.log(`[AdminController] Notified providers about new zone: ${zoneName}`);
    } else {
      console.log(`[AdminController] No matching providers found for cityId: ${cityId}`);
    }
  } catch (err) {
    console.error("[AdminController] Error notifying providers of new zone:", err);
  }
}

export async function updateCity(req, res) {
  const { cityId } = req.params;
  const { name, mapCenterLat, mapCenterLng, mapZoom, activeVendorId } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const city = await City.findByIdAndUpdate(cityId, {
    name,
    ...(mapCenterLat !== undefined ? { mapCenterLat: Number.isFinite(Number(mapCenterLat)) ? Number(mapCenterLat) : null } : {}),
    ...(mapCenterLng !== undefined ? { mapCenterLng: Number.isFinite(Number(mapCenterLng)) ? Number(mapCenterLng) : null } : {}),
    ...(mapZoom !== undefined ? { mapZoom: Number.isFinite(Number(mapZoom)) ? Number(mapZoom) : 12 } : {}),
    ...(activeVendorId !== undefined ? { activeVendorId: String(activeVendorId || "").trim() } : {}),
  }, { new: true });
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

  // Validate and include coordinates if provided
  if (coordinates !== undefined) {
    if (coordinates === null) {
      updates.coordinates = null; // Allow clearing coordinates
    } else {
      // Flexible validation: 3-10 points
      const MIN_POINTS = 3;
      const MAX_POINTS = 10;

      if (!Array.isArray(coordinates)) {
        return res.status(400).json({
          error: "Coordinates must be an array"
        });
      }

      if (coordinates.length < MIN_POINTS || coordinates.length > MAX_POINTS) {
        return res.status(400).json({
          error: `Coordinates must have between ${MIN_POINTS} and ${MAX_POINTS} points. Received: ${coordinates.length}`
        });
      }

      // Validate each coordinate format
      for (let i = 0; i < coordinates.length; i++) {
        if (!isValidCoordinate(coordinates[i])) {
          return res.status(400).json({
            error: `Invalid coordinate format at point ${i + 1}`
          });
        }
      }

      // Validate polygon geometry
      const validation = validatePolygon(coordinates);
      if (!validation.isValid) {
        return res.status(400).json({
          error: "Invalid polygon geometry",
          details: validation.errors,
          area: validation.areaKm,
          perimeter: validation.perimeterKm
        });
      }

      updates.coordinates = coordinates;

      // Log zone metrics for monitoring
      console.log(`[Zone Update] ${name || zoneId}:`, {
        points: coordinates.length,
        area: `${validation.areaKm} km²`,
        perimeter: `${validation.perimeterKm} km`
      });
    }
  }

  const zone = await Zone.findByIdAndUpdate(zoneId, updates, { new: true });
  if (!zone) return res.status(404).json({ error: "Zone not found" });
  if (updates.coordinates) await syncCityCenterFromZone(zone.city?.toString?.() || zone.city, updates.coordinates);

  res.json({ zone });
}

export async function deleteZone(req, res) {
  const { zoneId } = req.params;

  // 1. Fetch zone details first to get the name (needed for cleanup in string-based arrays)
  const zone = await Zone.findById(zoneId);
  if (!zone) return res.status(404).json({ error: "Zone not found" });

  const zoneName = zone.name;

  // 2. Delete the zone
  await Zone.findByIdAndDelete(zoneId);

  // 3. Cleanup ProviderAccount references
  // Pull from arrays
  await ProviderAccount.updateMany(
    {
      $or: [
        { zones: zoneName },
        { zoneIds: zoneId },
        { pendingZones: zoneName },
        { serviceZoneIds: zoneId },
        { "pendingZoneRequests.resolvedZoneId": zoneId },
        { "pendingZoneRequests.zoneName": zoneName }
      ]
    },
    {
      $pull: {
        zones: zoneName,
        zoneIds: zoneId,
        pendingZones: zoneName,
        serviceZoneIds: zoneId,
        pendingZoneRequests: {
          $or: [
            { resolvedZoneId: zoneId },
            { zoneName: zoneName }
          ]
        }
      }
    }
  );

  // Reset baseZoneId if it matches the deleted zone
  await ProviderAccount.updateMany({ baseZoneId: zoneId }, { $set: { baseZoneId: "" } });

  // 4. Cleanup Vendor references
  // Pull from arrays
  await Vendor.updateMany(
    {
      $or: [
        { zones: zoneName },
        { zoneIds: zoneId },
        { pendingZones: zoneName }
      ]
    },
    {
      $pull: {
        zones: zoneName,
        zoneIds: zoneId,
        pendingZones: zoneName
      }
    }
  );

  // Reset baseZoneId if it matches the deleted zone
  await Vendor.updateMany({ baseZoneId: zoneId }, { $set: { baseZoneId: "" } });

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
  const filter = { status: "completed", onlineAmountPaid: { $gt: 0 } }; // Only completed bookings with online payment are eligible for payouts

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
    amount: b.onlineAmountPaid || b.totalAmount || 0,
    status: b.payoutStatus || "pending",
    payoutProof: b.payoutProof || "",
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

export async function listRecharges(req, res) {
  try {
    const { city, startDate, endDate, query: searchParam } = req.query;
    
    let spQuery = {};
    if (city && city !== "All Cities") spQuery.city = city;
    
    let validProviderIds = null;
    if (searchParam || Object.keys(spQuery).length > 0) {
        if (searchParam) {
            spQuery.$or = [
                { name: { $regex: new RegExp(searchParam, "i") } },
                { phone: { $regex: new RegExp(searchParam, "i") } },
                { email: { $regex: new RegExp(searchParam, "i") } }
            ];
        }
        const providers = await ProviderAccount.find(spQuery, "_id name city phone").lean();
        validProviderIds = providers.map(p => p._id.toString());
    }

    const q = { type: "recharge" };
    if (validProviderIds !== null) {
        if (validProviderIds.length === 0) {
            return res.json({ recharges: [] });
        }
        q.providerId = { $in: validProviderIds };
    }
    
    if (startDate || endDate) {
        q.createdAt = {};
        if (startDate) q.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const ed = new Date(endDate);
            ed.setHours(23, 59, 59, 999);
            q.createdAt.$lte = ed;
        }
    }
    
    const txns = await ProviderWalletTxn.find(q).sort({ createdAt: -1 }).limit(100).lean();
    
    const pIds = [...new Set(txns.map(t => t.providerId))];
    const sps = await ProviderAccount.find({ _id: { $in: pIds } }, "name city phone").lean();
    const spMap = sps.reduce((acc, p) => {
        acc[p._id.toString()] = p;
        return acc;
    }, {});
    
    const enriched = txns.map(t => ({
        id: t._id,
        spName: spMap[t.providerId]?.name || "Unknown Provider",
        city: spMap[t.providerId]?.city || "N/A",
        phone: spMap[t.providerId]?.phone || "N/A",
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        date: t.createdAt,
        meta: t.meta || {}
    }));
    
    res.json({ recharges: enriched });
  } catch (error) {
    console.error("[Admin] Fetch Wallet Recharges Error:", error);
    res.status(500).json({ error: "Failed to fetch recharges" });
  }
}

export async function updatePayoutStatus(req, res) {
  const { id } = req.params;
  const { status, payoutProof } = req.body;

  if (!["pending", "completed", "on_hold"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  let updates = { payoutStatus: status };

  if (payoutProof && payoutProof.startsWith("data:image")) {
    try {
      const { uploadBase64Image } = await import("../../../startup/cloudinary.js");
      updates.payoutProof = await uploadBase64Image(payoutProof, "payouts");
    } catch (err) {
      console.error("[Payout] Error uploading proof:", err);
      return res.status(500).json({ error: "Failed to upload payout proof" });
    }
  }

  const b = await Booking.findByIdAndUpdate(id, updates, { new: true });
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

    // Dynamically populate provider names if missing or set to default "Provider"
    const providerIds = [...new Set(feedbacks.filter(f => (!f.providerName || f.providerName === "Provider") && f.providerId).map(f => f.providerId))];
    if (providerIds.length > 0) {
      const providers = await ProviderAccount.find({ _id: { $in: providerIds } }, "name").lean();
      const provMap = new Map(providers.map(p => [p._id.toString(), p.name]));
      feedbacks.forEach(f => {
        if ((!f.providerName || f.providerName === "Provider") && f.providerId) {
          f.providerName = provMap.get(f.providerId) || f.providerName || "Unknown Provider";
        }
      });
    }

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
    }).select('name phone address currentLocation city cityId pendingZoneRequests').lean();

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
            providerCityId: provider.cityId || "",
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

    // Validate coordinates (flexible: 3-10 points)
    const MIN_POINTS = 3;
    const MAX_POINTS = 10;

    if (!Array.isArray(coordinates) ||
      coordinates.length < MIN_POINTS ||
      coordinates.length > MAX_POINTS) {
      return res.status(400).json({
        error: `Coordinates must have between ${MIN_POINTS} and ${MAX_POINTS} points. Received: ${coordinates?.length || 0}`
      });
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
    await syncCityCenterFromZone(cityId, coordinates);

    // Update request status
    request.adminStatus = 'approved';
    request.adminReviewedAt = new Date();
    request.adminReviewedBy = req.auth?.sub || 'admin';

    // Add zone to provider's zones array
    if (!provider.zones.includes(zoneName)) {
      provider.zones.push(zoneName);
    }
    if (!provider.zoneIds?.includes(zone._id.toString())) {
      provider.zoneIds = Array.isArray(provider.zoneIds) ? provider.zoneIds : [];
      provider.zoneIds.push(zone._id.toString());
    }
    provider.cityId = String(cityId || provider.cityId || "");

    await provider.save();

    // Trigger notifications for other providers in this city
    setImmediate(() => {
      notifyProvidersOfNewZone(cityId, zoneName, provider._id).catch(err =>
        console.error("[AdminController] Async notification failed:", err.message)
      );
    });

    // Send notifications to the requesting provider
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

    // ✅ Clear public content cache (for new zone availability)
    await bumpContentVersion();

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

export async function updateProviderProfile(req, res) {
  try {
    const { id } = req.params;

    const provider = await ProviderAccount.findById(id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const oldServices = provider.documents?.services || [];
    const oldZones = provider.serviceZoneIds || [];

    const { primaryCategory, specializations, services, serviceZoneIds, zones } = req.body;

    const updates = {};
    if (Array.isArray(primaryCategory)) updates["documents.primaryCategory"] = primaryCategory;
    if (Array.isArray(specializations)) updates["documents.specializations"] = specializations;
    if (Array.isArray(services)) updates["documents.services"] = services;

    if (Array.isArray(serviceZoneIds)) updates.serviceZoneIds = serviceZoneIds;
    if (Array.isArray(zones)) updates.zones = zones;

    const updatedProvider = await ProviderAccount.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    // Send notification if services or zones were changed
    const servicesChanged = Array.isArray(services) && JSON.stringify(oldServices) !== JSON.stringify(services);
    const zonesChanged = Array.isArray(serviceZoneIds) && JSON.stringify(oldZones) !== JSON.stringify(serviceZoneIds);

    if (servicesChanged || zonesChanged) {
      try {
        const { notify } = await import("../../../lib/notify.js");
        await notify({
          recipientId: id,
          recipientRole: "provider",
          title: "Profile Updated",
          message: `Admin has updated your professional profile ${zonesChanged ? "and service zones" : ""}. Please check your active services and working areas.`,
          type: "marketing_campaign",
          meta: {
            servicesUpdated: servicesChanged,
            zonesUpdated: zonesChanged
          }
        });
      } catch (notifyErr) {
        console.error("[Admin] Failed to send profile update notification:", notifyErr);
      }
    }

    // ✅ Clear public content cache so Muskan shows up immediately
    await bumpContentVersion();

    res.json({ success: true, provider: updatedProvider });
  } catch (error) {
    console.error("[Admin] Failed to update provider profile:", error);

    // Handle Mongoose validation or cast errors with 400 Bad Request
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid profile data provided",
        details: error.message
      });
    }

    res.status(500).json({ error: "Failed to update provider profile" });
  }
}

export async function updateProviderProfilePhoto(req, res) {
  try {
    console.log("[Admin] Profile photo update request received");
    console.log("[Admin] Provider ID:", req.params.id);
    console.log("[Admin] File received:", !!req.file);

    const { id } = req.params;

    // Validate provider exists
    const provider = await ProviderAccount.findById(id);
    if (!provider) {
      console.log("[Admin] Provider not found:", id);
      return res.status(404).json({ error: "Provider not found" });
    }

    // Validate file upload
    if (!req.file) {
      console.log("[Admin] No file in request");
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log("[Admin] Uploading to Cloudinary...");
    // Upload to Cloudinary
    const folder = `providers/${id}/profile`;
    const uploadResult = await uploadBuffer(req.file.buffer, folder);
    console.log("[Admin] Cloudinary upload successful:", uploadResult.secure_url);

    // Update provider profile photo
    provider.profilePhoto = uploadResult.secure_url;
    await provider.save();
    console.log("[Admin] Provider updated in database");

    // Send notification to provider
    try {
      const { notify } = await import("../../../lib/notify.js");
      await notify({
        recipientId: id,
        recipientRole: "provider",
        title: "Profile Photo Updated",
        message: "Admin has updated your profile photo.",
        type: "profile_updated",
        meta: { updatedBy: "admin" }
      });
      console.log("[Admin] Notification sent to provider");
    } catch (notifyErr) {
      console.error("[Admin] Failed to send photo update notification:", notifyErr);
    }

    const responseData = {
      success: true,
      profilePhoto: provider.profilePhoto,
      provider: {
        id: provider._id,
        name: provider.name,
        profilePhoto: provider.profilePhoto
      }
    };
    // ✅ Clear public content cache
    await bumpContentVersion();

    console.log("[Admin] Sending success response:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("[Admin] Failed to update provider profile photo:", error);
    res.status(500).json({ error: "Failed to update profile photo" });
  }
}

export async function adjustProviderWallet(req, res) {
  const { id } = req.params;
  const { amount, type, reason } = req.body;
  const numAmount = Math.abs(Number(amount));

  if (!numAmount || isNaN(numAmount)) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const p = await ProviderAccount.findById(id);
  if (!p) return res.status(404).json({ error: "Provider not found" });

  const oldCredits = Number(p.credits || 0);
  if (type === "add") {
    p.credits = oldCredits + numAmount;
  } else {
    p.credits = Math.max(0, oldCredits - numAmount);
  }

  await p.save();

  await ProviderWalletTxn.create({
    providerId: p._id.toString(),
    type: type === "add" ? "admin_credit" : "admin_debit",
    amount: type === "add" ? numAmount : -numAmount,
    balanceAfter: p.credits,
    meta: {
      title: reason || (type === "add" ? "Manual Credit by Admin" : "Manual Debit by Admin"),
      source: "admin_adjustment",
      adjustedBy: "Super Admin", // Could use req.auth.sub if name is available
    },
  });

  res.json({ success: true, credits: p.credits, provider: p });
}

export async function approveBookingImages(req, res) {
  const { id } = req.params;
  const { approved } = req.body;

  try {
    const b = await Booking.findByIdAndUpdate(id, { imagesApproved: !!approved }, { new: true });
    if (!b) return res.status(404).json({ error: "Booking not found" });
    res.json({ success: true, booking: b });
  } catch (error) {
    console.error("[Admin] Failed to approve images:", error);
    res.status(500).json({ error: "Failed to approve images" });
  }
}

export async function updateProviderGrade(req, res) {
  try {
    const { id } = req.params;
    const { grade } = req.body;

    const allowedGrades = ["A", "B", "C", "D", "Standard", null];
    if (!allowedGrades.includes(grade)) {
      return res.status(400).json({ error: "Invalid grade value" });
    }

    const provider = await ProviderAccount.findByIdAndUpdate(
      id,
      { grade },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    // Send notification
    try {
      const { notify } = await import("../../../lib/notify.js");
      await notify({
        recipientId: id,
        recipientRole: "provider",
        title: "Performance Grade Updated",
        message: `Admin has updated your performance grade to ${grade || "Standard"}.`,
        type: "profile_updated",
        meta: { grade }
      });
    } catch (notifyErr) {
      console.error("[Admin] Failed to send grade update notification:", notifyErr);
    }

    // ✅ Clear public content cache
    await bumpContentVersion();

    res.json({ success: true, provider });
  } catch (error) {
    console.error("[Admin] Failed to update provider grade:", error);
    res.status(500).json({ error: "Failed to update provider grade" });
  }
}

export async function listPendingCategoryRequests(req, res) {
  try {
    const providers = await ProviderAccount.find({
      "pendingCategoryRequests.status": "pending"
    }).select("name phone profilePhoto pendingCategoryRequests").lean();

    const flat = [];
    providers.forEach(p => {
      (p.pendingCategoryRequests || []).forEach(r => {
        if (r.status === "pending") {
          flat.push({
            ...r,
            providerId: p._id.toString(),
            providerName: p.name,
            providerPhone: p.phone,
            providerPhoto: p.profilePhoto,
            requestId: r._id.toString()
          });
        }
      });
    });

    res.json({ requests: flat });
  } catch (error) {
    res.status(500).json({ error: "Failed to list category requests" });
  }
}

export async function approveCategoryRequest(req, res) {
  try {
    const { providerId, requestId } = req.body;
    const provider = await ProviderAccount.findById(providerId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const request = provider.pendingCategoryRequests.id(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    // Atomically update both the request status and the provider's category list
    const updatedProvider = await ProviderAccount.findByIdAndUpdate(
      providerId,
      {
        $set: {
          "pendingCategoryRequests.$[elem].status": "approved",
          "pendingCategoryRequests.$[elem].adminReviewedAt": new Date(),
          "pendingCategoryRequests.$[elem].adminReviewedBy": req.auth?.sub || "admin"
        },
        $addToSet: { "documents.primaryCategory": request.categoryName }
      },
      {
        arrayFilters: [{ "elem._id": requestId }],
        new: true
      }
    );

    if (!updatedProvider) return res.status(500).json({ error: "Failed to update provider" });

    // Notify
    try {
      const { notify } = await import("../../../lib/notify.js");
      await notify({
        recipientId: providerId,
        recipientRole: "provider",
        title: "Category Request Approved",
        message: `Your request for category "${request.categoryName}" has been approved.`,
        type: "system"
      });
    } catch { }

    // ✅ Clear public content cache
    await bumpContentVersion();

    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve category request" });
  }
}

export async function rejectCategoryRequest(req, res) {
  try {
    const { providerId, requestId, reason } = req.body;
    const provider = await ProviderAccount.findById(providerId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const request = provider.pendingCategoryRequests.id(requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = "rejected";
    request.rejectionReason = reason || "Rejected by admin";
    request.adminReviewedAt = new Date();
    request.adminReviewedBy = req.auth?.sub || "admin";

    await provider.save();

    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject category request" });
  }
}

