import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { uploadBuffer } from "../startup/cloudinary.js";
import Coupon from "../models/Coupon.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import { ReferralSettings } from "../models/Settings.js";
import { getSubscriptionSnapshot, isEliteProvider } from "../lib/subscriptions.js";

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
  };
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/me", requireAuth, async (req, res) => {
  const u = req.user;
  const subscription = await getSubscriptionSnapshot(u._id.toString(), "customer");
  res.json({
    user: {
      id: u._id,
      phone: u.phone,
      name: u.name,
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
  body("referralCode").optional().isString().isLength({ max: 32 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, referralCode } = req.body;
    if (name !== undefined) req.user.name = name;
    if (referralCode !== undefined) req.user.referralCode = referralCode;
    await req.user.save();
    const subscription = await getSubscriptionSnapshot(req.user._id.toString(), "customer");
    res.json({
      success: true,
      user: {
        ...req.user.toObject(),
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
      type: req.body.type || "home",
      lat: req.body.lat !== undefined ? Number(req.body.lat) : null,
      lng: req.body.lng !== undefined ? Number(req.body.lng) : null,
    };
    req.user.addresses.push(addr);
    await req.user.save();
    res.status(201).json({ address: req.user.addresses[req.user.addresses.length - 1], addresses: req.user.addresses });
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
    if (req.body.type !== undefined) addr.type = req.body.type;
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

  const recentBookings = await Booking.find({
    customerId,
    assignedProvider: { $ne: "" },
    status: { $ne: "cancelled" },
  }).sort({ createdAt: -1 }).limit(50).lean();

  const recentIds = [];
  const seen = new Set();
  for (const b of recentBookings) {
    const pid = String(b.assignedProvider || "").trim();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    recentIds.push(pid);
    if (recentIds.length >= limit) break;
  }

  // Find providers that match the city/zone criteria
  let q = {
    approvalStatus: "approved",
    registrationComplete: true,
  };
  if (cityGuess) {
    q.city = new RegExp(`^${escapeRegex(cityGuess)}$`, "i");
  }
  if (zoneGuess) {
    q.$or = [
      { zone: new RegExp(`^${escapeRegex(zoneGuess)}$`, "i") },
      { address: new RegExp(escapeRegex(zoneGuess), "i") }
    ];
  }

  const recentDocs = recentIds.length
    ? await ProviderAccount.find({
      _id: { $in: recentIds },
      ...q
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

  recentProviders = recentProviders
    .sort((a, b) => (Number(b.isElite) - Number(a.isElite)) || (Number(b.isPro) - Number(a.isPro)) || (Number(b.rating || 0) - Number(a.rating || 0)))
    .map(providerCard);

  const isFirstBooking = recentIds.length === 0;
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
  res.json({ referralCode: u.referralCode || "", settings: s || { referrerBonus: 100, refereeBonus: 50, maxReferrals: 10, isActive: true } });
});

export default router;
