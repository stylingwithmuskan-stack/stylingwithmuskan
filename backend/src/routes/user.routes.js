import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { uploadBuffer } from "../startup/cloudinary.js";
import Coupon from "../models/Coupon.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import User from "../models/User.js";
import { ReferralSettings } from "../models/Settings.js";
import { getSubscriptionSnapshot, isEliteProvider } from "../lib/subscriptions.js";
import { ensureCityAndZoneNames, resolveServiceLocation } from "../lib/locationResolution.js";
import { providerMatchesRequestedSpecialties, resolveRequestedSpecialtySets } from "../lib/serviceMatching.js";
import { Zone } from "../models/CityZone.js";

const router = Router();

function providerCard(p) {
  return {
    id: p._id?.toString(),
    name: p.name || "",
    profilePhoto: p.profilePhoto || "",
    rating: Number(p.rating || 0),
    experience: p.experience || "",
    totalJobs: Number(p.totalJobs || 0),
    city: p.city || "",
    specialties: Array.isArray(p?.documents?.specializations) ? p.documents.specializations : [],
    isPro: !!p.isPro,
    isElite: !!p.isElite,
    categories: Array.isArray(p.documents?.primaryCategory) ? p.documents.primaryCategory : [],
  };
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function normalizeResolvedAddress(input = {}) {
  const addr = {
    houseNo: input.houseNo,
    area: input.area,
    landmark: input.landmark || "",
    city: String(input.city || "").trim(),
    cityId: String(input.cityId || "").trim(),
    zone: String(input.zone || "").trim(),
    zoneId: String(input.zoneId || "").trim(),
    type: input.type || "home",
    lat: (input.lat !== undefined && input.lat !== null && input.lat !== "") ? Number(input.lat) : null,
    lng: (input.lng !== undefined && input.lng !== null && input.lng !== "") ? Number(input.lng) : null,
    insideServiceArea: true,
    resolvedAt: null,
  };

  if (addr.lat === 0 && addr.lng === 0) {
    addr.lat = null;
    addr.lng = null;
  }

  if (Number.isFinite(addr.lat) && Number.isFinite(addr.lng)) {
    const resolved = await resolveServiceLocation({
      lat: addr.lat,
      lng: addr.lng,
      cityId: addr.cityId,
      cityName: addr.city,
    });
    addr.city = resolved.cityName || addr.city;
    addr.cityId = resolved.cityId || addr.cityId;
    addr.zone = resolved.zoneName || addr.zone;
    addr.zoneId = resolved.zoneId || addr.zoneId;
    addr.insideServiceArea = !!resolved.insideServiceArea;
    addr.resolvedAt = new Date();
  } else {
    const byName = await ensureCityAndZoneNames({
      cityId: addr.cityId,
      cityName: addr.city,
      zoneId: addr.zoneId,
      zoneName: addr.zone,
    });
    addr.city = byName.cityName || addr.city;
    addr.cityId = byName.cityId || addr.cityId;
    addr.zone = byName.zoneName || addr.zone;
    addr.zoneId = byName.zoneId || addr.zoneId;

    // Fallback coordinates if missing
    if (addr.zoneId && (!addr.lat || !addr.lng)) {
      console.log(`[normalizeResolvedAddress] Missing coords for zone: ${addr.zoneId}, attempting fallback...`);
      try {
        const zoneDoc = await Zone.findById(addr.zoneId).lean();
        if (zoneDoc) {
          console.log(`[normalizeResolvedAddress] Found zone: ${zoneDoc.name}, coords:`, zoneDoc.coordinates);
          if (Array.isArray(zoneDoc.coordinates) && zoneDoc.coordinates.length > 0) {
            const valid = zoneDoc.coordinates.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number');
            if (valid.length > 0) {
              addr.lat = valid.reduce((sum, c) => sum + c.lat, 0) / valid.length;
              addr.lng = valid.reduce((sum, c) => sum + c.lng, 0) / valid.length;
              addr.resolvedAt = new Date();
              console.log(`[normalizeResolvedAddress] Fallback success: ${addr.lat}, ${addr.lng}`);
            } else {
              console.log(`[normalizeResolvedAddress] No valid coords in zone doc`);
            }
          } else {
            console.log(`[normalizeResolvedAddress] Zone doc has no coordinates array`);
          }
        } else {
          console.log(`[normalizeResolvedAddress] Zone doc NOT found for ID: ${addr.zoneId}`);
        }
      } catch (err) {
        console.error("[normalizeResolvedAddress] Fallback error:", err);
      }
    }
  }

  return addr;
}

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user;
  const subscription = await getSubscriptionSnapshot(u._id.toString(), "customer");
  res.json({
    user: {
      id: u._id,
      phone: u.phone,
      email: u.email || "",
      name: u.name,
      avatar: u.avatar || "",
      referralCode: u.referralCode,
      isVerified: u.isVerified,
      addresses: u.addresses,
      subscription,
      isPlusMember: subscription.isPlusMember,
      plusExpiry: subscription.currentPeriodEnd,
      plusPlan: subscription.planId,
    },
  });
});

router.patch(
  "/me",
  requireAuth,
    body("name").optional().isString().isLength({ min: 1, max: 80 }),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("referralCode").optional().isString().isLength({ max: 32 }),
    body("avatar").optional().isString(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      
      const u = req.user;
      if (req.body.name !== undefined) u.name = String(req.body.name).trim();
      if (req.body.email !== undefined) u.email = String(req.body.email).trim().toLowerCase();
      if (req.body.referralCode !== undefined) u.referralCode = String(req.body.referralCode).trim();
      if (req.body.avatar !== undefined) u.avatar = req.body.avatar;
    
      await u.save();
      const subscription = await getSubscriptionSnapshot(u._id.toString(), "customer");
    res.json({
      success: true,
      user: {
        ...u.toObject(),
        subscription,
        isPlusMember: subscription.isPlusMember,
        plusExpiry: subscription.currentPeriodEnd,
        plusPlan: subscription.planId,
      },
    });
  }
);

router.get("/me/addresses", requireAuth, async (req, res) => {
  res.json({ addresses: req.user.addresses });
});

router.post("/me/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const up = await uploadBuffer(req.file.buffer, `users/${req.user._id}/avatar`);
  req.user.avatar = up.secure_url;
  await req.user.save();
  res.json({ avatar: req.user.avatar, user: req.user });
});

router.post(
  "/me/addresses",
  requireAuth,
  body("houseNo").isString().notEmpty(),
  body("area").isString().notEmpty(),
  body("landmark").optional().isString(),
  body("type").optional().isIn(["home", "work", "other"]),
  body("lat").optional().isFloat({ min: -90, max: 90 }),
  body("lng").optional().isFloat({ min: -180, max: 180 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const addr = {
      houseNo: req.body.houseNo,
      area: req.body.area,
      landmark: req.body.landmark || "",
      city: String(req.body.city || "").trim(),
      cityId: String(req.body.cityId || "").trim(),
      zone: String(req.body.zone || "").trim(),
      zoneId: String(req.body.zoneId || "").trim(),
      type: req.body.type || "home",
      lat: (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== "") ? Number(req.body.lat) : null,
      lng: (req.body.lng !== undefined && req.body.lng !== null && req.body.lng !== "") ? Number(req.body.lng) : null,
    };
    const normalizedAddr = await normalizeResolvedAddress(addr);
    if (Number.isFinite(normalizedAddr.lat) && Number.isFinite(normalizedAddr.lng) && !normalizedAddr.insideServiceArea) {
      return res.status(400).json({
        error: "Service is not available at your current location yet.",
        code: "OUT_OF_ZONE",
        address: normalizedAddr,
      });
    }
    req.user.addresses.unshift(normalizedAddr);
    await req.user.save();
    res.status(201).json({ address: req.user.addresses[0], addresses: req.user.addresses });
  }
);

router.delete(
  "/me/addresses/:id",
  requireAuth,
  param("id").isString(),
  async (req, res) => {
    const id = req.params.id;
    req.user.addresses = req.user.addresses.filter((a) => a._id.toString() !== id);
    await req.user.save();
    res.json({ addresses: req.user.addresses });
  }
);

router.patch(
  "/me/addresses/:id",
  requireAuth,
  param("id").isString(),
  body("houseNo").optional().isString().notEmpty(),
  body("area").optional().isString().notEmpty(),
  body("landmark").optional().isString(),
  body("city").optional().isString(),
  body("zone").optional().isString(),
  body("type").optional().isIn(["home", "work", "other"]),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = req.params.id;
    const addr = req.user.addresses.id(id);
    if (!addr) return res.status(404).json({ error: "Address not found" });
    if (req.body.houseNo !== undefined) addr.houseNo = req.body.houseNo;
    if (req.body.area !== undefined) addr.area = req.body.area;
    if (req.body.landmark !== undefined) addr.landmark = req.body.landmark;
    if (req.body.city !== undefined) addr.city = String(req.body.city || "").trim();
    if (req.body.cityId !== undefined) addr.cityId = String(req.body.cityId || "").trim();
    if (req.body.zone !== undefined) addr.zone = String(req.body.zone || "").trim();
    if (req.body.zoneId !== undefined) addr.zoneId = String(req.body.zoneId || "").trim();
    if (req.body.type !== undefined) addr.type = req.body.type;
    if (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== "") addr.lat = Number(req.body.lat);
    if (req.body.lng !== undefined && req.body.lng !== null && req.body.lng !== "") addr.lng = Number(req.body.lng);
    const normalizedAddr = await normalizeResolvedAddress(addr.toObject ? addr.toObject() : addr);
    Object.assign(addr, normalizedAddr);
    if (Number.isFinite(addr.lat) && Number.isFinite(addr.lng) && !addr.insideServiceArea) {
      return res.status(400).json({
        error: "Service is not available at your current location yet.",
        code: "OUT_OF_ZONE",
        address: normalizedAddr,
      });
    }
    await req.user.save();
    res.json({ address: addr, addresses: req.user.addresses });
  }
);

router.get("/me/wallet", requireAuth, async (req, res) => {
  const w = req.user.wallet || { balance: 0, transactions: [] };
  res.json({ wallet: { balance: w.balance || 0, transactions: w.transactions || [] } });
});

router.post(
  "/me/wallet/add-money",
  requireAuth,
  body("amount").isNumeric(),
  body("title").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const amt = Number(req.body.amount || 0);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!req.user.wallet) req.user.wallet = { balance: 0, transactions: [] };
    req.user.wallet.balance = (req.user.wallet.balance || 0) + amt;
    req.user.wallet.transactions.unshift({ title: req.body.title || "Added to Wallet", amount: amt, type: "credit" });
    await req.user.save();
    res.status(201).json({ wallet: req.user.wallet });
  }
);

router.get("/me/coupons", requireAuth, async (req, res) => {
  const all = await Coupon.find({ isActive: true }).lean();
  const count = await Booking.countDocuments({ customerId: req.user._id.toString() });
  const filtered = all.filter((c) => (c.firstTimeOnly ? count === 0 : true));
  res.json({ coupons: filtered });
});

// Provider suggestions for booking flow: determine repeat-user vs new-user slot selection mode.
router.get("/me/provider-suggestions", requireAuth, async (req, res) => {
  const customerId = req.user._id.toString();
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || "10"), 10) || 10, 20));
  const subscription = await getSubscriptionSnapshot(customerId, "customer");

  const addr0 = (req.user.addresses || [])[0] || {};
  const cityGuess = String(req.query.city || addr0.city || addr0.area || "").trim();
  const zoneGuess = String(req.query.zone || addr0.zone || "").trim();

  // ✅ FIX 1: Only fetch COMPLETED bookings (not just non-cancelled)
  // Limit to last 6 months for performance
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentBookings = await Booking.find({
    customerId,
    assignedProvider: { $ne: "" },
    status: "completed",  // ✅ Only completed bookings
    createdAt: { $gte: sixMonthsAgo }  // ✅ Last 6 months only
  }).sort({ createdAt: -1 }).limit(50).lean();

  const recentIds = [];
  const seen = new Set();
  const bookingCounts = {};  // ✅ FIX 3: Track booking count per provider
  
  for (const b of recentBookings) {
    const pid = String(b.assignedProvider || "").trim();
    if (!pid) continue;
    
    // Count bookings per provider
    bookingCounts[pid] = (bookingCounts[pid] || 0) + 1;
    
    if (!seen.has(pid)) {
      seen.add(pid);
      recentIds.push(pid);
      if (recentIds.length >= limit) break;
    }
  }

  // ✅ FIX 2: Remove city/zone filter for previous providers
  // User should see ALL their previous providers regardless of location
  const recentDocs = recentIds.length
    ? await ProviderAccount.find({
      _id: { $in: recentIds },
      approvalStatus: "approved",
      registrationComplete: true,
    }).lean()
    : [];
  const decoratedRecent = await Promise.all(recentDocs.map(async (p) => ({
    ...p,
    isPro: !!(await getSubscriptionSnapshot(p._id.toString(), "provider")).isPro,
    isElite: await isEliteProvider(p),
  })));
  const byId = new Map(decoratedRecent.map((p) => [p._id.toString(), p]));
  let recentProviders = recentIds.map((id) => byId.get(id)).filter(Boolean);

  if (subscription.isPlusMember && subscription.eliteAccessEnabled) {
    recentProviders = recentProviders.filter((p) => p.isElite || p.isPro);
  }

  // ✅ New Fix: Filter by requested specialties
  const reqServiceTypes = String(req.query.serviceTypes || "").split(",").map(s => s.trim()).filter(Boolean);
  const reqCategories = String(req.query.categories || "").split(",").map(s => s.trim()).filter(Boolean);
  if (reqServiceTypes.length > 0 || reqCategories.length > 0) {
    const requested = await resolveRequestedSpecialtySets({
      serviceTypeValues: reqServiceTypes,
      categoryValues: reqCategories
    });
    recentProviders = recentProviders.filter(p => providerMatchesRequestedSpecialties(p, requested));
  }

  // ✅ FIX 4: Sort by booking frequency first, then rating
  // Add booking count to each provider
  recentProviders = recentProviders
    .map(p => ({
      ...providerCard(p),
      bookingCount: bookingCounts[p._id.toString()] || 0  // ✅ Add booking count
    }))
    .sort((a, b) => {
      // Sort: Most booked → Elite → Pro → Highest rated → Most jobs
      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
      if (Number(b.isElite) !== Number(a.isElite)) return Number(b.isElite) - Number(a.isElite);
      if (Number(b.isPro) !== Number(a.isPro)) return Number(b.isPro) - Number(a.isPro);
      if (Number(b.rating || 0) !== Number(a.rating || 0)) return Number(b.rating || 0) - Number(a.rating || 0);
      return Number(b.totalJobs || 0) - Number(a.totalJobs || 0);
    });

  const isFirstBooking = recentIds.length === 0;
  
  console.log(`[Provider Suggestions] User: ${customerId}, Mode: ${isFirstBooking ? "new_user" : "repeat_user"}, Providers: ${recentProviders.length}`);
  res.json({
    mode: isFirstBooking ? "new_user" : "repeat_user",
    isFirstBooking,
    recentProviders: isFirstBooking ? [] : recentProviders.slice(0, limit),
    city: cityGuess,
    subscription,
  });
});

router.get("/me/referral", requireAuth, async (_req, res) => {
  const u = _req.user;
  const s = await ReferralSettings.findOne().lean();
  
  // Real Referral Stats
  const User = (await import("../models/User.js")).default;
  const totalReferrals = await User.countDocuments({ referredBy: u._id.toString() });
  
  const totalEarnings = (u.wallet?.transactions || [])
    .filter(t => t.type === "credit" && (t.title || "").includes("Referral"))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  res.json({ 
    referralCode: u.referralCode || "", 
    settings: s || { referrerBonus: 100, refereeBonus: 50, maxReferrals: 10, isActive: true },
    stats: {
        totalReferrals,
        totalEarnings
    }
  });
});

// Delete account endpoint
router.delete("/me/account", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      customerId: userId,
      status: { $in: ["pending", "assigned", "accepted", "in_progress"] }
    });
    
    if (activeBookings > 0) {
      return res.status(400).json({ 
        error: "Cannot delete account with active bookings. Please complete or cancel all active bookings first." 
      });
    }
    
    // Delete user account
    await req.user.deleteOne();
    
    // Clear auth cookie
    res.clearCookie("token");
    
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting user account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// ───── FEEDBACK SUBMISSION ─────
router.post(
  "/bookings/:bookingId/feedback",
  requireAuth,
  body("rating").isInt({ min: 1, max: 5 }),
  body("comment").optional().isString(),
  body("tags").optional().isArray(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const Feedback = (await import("../models/Feedback.js")).default;
      const { updateProviderRating } = await import("../lib/updateProviderRating.js");

      const booking = await Booking.findById(req.params.bookingId).lean();
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // Verify booking belongs to user
      if (booking.customerId !== req.user._id.toString()) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Check if feedback already exists
      const existing = await Feedback.findOne({ bookingId: req.params.bookingId });
      if (existing) {
        return res.status(400).json({ error: "Feedback already submitted for this booking" });
      }

      // Create feedback
      const feedback = await Feedback.create({
        bookingId: req.params.bookingId,
        customerId: req.user._id.toString(),
        customerName: req.user.name || booking.customerName || "Customer",
        providerId: booking.assignedProvider || "",
        providerName: booking.assignedProvider ? "Provider" : "",
        serviceName: booking.services?.[0]?.name || "Service",
        serviceCategory: booking.services?.[0]?.category || "",
        rating: req.body.rating,
        comment: req.body.comment || "",
        tags: req.body.tags || [],
        type: "customer_to_provider",
        status: "active",
      });

      // Update provider rating if provider is assigned
      if (booking.assignedProvider) {
        await updateProviderRating(booking.assignedProvider);
      }

      res.status(201).json({ success: true, feedback });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Could not submit feedback" });
    }
  }
);

router.get(
  "/activity",
  requireAuth,
  async (req, res) => {
    try {
      const u = req.user;
      
      // 1. Fetch recent bookings (last 10)
      const bookings = await Booking.find({ customerId: u._id.toString() })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
        
      // 2. Extract wallet transactions (last 10)
      const transactions = (u.wallet?.transactions || []).slice(0, 10);
      
      // 3. Map to common activity format
      const activityFromBookings = bookings.map(b => ({
        id: `booking-${b._id}`,
        type: "booking",
        title: b.services?.[0]?.name || "Service Booking",
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1),
        date: b.createdAt,
        rawDate: new Date(b.createdAt),
        color: b.status === "completed" ? "text-emerald-500" : b.status === "cancelled" ? "text-red-500" : "text-primary"
      }));
      
      const activityFromWallet = transactions.map(t => ({
        id: `wallet-${t._id || Math.random()}`,
        type: "wallet",
        title: t.title || "Wallet Update",
        status: t.type === "credit" ? "Credit" : "Debit",
        date: t.at || new Date(),
        rawDate: new Date(t.at || new Date()),
        color: t.type === "credit" ? "text-emerald-500" : "text-amber-500"
      }));
      
      // 4. Combine and Sort
      const allActivity = [...activityFromBookings, ...activityFromWallet]
        .sort((a, b) => b.rawDate - a.rawDate)
        .slice(0, 20);
        
      res.json({ success: true, activities: allActivity });
    } catch (error) {
      console.error("[UserActivity] Error:", error);
      res.status(500).json({ error: "Failed to fetch activity feed" });
    }
  }
);

export default router;
