import { validationResult } from "express-validator";
import Vendor from "../../../models/Vendor.js";
import mongoose from "mongoose";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Booking from "../../../models/Booking.js";
import SOSAlert from "../../../models/SOSAlert.js";
import CustomEnquiry from "../../../models/CustomEnquiry.js";
import ProviderWalletTxn from "../../../models/ProviderWalletTxn.js";
import { CommissionSettings, BookingSettings } from "../../../models/Settings.js";
import { issueRoleToken } from "../../../middleware/roles.js";
import { redis } from "../../../startup/redis.js";
import UserSubscription from "../../../models/UserSubscription.js";

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normCity(s) {
  return String(s || "").trim();
}

async function withinNotificationWindow() {
  const s = await BookingSettings.findOne().lean();
  const start = (s?.providerNotificationStartTime || "07:00").split(":").map(Number);
  const end = (s?.providerNotificationEndTime || "22:00").split(":").map(Number);
  if (start.length < 2 || end.length < 2) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const startMin = (start[0] * 60) + (start[1] || 0);
  const endMin = (end[0] * 60) + (end[1] || 0);
  return mins >= startMin && mins <= endMin;
}

export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const v = await Vendor.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone || "",
    city: normCity(req.body.city) || "",
    businessName: req.body.businessName || "",
    status: "approved",
  });
  const token = issueRoleToken("vendor", v._id?.toString() || v.email);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("vendorToken", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.status(201).json({ vendor: v, vendorToken: token });
}

export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const v = await Vendor.findOne({ email: req.body.email }).lean();
  if (!v) return res.status(400).json({ error: "Vendor not found" });
  const token = issueRoleToken("vendor", v._id?.toString() || v.email);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("vendorToken", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ vendor: v, vendorToken: token });
}

export async function logout(_req, res) {
  res.clearCookie("vendorToken").json({ success: true });
}

export async function requestOtp(req, res) {
  const phone = (req.body.phone || "").trim();
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: "Invalid phone" });
  const isDev = (process.env.NODE_ENV !== "production");
  const exists = await Vendor.findOne({ phone }).lean();
  if (!exists) return res.status(404).json({ error: "vendor with this mobile number not found" });
  const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
  await redis.set(`v:otp:${phone}`, otp, { EX: 300 });
  res.json({ success: true, otpPreview: isDev ? otp : "****" });
}

export async function verifyOtp(req, res) {
  const phone = (req.body.phone || "").trim();
  const otp = (req.body.otp || "").trim();
  if (!/^\d{10}$/.test(phone) || otp.length !== 6) return res.status(400).json({ error: "Invalid input" });
  const isDev = (process.env.NODE_ENV !== "production");
  const defaultOtp = process.env.DEMO_DEFAULT_OTP6 || (isDev ? "123456" : "");
  let valid = false;
  if (isDev && otp === defaultOtp) valid = true;
  else {
    const stored = await redis.get(`v:otp:${phone}`);
    valid = !!stored && stored === otp;
    if (valid) await redis.del(`v:otp:${phone}`);
  }
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  const v = await Vendor.findOne({ phone }).lean();
  if (!v) return res.status(404).json({ error: "vendor with this mobile number not found" });
  const token = issueRoleToken("vendor", v._id?.toString() || v.email);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("vendorToken", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ vendor: v, vendorToken: token });
}

export async function listProviders(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  const city = normCity(vendor?.city) || "";
  // City match should be forgiving (case/whitespace), otherwise vendor panels look "empty".
  const q = city ? { city: new RegExp(`^${escapeRegex(city)}$`, "i") } : {};
  let items = await ProviderAccount.find(q).sort({ createdAt: -1 }).lean();

  // Seed fake providers if empty for smoother demo/dev experience
  try {
    if (items.length === 0 && city) {
      const mkPhone = (base, idx) => String(base + idx).padStart(10, "9").slice(0, 10);
      const docs = [];
      for (let i = 0; i < 3; i++) {
        docs.push({
          phone: mkPhone(9200000000, i + 1),
          name: `Demo ${city} Provider ${i + 1}`,
          email: `demo${i + 1}.${city.toLowerCase()}@swm.com`,
          city,
          gender: i % 2 === 0 ? "women" : "men",
          experience: i % 2 === 0 ? "1-3" : "3-5",
          approvalStatus: i === 0 ? "approved" : "pending",
          registrationComplete: true,
          rating: 4.2 + (i % 2) * 0.3,
          totalJobs: 10 + i * 7,
          profilePhoto: "",
        });
      }
      await ProviderAccount.insertMany(docs);
      console.log(`[Vendor] Seeded providers for city: ${city} count=${docs.length}`);
      items = await ProviderAccount.find(q).sort({ createdAt: -1 }).lean();
    }
  } catch {}

  res.json({ providers: items });
}

export async function updateProviderStatus(req, res) {
  const status = String(req.body.status || "").trim().toLowerCase();
  
  const updates = {};
  if (status === "approved") {
    updates.vendorApprovalStatus = "approved";
    updates.approvalStatus = "pending_admin";
  } else if (status === "rejected") {
    updates.vendorApprovalStatus = "rejected";
    updates.approvalStatus = "rejected";
  } else {
    updates.approvalStatus = status || "pending_vendor";
  }

  const p = await ProviderAccount.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true }
  );
  res.json({ provider: p });
}

export async function listBookings(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  const city = normCity(vendor?.city) || "";
  if (!city) {
    // Backstop: if vendor city isn't configured, don't return an empty panel.
    const bookings = await Booking.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ bookings });
  }
  let providers = [];
  providers = await ProviderAccount.find({ city: new RegExp(`^${escapeRegex(city)}$`, "i") }).select("_id").lean();
  const providerIds = providers.map((p) => p._id?.toString());
  let byProvider = providerIds.length
    ? await Booking.find({ assignedProvider: { $in: providerIds } }).sort({ createdAt: -1 }).lean()
    : [];
  // Fallback by address.area/city contains city
  let byAddress = [];
  if (city) {
    byAddress = await Booking.find({
      $or: [
        { "address.area": new RegExp(city, "i") },
        { "address.city": new RegExp(city, "i") },
      ],
    }).sort({ createdAt: -1 }).lean();
  }
  let combined = [...byProvider, ...byAddress];
  // Seed demo bookings if none exist for vendor's city to improve first-run UX
  try {
    if (combined.length === 0 && providerIds.length > 0) {
      const mkBooking = (status, customerName, time, amt) => ({
        customerId: "DEMO-" + Math.random().toString(36).slice(2, 7),
        customerName,
        services: [
          { name: "Haircut", price: Math.round(199 + Math.random() * 300), duration: "30m", category: "hair", serviceType: "instant" },
        ],
        totalAmount: amt,
        prepaidAmount: 0,
        balanceAmount: amt,
        address: { houseNo: "101", area: city, landmark: "City Center", city },
        slot: { date: new Date().toISOString().slice(0, 10), time },
        bookingType: "instant",
        status,
        otp: "1234",
        assignedProvider: providerIds[0],
      });
      await Booking.insertMany([
        mkBooking("incoming", "Demo Cust 1", "09:00", 499),
        mkBooking("pending", "Demo Cust 2", "11:00", 899),
        mkBooking("accepted", "Demo Cust 3", "13:00", 1299),
        mkBooking("in_progress", "Demo Cust 4", "15:00", 999),
        mkBooking("completed", "Demo Cust 5", "17:00", 1599),
        mkBooking("cancelled", "Demo Cust 6", "19:00", 799),
      ]);
      byProvider = await Booking.find({ assignedProvider: { $in: providerIds } }).sort({ createdAt: -1 }).lean();
      combined = [...byProvider];
    }
  } catch {}
  const map = new Map();
  combined.forEach((b) => map.set(b._id.toString(), b));
  const bookings = Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ bookings });
}

export async function assignBooking(req, res) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes window for manual assignment too
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    { 
      assignedProvider: req.body.providerId, 
      status: "pending",
      lastAssignedAt: now,
      expiresAt: expiresAt,
      adminEscalated: false
    },
    { new: true }
  );
  res.json({ booking: b });
}

export async function reassignBooking(req, res) {
  const now = new Date();
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    { 
      assignedProvider: req.body.providerId, 
      status: "vendor_reassigned", // Mandatory status
      lastAssignedAt: now,
      expiresAt: null, // Mandatory, so no expiry for acceptance
      adminEscalated: false
    },
    { new: true }
  );
  res.json({ booking: b });
}

export async function expireBooking(req, res) {
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: "cancelled" },
    { new: true }
  );

  // Notify user that booking is cancelled by provider and they should rebook
  try {
    const { getIO } = await import("../../../startup/socket.js");
    const io = getIO();
    io?.of("/bookings").emit("status:update", { 
      id: b._id.toString(), 
      status: "cancelled", 
      message: "booking cancelled by the provider, kindly rebook the service" 
    });
  } catch (err) {
    console.error("Socket notification failed:", err);
  }

  res.json({ booking: b });
}

export async function updateBookingPayoutStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

  const b = await Booking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: "Not found" });
  b.payoutStatus = String(req.body.status || "").trim();
  await b.save();
  res.json({ booking: b });
}

export async function listCustomEnquiries(_req, res) {
  const items = await CustomEnquiry.find().sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function priceQuoteCustomEnquiry(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

  const enq = await CustomEnquiry.findById(req.params.id);
  if (!enq) return res.status(404).json({ error: "Not found" });

  let expiryAt = null;
  if (req.body.quoteExpiryAt) {
    const dt = new Date(req.body.quoteExpiryAt);
    expiryAt = Number.isNaN(dt.getTime()) ? null : dt;
  } else if (req.body.quoteExpiryHours) {
    const hours = Number(req.body.quoteExpiryHours);
    if (Number.isFinite(hours) && hours > 0) {
      expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }

  enq.quote = {
    ...(enq.quote || {}),
    totalAmount: Number(req.body.totalAmount) || 0,
    discountPrice: Number(req.body.discountPrice) || 0,
    notes: req.body.notes || enq.quote?.notes || "",
    prebookAmount: Number(req.body.prebookAmount) || enq.quote?.prebookAmount || 0,
    totalServiceTime: String(req.body.totalServiceTime || enq.quote?.totalServiceTime || ""),
    expiryAt: expiryAt || enq.quote?.expiryAt || null,
    items: enq.quote?.items?.length ? enq.quote.items : enq.items,
  };
  enq.status = "quote_submitted";
  enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
  enq.timeline.push({ action: "quote_submitted", meta: { totalAmount: enq.quote.totalAmount, discountPrice: enq.quote.discountPrice } });
  await enq.save();
  res.json({ enquiry: enq });
}

export async function assignTeamCustomEnquiry(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

  const enq = await CustomEnquiry.findById(req.params.id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  if (enq.paymentStatus !== "paid" && enq.status !== "advance_paid") {
    return res.status(409).json({ error: "Advance payment is required before assignment." });
  }

  const teamMembers = Array.isArray(req.body.teamMembers) ? req.body.teamMembers : [];
  const cleaned = teamMembers
    .map((m) => (m && typeof m === "object" ? { id: String(m.id || ""), name: String(m.name || ""), serviceType: String(m.serviceType || "") } : null))
    .filter((m) => m && m.id && m.name);
  if (cleaned.length === 0) return res.status(400).json({ error: "Invalid teamMembers" });

  const maintainerRaw = String(req.body.maintainerProvider || "").trim();
  let provider = null;
  if (mongoose.isValidObjectId(maintainerRaw)) {
    provider = await ProviderAccount.findById(maintainerRaw);
  }
  if (!provider && /^\d{10}$/.test(maintainerRaw)) {
    provider = await ProviderAccount.findOne({ phone: maintainerRaw });
  }
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  enq.maintainerProvider = provider._id.toString();
  enq.assignedProvider = enq.maintainerProvider;
  enq.teamMembers = cleaned;

  const commissionSettings = await CommissionSettings.findOne().lean();
  const rate = Number(commissionSettings?.rate || 20);
  const totalAmount = Number(enq.quote?.totalAmount || 0);
  const required = Math.max(Math.round(totalAmount * (rate / 100)), 0);
  if (required > 0 && Number(provider.credits || 0) < required) {
    return res.status(409).json({
      error: "Selected service provider does not have sufficient wallet balance to cover the platform commission.",
      code: "INSUFFICIENT_WALLET",
      required,
      available: Number(provider.credits || 0),
    });
  }
  if (required > 0) {
    provider.credits = Math.max(Number(provider.credits || 0) - required, 0);
    await provider.save();
    await ProviderWalletTxn.create({
      providerId: provider._id.toString(),
      bookingId: enq.bookingId || "",
      type: "commission_hold",
      amount: -required,
      balanceAfter: provider.credits,
      meta: { rate, totalAmount, source: "custom_enquiry" },
    });
  }

  // Create a booking if not exists
  let booking = null;
  if (enq.bookingId) {
    booking = await Booking.findById(enq.bookingId);
  }
  if (!booking) {
    const items = (enq.quote?.items || enq.items || []);
    booking = await Booking.create({
      customerId: enq.userId,
      customerName: enq.name || "",
      services: items.map(it => ({ name: it.name, price: it.price, duration: "", category: it.category, serviceType: it.serviceType })),
      totalAmount,
      prepaidAmount: Number(enq.prebookAmountPaid || 0),
      balanceAmount: Math.max(totalAmount - Number(enq.prebookAmountPaid || 0), 0),
      paymentStatus: (Number(enq.prebookAmountPaid || 0) > 0) ? "Partially Paid" : "Pending",
      address: {
        houseNo: enq.address?.houseNo || "",
        area: enq.address?.area || "",
        landmark: enq.address?.landmark || "",
        city: enq.address?.city || enq.address?.area || "",
        lat: enq.address?.lat ?? null,
        lng: enq.address?.lng ?? null,
      },
      slot: { date: enq.scheduledAt?.date || new Date().toISOString().slice(0, 10), time: enq.scheduledAt?.timeSlot || "10:00" },
      bookingType: "customized",
      status: "pending",
      lastAssignedAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins for custom team
      notificationStatus: (await withinNotificationWindow()) ? "immediate" : "queued",
      assignedProvider: enq.maintainerProvider,
      maintainProvider: enq.maintainerProvider,
      teamMembers: Array.isArray(enq.teamMembers) ? enq.teamMembers : [],
      commissionAmount: required,
      commissionChargedAt: required > 0 ? new Date() : null,
    });
    enq.bookingId = booking._id.toString();
  } else {
    booking.assignedProvider = enq.maintainerProvider;
    booking.maintainProvider = enq.maintainerProvider;
    booking.status = "pending";
    booking.lastAssignedAt = new Date();
    booking.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    booking.notificationStatus = (await withinNotificationWindow()) ? "immediate" : "queued";
    booking.teamMembers = Array.isArray(enq.teamMembers) ? enq.teamMembers : [];
    booking.commissionAmount = required;
    booking.commissionChargedAt = required > 0 ? new Date() : booking.commissionChargedAt;
    await booking.save();
  }

  enq.status = "service_confirmed";
  enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
  enq.timeline.push({ action: "provider_assigned", meta: { maintainerProvider: enq.maintainerProvider, teamCount: cleaned.length } });
  enq.timeline.push({ action: "service_confirmed", meta: { bookingId: enq.bookingId || "" } });
  enq.providerAssignedAt = new Date();
  await enq.save();
  res.json({ enquiry: enq, booking });
}

export async function listSOS(req, res) {
  // Basic list for now (optionally filtered by city in future)
  const items = await SOSAlert.find().sort({ createdAt: -1 }).lean();
  res.json({ alerts: items });
}

export async function resolveSOS(req, res) {
  const alert = await SOSAlert.findByIdAndUpdate(
    req.params.id,
    { status: "resolved" },
    { new: true }
  );
  res.json({ alert });
}

export async function stats(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  const city = normCity(vendor?.city) || "";
  const providers = city
    ? await ProviderAccount.find({ city: new RegExp(`^${escapeRegex(city)}$`, "i") }).lean()
    : await ProviderAccount.find().lean();
  const providerIds = providers.map((p) => p._id?.toString());
  const bookings = providerIds.length
    ? await Booking.find({ assignedProvider: { $in: providerIds } }).lean()
    : await Booking.find().lean();
  const revenue = bookings
    .filter((b) => b.status === "completed")
    .reduce((s, b) => s + (b.totalAmount || 0), 0);
  const active = bookings.filter((b) =>
    ["accepted", "travelling", "arrived", "in_progress"].includes(b.status)
  ).length;
  const cancellations = bookings.filter((b) =>
    ["cancelled", "rejected"].includes(b.status)
  ).length;
  const sos = await SOSAlert.countDocuments({ status: { $ne: "resolved" } });

  // Check for SWM City Manager Enterprise subscription
  const subscription = await UserSubscription.findOne({ userId: vendorId, status: 'active' });
  let advancedAnalytics = null;
  if (subscription) {
    // Provide advanced analytics data
    advancedAnalytics = {
      demandInsights: "High demand for Hair Spa in your area.",
      marketingCredits: 1000, // This would ideally come from the plan meta
    };
  }

  res.json({
    stats: {
      providers: { total: providers.length, approved: providers.filter((p) => p.approvalStatus === "approved").length, pending: providers.filter((p) => p.approvalStatus === "pending").length },
      bookings: { total: bookings.length, active, completed: bookings.filter((b) => b.status === "completed").length, cancellations },
      revenue,
      sosActive: sos,
      advancedAnalytics,
    },
  });
}
