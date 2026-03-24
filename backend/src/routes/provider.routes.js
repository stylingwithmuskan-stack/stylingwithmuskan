import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import jwt from "jsonwebtoken";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import { redis } from "../startup/redis.js";
import { upload } from "../middleware/upload.js";
import { uploadBuffer } from "../startup/cloudinary.js";
import { issueRoleToken, requireRole } from "../middleware/roles.js";
import BookingLog from "../models/BookingLog.js";
import { getIO } from "../startup/socket.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { DEFAULT_TIME_SLOTS, defaultSlotsMap, isIsoDate, normalizeSlotsPayload, slotLabelToLocalDateTime, slotsMapToAvailableSlots, parseDurationToMinutes } from "../lib/slots.js";
import { daysBetweenInclusive, isoDateRangeIncludesWeekend, isoDateToLocalEnd, isoDateToLocalStart, toIsoDateFromAny } from "../lib/isoDateTime.js";
import { computeExpiresAt, getAcceptWindowMs, pickNextProviderForBooking } from "../lib/assignment.js";
import { BookingSettings, CommissionSettings } from "../models/Settings.js";
import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../config.js";
import { invalidateProviderSlots } from "../lib/availability.js";

const router = Router();

function ensureFourHourLeadTime(req, res, next) {
  try {
    const start = new Date(req.body.startAt);
    if (isNaN(start.getTime())) return res.status(400).json({ error: "Invalid start time" });
    const now = new Date();
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 4) return res.status(400).json({ error: "Provider can only apply leave before 4 hours" });
    next();
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }
}

router.post("/request-otp", body("phone").matches(/^\d{10}$/), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const acc = await ProviderAccount.findOne({ phone: req.body.phone }).lean();
  if (!acc) return res.status(404).json({ error: "user with this mobile number not found" });
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  await redis.set(`sp:otp:${req.body.phone}`, otp, { EX: 300 });
  const isDev = (process.env.NODE_ENV !== "production");
  console.log("[OTP] provider login", req.body.phone, isDev ? otp : "****");
  res.json({ success: true, otpPreview: isDev ? otp : "****" });
});

router.post("/verify-otp", body("phone").matches(/^\d{10}$/), body("otp").isLength({ min: 6, max: 6 }), async (req, res) => {
  const { phone, otp } = req.body;
  const isDev = (process.env.NODE_ENV !== "production");
  const defaultOtp6 = process.env.DEMO_DEFAULT_OTP6 || (isDev ? "123456" : "");
  let valid = false;
  if (isDev && otp === defaultOtp6) {
    valid = true;
  } else {
    const stored = await redis.get(`sp:otp:${phone}`);
    valid = !!stored && stored === otp;
    if (valid) await redis.del(`sp:otp:${phone}`);
  }
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  const acc = await ProviderAccount.findOne({ phone });
  if (!acc) return res.status(404).json({ error: "user with this mobile number not found" });
  // Mark provider online on successful login (required for assignment pool).
  try {
    acc.isOnline = true;
    await acc.save();
  } catch {}
  const token = issueRoleToken("provider", acc._id.toString());
  res.cookie("providerToken", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ provider: acc, providerToken: token });
});

router.get("/availability/:date", requireRole("provider"), param("date").isString(), async (req, res) => {
  const date = String(req.params.date || "").trim();
  if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

  const providerId = req.auth.sub;
  try {
    await ProviderAccount.findByIdAndUpdate(providerId, { isOnline: true });
  } catch {}
  const dateStart = isoDateToLocalStart(date);
  const dateEnd = isoDateToLocalEnd(date);
  if (!dateStart || !dateEnd) return res.status(400).json({ error: "Invalid date" });

  const leave = await LeaveRequest.findOne({
    providerId,
    status: "approved",
    $or: [
      { endAt: { $ne: null, $gte: dateStart }, startAt: { $lte: dateEnd } },
      { endAt: null, startAt: { $gte: dateStart, $lte: dateEnd } },
    ],
  }).lean();
  if (leave) {
    const slots = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slots[s] = false; });
    return res.json({ date, slots, onLeave: true, leave });
  }

  const doc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
  const base = defaultSlotsMap();
  if (doc?.availableSlots?.length) {
    // All slots default false, then enable the selected ones
    const m = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { m[s] = false; });
    for (const s of doc.availableSlots) {
      if (DEFAULT_TIME_SLOTS.includes(s)) m[s] = true;
    }
    return res.json({ date, slots: m });
  }
  return res.json({ date, slots: base });
});

router.put(
  "/availability/:date",
  requireRole("provider"),
  param("date").isString(),
  body("slots").custom((v) => typeof v === "object" && v !== null),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });
    const date = String(req.params.date || "").trim();
    if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

    const normalized = normalizeSlotsPayload(req.body.slots);
    if (!normalized.ok) return res.status(400).json({ error: normalized.error });

    const providerId = req.auth.sub;
    try {
      await ProviderAccount.findByIdAndUpdate(providerId, { isOnline: true });
    } catch {}
    const dateStart = isoDateToLocalStart(date);
    const dateEnd = isoDateToLocalEnd(date);
    if (!dateStart || !dateEnd) return res.status(400).json({ error: "Invalid date" });

    // Past days cannot be edited.
    const todayIso = toIsoDateFromAny(new Date());
    const todayStart = isoDateToLocalStart(todayIso);
    if (todayStart && dateStart.getTime() < todayStart.getTime()) {
      return res.status(400).json({ error: "Cannot edit past dates" });
    }

    // If provider is on approved leave for this date, availability doesn't apply.
    const approvedLeave = await LeaveRequest.findOne({
      providerId,
      status: "approved",
      $or: [
        { endAt: { $ne: null, $gte: dateStart }, startAt: { $lte: dateEnd } },
        { endAt: null, startAt: { $gte: dateStart, $lte: dateEnd } },
      ],
    }).lean();
    if (approvedLeave) {
      return res.status(400).json({ error: "Cannot edit availability while on approved leave for this date" });
    }

    // Slots can be modified until 2 hours before the service time (local server time).
    const now = new Date();
    const cutoff = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const existingDoc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
    const currentMap = existingDoc?.availableSlots?.length
      ? (() => {
        const m = {};
        DEFAULT_TIME_SLOTS.forEach((s) => { m[s] = false; });
        for (const s of existingDoc.availableSlots) if (DEFAULT_TIME_SLOTS.includes(s)) m[s] = true;
        return m;
      })()
      : defaultSlotsMap();
    const nextEffective = { ...defaultSlotsMap(), ...normalized.slots };

    if (date === todayIso) {
      const locked = [];
      for (const s of DEFAULT_TIME_SLOTS) {
        const startDt = slotLabelToLocalDateTime(date, s);
        if (!startDt) continue;
        if (startDt.getTime() < cutoff.getTime()) {
          if ((nextEffective[s] ?? false) !== (currentMap[s] ?? false)) locked.push(s);
        }
      }
      if (locked.length > 0) {
        return res.status(400).json({ error: "Some slots are locked (within 2 hours)", lockedSlots: locked });
      }
    }

    const availableSlots = slotsMapToAvailableSlots({ ...defaultSlotsMap(), ...normalized.slots });

    const doc = await ProviderDayAvailability.findOneAndUpdate(
      { providerId, date },
      { providerId, date, availableSlots },
      { upsert: true, new: true }
    ).lean();

    const slots = {};
    DEFAULT_TIME_SLOTS.forEach((s) => { slots[s] = false; });
    for (const s of doc.availableSlots || []) slots[s] = true;
    res.json({ date, slots });
    try { await invalidateProviderSlots(providerId, date); } catch {}
  }
);

router.get("/leaves", requireRole("provider"), async (req, res) => {
  const pId = req.auth.sub;
  const items = await LeaveRequest.find({ providerId: pId }).sort({ createdAt: -1 }).lean();
  res.json({ leaves: items });
});

router.post(
  "/leaves",
  requireRole("provider"),
  body("type").optional().isString(),
  body("startAt").isString(),
  body("endDate").optional().isString(),
  body("reason").optional().isString(),
  ensureFourHourLeadTime,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });
    const pId = req.auth.sub;
    const prov = await ProviderAccount.findById(pId).lean();
    if (!prov) return res.status(404).json({ error: "Not found" });

    const startAt = new Date(req.body.startAt);
    if (Number.isNaN(startAt.getTime())) return res.status(400).json({ error: "Invalid startAt" });

    const startIso = toIsoDateFromAny(startAt);
    if (!startIso) return res.status(400).json({ error: "Invalid start date" });

    const wantsEnd = (req.body.type || "Full Day") === "Full Day" && !!req.body.endDate;
    const endIsoRaw = wantsEnd ? toIsoDateFromAny(req.body.endDate) : "";
    const endIso = endIsoRaw || startIso;
    if (!endIso) return res.status(400).json({ error: "Invalid end date" });

    const dayCount = daysBetweenInclusive(startIso, endIso);
    if (!dayCount) return res.status(400).json({ error: "Invalid date range" });

    const includesWeekend = isoDateRangeIncludesWeekend(startIso, endIso);
    if (includesWeekend === null) return res.status(400).json({ error: "Invalid date range" });

    const requiresApproval = dayCount > 3 || includesWeekend === true;
    const status = requiresApproval ? "pending" : "approved";

    const endAt = isoDateToLocalEnd(endIso);
    if (!endAt) return res.status(400).json({ error: "Invalid end date" });

    const item = await LeaveRequest.create({
      providerId: pId,
      phone: prov.phone,
      type: req.body.type || "Full Day",
      startAt,
      endAt,
      endDate: (endIso !== startIso) ? endIso : "",
      reason: req.body.reason || "",
      status,
    });
    res.status(201).json({ leave: item, requiresApproval });
  }
);

router.post("/register", body("phone").matches(/^\d{10}$/), body("name").isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const update = {
    name: req.body.name,
    email: req.body.email || "",
    address: req.body.address || "",
    city: String(req.body.city || "").trim(),
    gender: req.body.gender || "",
    dob: req.body.dob || "",
    experience: req.body.experience || "0-1",
    profilePhoto: req.body.profilePhoto || "",
    documents: {
      aadharFront: req.body.aadharFront || "",
      aadharBack: req.body.aadharBack || "",
      panCard: req.body.panCard || "",
      bankName: req.body.bankName || "",
      accountNumber: req.body.accountNumber || "",
      ifscCode: req.body.ifscCode || "",
      primaryCategory: req.body.primaryCategory || [],
      specializations: req.body.specializations || [],
    },
    approvalStatus: "pending",
    registrationComplete: true,
  };
  const acc = await ProviderAccount.findOneAndUpdate({ phone: req.body.phone }, update, { new: true, upsert: true });
  res.json({ provider: acc });
});

router.get("/me/:phone", param("phone").matches(/^\d{10}$/), async (req, res) => {
  const acc = await ProviderAccount.findOne({ phone: req.params.phone }).lean();
  res.json({ provider: acc });
});

router.get("/summary/:phone", param("phone").matches(/^\d{10}$/), async (req, res) => {
  try {
    const phone = req.params.phone;
    const provider = await ProviderAccount.findOne({ phone }).lean();
    if (!provider) return res.status(404).json({ error: "Not found" });
    // Real metrics from bookings
    let performance = { responseRate: 0, cancellations: 0, grade: "N/A", weeklyTrend: [] };
    // calendar hours = sum of booked durations (mins) in last 7d, converted to hours
    let calendar = { availableHoursWeek: 0 };
    // hub metrics
    let hub = { jobs30d: 0, repeatCustomers: 0 };
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const providerId = provider._id?.toString();
      const recent = await Booking.find({ assignedProvider: providerId, createdAt: { $gte: weekAgo } }).lean();
      const monthBookings = await Booking.find({ assignedProvider: providerId, createdAt: { $gte: monthAgo } }).lean();
      // Response/cancellations
      const total = recent.length;
      const cancelled = recent.filter(b => (b.status || "").toLowerCase() === "cancelled").length;
      const completed = recent.filter(b => (b.status || "").toLowerCase() === "completed").length;
      const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const grade = responseRate >= 95 ? "A+" : responseRate >= 85 ? "A" : responseRate >= 70 ? "B" : responseRate > 0 ? "C" : "N/A";
      // Weekly trend: per weekday completion percentage
      const weekdayIdxToName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayTotals = Array(7).fill(0);
      const dayCompleted = Array(7).fill(0);
      for (const b of recent) {
        const idx = new Date(b.createdAt).getDay();
        dayTotals[idx] += 1;
        if ((b.status || "").toLowerCase() === "completed") dayCompleted[idx] += 1;
      }
      const weeklyTrend = [1,2,3,4,5,6,0].map((dow) => { // Mon..Sun order
        const totalD = dayTotals[dow] || 0;
        const val = totalD > 0 ? Math.round((dayCompleted[dow] / totalD) * 100) : 0;
        return { day: weekdayIdxToName[dow], value: val, color: dow === 4 && val > 0 ? "bg-purple-500" : "bg-slate-200" };
      });
      // Calendar hours: sum durations of services in last 7 days (completed/in_progress)
      const parseMinutes = (s) => {
        if (!s || typeof s !== "string") return 60;
        const m = s.toLowerCase();
        let minutes = 0;
        const hMatch = m.match(/(\d+)\s*h/);
        const mMatch = m.match(/(\d+)\s*m/);
        if (hMatch) minutes += parseInt(hMatch[1], 10) * 60;
        if (mMatch) minutes += parseInt(mMatch[1], 10);
        if (minutes === 0) {
          const num = m.match(/(\d+)/);
          minutes = num ? parseInt(num[1], 10) : 60;
        }
        return Math.max(15, Math.min(minutes, 8 * 60));
      };
      const productive = recent.filter(b => ["completed", "in_progress", "arrived"].includes((b.status || "").toLowerCase()));
      const minutes = productive.reduce((acc, b) => {
        const svc = Array.isArray(b.services) ? b.services : [];
        const total = svc.reduce((s, it) => s + parseMinutes(it?.duration || ""), 0);
        return acc + (total || 60);
      }, 0);
      calendar = { availableHoursWeek: Math.round(minutes / 60) };
      // Hub: jobs last 30d and repeat customers
      hub.jobs30d = monthBookings.length;
      const customerCount = new Map();
      for (const b of monthBookings) {
        const cid = b.customerId || "";
        if (!cid) continue;
        customerCount.set(cid, (customerCount.get(cid) || 0) + 1);
      }
      hub.repeatCustomers = Array.from(customerCount.values()).filter(c => c > 1).length;
      performance = { responseRate, cancellations: cancelled, grade, weeklyTrend };
    } catch {}
    const insurance = { active: !!provider.insuranceActive };
    const training = { completed: !!provider.trainingCompleted };
    res.json({
      provider: {
        id: provider._id?.toString(),
        name: provider.name || "",
        phone: provider.phone || "",
        email: provider.email || "",
        city: provider.city || "",
        rating: provider.rating || 0,
        totalJobs: provider.totalJobs || 0,
        credits: provider.credits || 0,
        profilePhoto: provider.profilePhoto || "",
        approvalStatus: provider.approvalStatus || "",
        registrationComplete: provider.registrationComplete || false,
        experience: provider.experience || "",
      },
      performance,
      calendar,
      hub,
      insurance,
      training,
    });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/logout", async (_req, res) => {
  try {
    const tok = _req.cookies?.providerToken;
    if (tok) {
      const p = jwt.verify(tok, process.env.JWT_SECRET || "dev_secret_change_me");
      if (p?.sub) {
        await ProviderAccount.findByIdAndUpdate(p.sub, { isOnline: false });
      }
    }
  } catch {}
  res.clearCookie("providerToken").json({ success: true });
});

router.get("/credits/:phone", param("phone").matches(/^\d{10}$/), async (req, res) => {
  const acc = await ProviderAccount.findOne({ phone: req.params.phone }).lean();
  if (!acc) return res.status(404).json({ error: "Not found" });
  const credits = acc.credits || 0;
  const transactions = await ProviderWalletTxn.find({ providerId: acc._id.toString() }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ credits, transactions });
});

router.post(
  "/wallet/recharge",
  requireRole("provider"),
  body("amount").isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const amount = Math.max(Number(req.body.amount) || 0, 0);
    if (amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const acc = await ProviderAccount.findById(req.auth.sub);
    if (!acc) return res.status(404).json({ error: "Not found" });
    acc.credits = Number(acc.credits || 0) + amount;
    await acc.save();
    await ProviderWalletTxn.create({
      providerId: acc._id.toString(),
      type: "recharge",
      amount,
      balanceAfter: acc.credits,
      meta: { title: "Recharge Credits", source: "mock" },
    });
    res.json({ success: true, credits: acc.credits });
  }
);

router.post(
  "/wallet/expense",
  requireRole("provider"),
  body("amount").isNumeric(),
  body("title").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const amount = Math.max(Number(req.body.amount) || 0, 0);
    if (amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const acc = await ProviderAccount.findById(req.auth.sub);
    if (!acc) return res.status(404).json({ error: "Not found" });
    if (Number(acc.credits || 0) < amount) return res.status(409).json({ error: "Insufficient balance" });
    acc.credits = Math.max(Number(acc.credits || 0) - amount, 0);
    await acc.save();
    await ProviderWalletTxn.create({
      providerId: acc._id.toString(),
      type: "expense",
      amount: -amount,
      balanceAfter: acc.credits,
      meta: { title: req.body.title || "Wallet Expense", source: "mock" },
    });
    res.json({ success: true, credits: acc.credits });
  }
);

router.post(
  "/wallet/refund",
  requireRole("provider"),
  body("amount").isNumeric(),
  body("title").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const amount = Math.max(Number(req.body.amount) || 0, 0);
    if (amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const acc = await ProviderAccount.findById(req.auth.sub);
    if (!acc) return res.status(404).json({ error: "Not found" });
    acc.credits = Number(acc.credits || 0) + amount;
    await acc.save();
    await ProviderWalletTxn.create({
      providerId: acc._id.toString(),
      type: "refund",
      amount,
      balanceAfter: acc.credits,
      meta: { title: req.body.title || "Wallet Refund", source: "mock" },
    });
    res.json({ success: true, credits: acc.credits });
  }
);

router.patch("/me/location",
  requireRole("provider"),
  body("lat").isFloat({ min: -90, max: 90 }),
  body("lng").isFloat({ min: -180, max: 180 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
    const acc = await ProviderAccount.findByIdAndUpdate(req.auth.sub, { currentLocation: { lat: req.body.lat, lng: req.body.lng } }, { new: true });
    res.json({ provider: acc });
  }
);

router.post(
  "/upload-docs",
  requireRole("provider"),
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
  ]),
  body("phone").matches(/^\d{10}$/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const phone = req.body.phone;
    const folder = `providers/${phone}/docs`;
    const files = req.files || {};
    const updates = {};
    if (files.profilePhoto?.[0]) {
      const up = await uploadBuffer(files.profilePhoto[0].buffer, folder);
      updates.profilePhoto = up.secure_url;
    }
    const docs = {};
    if (files.aadharFront?.[0]) {
      const up = await uploadBuffer(files.aadharFront[0].buffer, folder);
      docs.aadharFront = up.secure_url;
    }
    if (files.aadharBack?.[0]) {
      const up = await uploadBuffer(files.aadharBack[0].buffer, folder);
      docs.aadharBack = up.secure_url;
    }
    if (files.panCard?.[0]) {
      const up = await uploadBuffer(files.panCard[0].buffer, folder);
      docs.panCard = up.secure_url;
    }
    if (Object.keys(docs).length > 0) updates.documents = docs;
    const acc = await ProviderAccount.findOneAndUpdate({ phone }, updates, { new: true, upsert: true });
    res.json({ provider: acc });
  }
);

router.get("/bookings/:providerId", requireRole("provider"), param("providerId").isString(), async (req, res) => {
  if (req.params.providerId !== req.auth?.sub) return res.status(403).json({ error: "Forbidden" });
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const q = { assignedProvider: req.params.providerId };
  let total = await Booking.countDocuments(q);
  const items = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  const bookings = (items || []).map((b) => ({ ...b, id: b._id?.toString?.() || b.id }));
  total = bookings.length;
  res.json({ bookings, page, limit, total });
});

router.post("/bookings/:id/request-payment", requireRole("provider"), param("id").isString(), async (req, res) => {
  const pId = req.auth?.sub;
  const b = await Booking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  if ((b.assignedProvider || "") !== (pId || "")) return res.status(403).json({ error: "Forbidden" });
  const balance = Math.max(Number(b.balanceAmount || 0), 0);
  if (balance <= 0) return res.status(400).json({ error: "No balance due" });

  try {
    let order;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.warn("[Payment] Razorpay keys missing. Creating MOCK order for provider request.");
      order = {
        id: "order_mock_" + Math.random().toString(36).slice(2, 9),
        amount: balance * 100,
        currency: "INR",
        mock: true
      };
    } else {
      const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
      order = await rzp.orders.create({
        amount: balance * 100,
        currency: "INR",
        receipt: `swm_booking_${b._id.toString()}`,
        notes: { bookingId: b._id.toString(), purpose: "booking_full" },
      });
    }
    
    b.status = "payment_pending";
    b.paymentStatus = "Pending";
    b.paymentOrder = {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt || "",
      createdAt: new Date(),
    };
    await b.save();
    await BookingLog.create({ action: "booking:payment-requested", userId: pId, bookingId: b._id.toString(), meta: { amount: balance } });
    try {
      const io = getIO();
      io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "payment_pending" });
    } catch {}
    res.json({ booking: { ...b.toObject(), id: b._id.toString() }, order });
  } catch (err) {
    console.error("Payment request error:", err);
    res.status(502).json({ error: "Payment gateway unavailable" });
  }
});

router.patch("/bookings/:id/status", requireRole("provider"), param("id").isString(), body("status").isString(), async (req, res) => {
  const next = (req.body.status || "").toLowerCase();
  const pId = req.auth?.sub;
  if (next === "accepted") {
    const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
    const acc = await ProviderAccount.findById(pId);
    if (!acc || acc.approvalStatus !== "approved") return res.status(403).json({ error: "Forbidden" });
  }
  let b = await Booking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  if ((b.assignedProvider || "") !== (pId || "")) return res.status(403).json({ error: "Forbidden" });

  if ((b.bookingType || "").toLowerCase() === "customized" && (next === "rejected" || next === "cancelled")) {
    return res.status(403).json({ error: "Customized bookings cannot be cancelled by provider." });
  }

  const now = new Date();

  // Expired acceptance window: provider can't accept anymore.
  // We auto-reassign immediately to keep UX responsive, and return 409 for the current provider.
  const acceptMs = getAcceptWindowMs();
  const expiredByExpiresAt = !!b.expiresAt && now.getTime() > new Date(b.expiresAt).getTime();
  const expiredByLegacyLastAssignedAt =
    !b.expiresAt &&
    !!b.lastAssignedAt &&
    (now.getTime() - new Date(b.lastAssignedAt).getTime()) > acceptMs;
  if (next === "accepted" && (expiredByExpiresAt || expiredByLegacyLastAssignedAt)) {
    const current = b.assignedProvider || "";
    if (current) {
      const set = new Set(b.rejectedProviders || []);
      set.add(current);
      b.rejectedProviders = Array.from(set);
    }

    const startIdx = Math.max(Number(b.assignmentIndex || 0), 0) + 1;
    const picked = await pickNextProviderForBooking(b, startIdx);
    if (picked?.providerId) {
      b.assignedProvider = picked.providerId;
      b.assignmentIndex = picked.index;
      b.status = "pending";
      b.lastAssignedAt = now;
      b.expiresAt = computeExpiresAt(now);
      b.adminEscalated = false;
      try {
        const io = getIO();
        io?.of("/bookings").emit("assignment:changed", { id: b._id.toString(), fromProvider: current, toProvider: picked.providerId, reason: "accept_expired" });
        io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
      } catch {}
    } else {
      b.assignedProvider = "";
      b.adminEscalated = true;
      b.status = "pending";
      b.expiresAt = null;
      try {
        const io = getIO();
        io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
      } catch {}
    }

    await b.save();
    await BookingLog.create({ action: "booking:accept-expired", userId: pId, bookingId: req.params.id, meta: { attempted: "accepted" } });
    return res.status(409).json({
      error: "This booking request has expired for you and was reassigned to another provider.",
      code: "ACCEPT_WINDOW_EXPIRED",
      booking: b,
    });
  }

  // Handle rejection: move to next eligible candidate or escalate to admin
  if (next === "rejected") {
    const current = b.assignedProvider || "";
    if (current) {
      const set = new Set(b.rejectedProviders || []);
      set.add(current);
      b.rejectedProviders = Array.from(set);
    }

    const startIdx = Math.max(Number(b.assignmentIndex || 0), 0) + 1;
    const picked = await pickNextProviderForBooking(b, startIdx);
    if (picked?.providerId) {
      b.assignedProvider = picked.providerId;
      b.assignmentIndex = picked.index;
      b.status = "pending";
      b.lastAssignedAt = now;
      b.expiresAt = computeExpiresAt(now);
      b.adminEscalated = false;
      try {
        const io = getIO();
        io?.of("/bookings").emit("assignment:changed", { id: b._id.toString(), fromProvider: current, toProvider: picked.providerId, reason: "rejected" });
      } catch {}
    } else {
      b.assignedProvider = "";
      b.adminEscalated = true;
      b.status = "pending";
      b.expiresAt = null;
    }
  } else if (next === "accepted") {
    // Wallet commission check before accepting
    const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
    const acc = await ProviderAccount.findById(pId);
    if (!acc) return res.status(403).json({ error: "Forbidden" });
    const commissionSettings = await CommissionSettings.findOne().lean();
    const rate = Number(commissionSettings?.rate || 20);
    const totalAmount = Number(b.totalAmount || 0);
    const required = Math.max(Math.round(totalAmount * (rate / 100)), 0);
    if (!b.commissionChargedAt && required > 0 && Number(acc.credits || 0) < required) {
      return res.status(409).json({
        error: "Insufficient wallet balance to accept this booking.",
        code: "INSUFFICIENT_WALLET",
        required,
        available: Number(acc.credits || 0),
      });
    }
    if (!b.commissionChargedAt && required > 0) {
      acc.credits = Math.max(Number(acc.credits || 0) - required, 0);
      await acc.save();
      b.commissionAmount = required;
      b.commissionChargedAt = new Date();
      await ProviderWalletTxn.create({
        providerId: pId,
        bookingId: b._id.toString(),
        type: "commission_hold",
        amount: -required,
        balanceAfter: acc.credits,
        meta: { rate, totalAmount },
      });
    }
    try {
      const settings = await BookingSettings.findOne().lean();
      const bufferMin = Math.max(Number(settings?.providerBufferMinutes || 0), 0);
      const services = Array.isArray(b.services) ? b.services : [];
      const totalMinutes = services.reduce((sum, it) => sum + parseDurationToMinutes(it?.duration, 60), 0) || 60;
      const slotStart = b.slotStartAt || slotLabelToLocalDateTime(b?.slot?.date, b?.slot?.time);
      if (slotStart) {
        const end = b.slotEndAt || new Date(slotStart.getTime() + (totalMinutes + bufferMin) * 60 * 1000);
        b.slotStartAt = slotStart;
        b.slotEndAt = end;
      }
    } catch {}
    b.status = "accepted";
    b.expiresAt = null;
    b.adminEscalated = false;
  } else if (next === "cancelled") {
    // Provider cancelling an active booking
    const restricted = ["arrived", "in_progress", "completed", "cancelled", "rejected", "provider_cancelled"];
    if (restricted.includes((b.status || "").toLowerCase())) {
      return res.status(400).json({ error: `Cannot cancel booking with current status: ${b.status}` });
    }

    const oldStatus = b.status;
    b.status = "provider_cancelled";
    
    // Refund commission if it was charged
    if (b.commissionChargedAt && b.commissionAmount > 0) {
      const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
      const acc = await ProviderAccount.findById(pId);
      if (acc) {
        acc.credits = Number(acc.credits || 0) + b.commissionAmount;
        await acc.save();
        await ProviderWalletTxn.create({
          providerId: pId,
          bookingId: b._id.toString(),
          type: "refund",
          amount: b.commissionAmount,
          balanceAfter: acc.credits,
          meta: { title: "Commission Refund (Provider Cancelled)", reason: "cancelled_by_provider" },
        });
      }
    }

    await b.save();
    await BookingLog.create({
      action: "booking:cancel",
      userId: pId,
      bookingId: b._id.toString(),
      meta: { oldStatus, by: "provider" }
    });

    // Notifications
    try {
      const io = getIO();
      const payload = {
        id: b._id.toString(),
        status: "provider_cancelled",
        providerName: req.provider?.name || "Professional",
        customerName: b.customerName,
        city: b.address?.city || "",
        message: "The provider has cancelled the booking. Please reassign to another provider."
      };

      // To Admin and Vendor (User is NOT notified at this stage)
      io?.of("/admin").emit("booking:cancelled", { ...payload, by: "provider" });
      io?.of("/vendor").emit("booking:cancelled", { ...payload, by: "provider" });
    } catch (err) {
      console.error("Socket notification failed:", err);
    }

    return res.json({ booking: b, message: "Booking cancelled successfully. Vendor will be notified for reassignment." });
  } else {
    // For other provider-driven statuses (travelling, arrived, in_progress, completed, etc.)
    // store normalized lower-case.
    b.status = next;
    if (next !== "pending") b.expiresAt = null;
  }

  if ((next === "cancelled" || next === "rejected") && b.commissionChargedAt && !b.commissionRefundedAt) {
    const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
    const acc = await ProviderAccount.findById(pId);
    if (acc) {
      acc.credits = Number(acc.credits || 0) + Number(b.commissionAmount || 0);
      await acc.save();
      b.commissionRefundedAt = new Date();
      await ProviderWalletTxn.create({
        providerId: pId,
        bookingId: b._id.toString(),
        type: "commission_refund",
        amount: Number(b.commissionAmount || 0),
        balanceAfter: acc.credits,
        meta: { reason: next },
      });
    }
  }

  await b.save();
  try {
    if (b?.slot?.date) await invalidateProviderSlots(pId, b.slot.date);
  } catch {}
  await BookingLog.create({ action: "booking:status", userId: pId, bookingId: req.params.id, meta: { status: next } });
  try {
    const io = getIO();
    io?.of("/bookings").emit("status:update", { id: req.params.id, status: next });
  } catch {}
  res.json({ booking: b });
});

router.patch(
  "/bookings/:id/location",
  requireRole("provider"),
  param("id").isString(),
  body("lat").isFloat({ min: -90, max: 90 }),
  body("lng").isFloat({ min: -180, max: 180 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const bookingId = req.params.id;
    const providerId = req.auth?.sub;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Not found" });
    const provider = await ProviderAccount.findById(providerId).lean();
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    const assigned = String(booking.assignedProvider || "");
    if (assigned !== String(providerId || "") && assigned !== String(provider.phone || "")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await ProviderAccount.findByIdAndUpdate(providerId, {
      currentLocation: { lat: req.body.lat, lng: req.body.lng },
    });
    try {
      const io = getIO();
      io?.of("/bookings").to(`booking:${bookingId}`).emit("booking:location", {
        bookingId,
        lat: req.body.lat,
        lng: req.body.lng,
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    res.json({ success: true });
  }
);

router.post("/bookings/:id/verify-otp", requireRole("provider"), param("id").isString(), body("otp").isString(), async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b || b.otp !== req.body.otp) return res.status(403).json({ error: "Invalid OTP" });
  if ((b.assignedProvider || "") !== (req.auth?.sub || "")) return res.status(403).json({ error: "Forbidden" });
  b.status = "in_progress";
  await b.save();
  await BookingLog.create({ action: "booking:verify-otp", userId: req.auth?.sub || "", bookingId: req.params.id, meta: {} });
  try {
    const io = getIO();
    io?.of("/bookings").emit("status:update", { id: req.params.id, status: "in_progress" });
  } catch {}
  res.json({ booking: b });
});

router.post(
  "/bookings/:id/before-images",
  requireRole("provider"),
  param("id").isString(),
  upload.array("images", 10),
  async (req, res) => {
    const uploads = await Promise.all(
      (req.files || []).map((f) => uploadBuffer(f.buffer, `bookings/${req.params.id}/before`))
    );
    const urls = uploads.map((u) => u.secure_url);
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, assignedProvider: req.auth?.sub || "" },
      { $push: { beforeImages: { $each: urls } } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found or not assigned to you" });
    res.json({ booking });
  }
);

router.post(
  "/bookings/:id/after-images",
  requireRole("provider"),
  param("id").isString(),
  upload.array("images", 10),
  async (req, res) => {
    const uploads = await Promise.all(
      (req.files || []).map((f) => uploadBuffer(f.buffer, `bookings/${req.params.id}/after`))
    );
    const urls = uploads.map((u) => u.secure_url);
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, assignedProvider: req.auth?.sub || "" },
      { $push: { afterImages: { $each: urls } } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found or not assigned to you" });
    res.json({ booking });
  }
);

router.post(
  "/bookings/:id/product-images",
  requireRole("provider"),
  param("id").isString(),
  upload.array("images", 10),
  async (req, res) => {
    const uploads = await Promise.all(
      (req.files || []).map((f) => uploadBuffer(f.buffer, `bookings/${req.params.id}/products`))
    );
    const urls = uploads.map((u) => u.secure_url);
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, assignedProvider: req.auth?.sub || "" },
      { $push: { productImages: { $each: urls } } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found or not assigned to you" });
    res.json({ booking });
  }
);

router.post(
  "/bookings/:id/provider-images",
  requireRole("provider"),
  param("id").isString(),
  upload.array("images", 10),
  async (req, res) => {
    const uploads = await Promise.all(
      (req.files || []).map((f) => uploadBuffer(f.buffer, `bookings/${req.params.id}/provider`))
    );
    const urls = uploads.map((u) => u.secure_url);
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, assignedProvider: req.auth?.sub || "" },
      { $push: { providerImages: { $each: urls } } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found or not assigned to you" });
    res.json({ booking });
  }
);

export default router;
