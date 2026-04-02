import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import Vendor from "../models/Vendor.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import Coupon from "../models/Coupon.js";
import SOSAlert from "../models/SOSAlert.js";
import { ReferralSettings, CommissionSettings, BookingSettings, PerformanceSettings, SystemSettings } from "../models/Settings.js";
import { upload, uploadMedia } from "../middleware/upload.js";
import { issueRoleToken, requireRole } from "../middleware/roles.js";
import * as AdminController from "../modules/admin/controllers/admin.controller.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../config.js";
import { ServiceType, Category, Service, OfficeSettings, Banner } from "../models/Content.js";
import { Spotlight, GalleryItem, Testimonial } from "../models/SiteContent.js";
import * as BookingsController from "../modules/bookings/controllers/bookings.controller.js";
import { computeExpiresAt } from "../lib/assignment.js";
import { bumpContentVersion } from "../lib/contentCache.js";
import { notify } from "../lib/notify.js";
import * as AdminSubscriptionController from "../modules/subscriptions/controllers/adminSubscription.controller.js";
import * as AdminPushController from "../modules/admin/controllers/adminPush.controller.js";

const router = Router();

router.post(
  "/login",
  body("email").isString().notEmpty(),
  body("password").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const isDev = (process.env.NODE_ENV || "development") !== "production";
    const defaultEmail = "admin@swm.local";
    const defaultPassword = "admin123";
    const confEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL || (isDev ? defaultEmail : "")).trim();
    const confPassword = (process.env.ADMIN_PASSWORD || ADMIN_PASSWORD || (isDev ? defaultPassword : ""));
    if (!confEmail || !confPassword) {
      return res.status(500).json({ error: "Admin credentials not configured" });
    }
    const email = (req.body.email || "").trim();
    const password = (req.body.password || "");
    if (email !== confEmail || password !== confPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const admin = { id: "ADMIN001", name: "Super Admin", email: confEmail, role: "admin" };
    const token = issueRoleToken("admin", admin.id);
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("adminToken", token, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      maxAge: 30 * 24 * 3600 * 1000,
    });
    res.json({ admin, adminToken: token });
  }
);

router.post("/logout", (req, res) => {
  res.clearCookie("adminToken").json({ success: true });
});

router.get("/vendors", requireRole("admin"), AdminController.listVendors);
router.get("/customers", requireRole("admin"), AdminController.listCustomers);
router.get("/metrics/overview", requireRole("admin"), AdminController.metricsOverview);
router.get("/metrics/revenue-by-month", requireRole("admin"), AdminController.metricsRevenueByMonth);
router.get("/metrics/customers-by-month", requireRole("admin"), AdminController.metricsCustomersByMonth);
router.get("/metrics/providers-by-month", requireRole("admin"), AdminController.metricsProvidersByMonth);
router.get("/metrics/booking-trend", requireRole("admin"), AdminController.metricsBookingTrend);
router.get("/metrics/cities", requireRole("admin"), AdminController.metricsCities);

// ───── ADMIN CONTENT (Parents/Categories/Services) ─────
router.get("/parents", requireRole("admin"), async (_req, res) => {
  const items = await ServiceType.find().lean();
  res.json({ parents: items });
});
router.post("/parents",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("label").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await ServiceType.findOneAndUpdate({ id: req.body.id }, { ...req.body }, { new: true, upsert: true });
    await bumpContentVersion();
    res.status(201).json({ parent: doc });
  }
);
router.put("/parents/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await ServiceType.findOneAndUpdate({ id: req.params.id }, { ...req.body }, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await bumpContentVersion();
    res.json({ parent: doc });
  }
);
router.delete("/parents/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    await ServiceType.deleteOne({ id: req.params.id });
    await bumpContentVersion();
    res.json({ success: true });
  }
);

router.get("/categories", requireRole("admin"), async (req, res) => {
  const { gender, serviceType } = req.query;
  const q = {};
  if (gender) q.gender = gender;
  if (serviceType) q.serviceType = serviceType;
  const items = await Category.find(q).lean();
  res.json({ categories: items });
});
router.post("/categories",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("name").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Category.findOneAndUpdate({ id: req.body.id, gender: req.body.gender }, { ...req.body }, { new: true, upsert: true });
    await bumpContentVersion();
    res.status(201).json({ category: doc });
  }
);
router.put("/categories/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Category.findOneAndUpdate({ id: req.params.id, gender: req.body.gender }, { ...req.body }, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await bumpContentVersion();
    res.json({ category: doc });
  }
);
router.delete("/categories/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    await Category.deleteMany({ id: req.params.id }); // remove gender variants
    await bumpContentVersion();
    res.json({ success: true });
  }
);

router.get("/services", requireRole("admin"), async (req, res) => {
  const { category, gender } = req.query;
  const q = {};
  if (category) q.category = category;
  if (gender) q.gender = gender;
  const items = await Service.find(q).lean();
  res.json({ services: items });
});
router.post("/services",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("name").isString().notEmpty(),
  body("category").isString().notEmpty(),
  body("gender").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Service.findOneAndUpdate({ id: req.body.id }, { ...req.body }, { new: true, upsert: true });
    await bumpContentVersion();
    res.status(201).json({ service: doc });
  }
);
router.put("/services/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Service.findOneAndUpdate({ id: req.params.id }, { ...req.body }, { new: true });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await bumpContentVersion();
    res.json({ service: doc });
  }
);
router.delete("/services/:id",
  requireRole("admin"),
  param("id").isString(),
  async (req, res) => {
    await Service.deleteOne({ id: req.params.id });
    await bumpContentVersion();
    res.json({ success: true });
  }
);
router.get("/leaves", requireRole("admin"), async (_req, res) => {
  const items = await LeaveRequest.find().sort({ createdAt: -1 }).lean();
  res.json({ leaves: items });
});

router.patch("/leaves/:id/approve", requireRole("admin"), async (req, res) => {
  const item = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: "approved" }, { new: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  try {
    if (item.providerId) {
      await notify({
        recipientId: item.providerId,
        recipientRole: "provider",
        title: "Leave Approved",
        message: "Your leave request has been approved.",
        type: "leave_approved",
        meta: { leaveId: item._id?.toString?.() },
        respectProviderQuietHours: true,
      });
    }
  } catch {}
  res.json({ leave: item });
});

// ───── CUSTOM ENQUIRIES ─────
router.get("/custom-enquiries", requireRole("admin"), AdminController.listCustomEnquiries);
router.patch("/custom-enquiries/:id/price-quote", requireRole("admin"), AdminController.customEnquiryPriceQuote);
router.patch("/custom-enquiries/:id/final-approve", requireRole("admin"), AdminController.customEnquiryFinalApprove);

router.patch("/leaves/:id/reject", requireRole("admin"), async (req, res) => {
  const item = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  try {
    if (item.providerId) {
      await notify({
        recipientId: item.providerId,
        recipientRole: "provider",
        title: "Leave Rejected",
        message: "Your leave request has been rejected.",
        type: "leave_rejected",
        meta: { leaveId: item._id?.toString?.() },
        respectProviderQuietHours: true,
      });
    }
  } catch {}
  res.json({ leave: item });
});

router.patch("/vendors/:id/status", requireRole("admin"), param("id").isString(), body("status").isIn(["approved", "pending", "rejected", "blocked"]), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const v = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  try {
    if (v?._id) {
      const st = String(req.body.status || "").toLowerCase();
      await notify({
        recipientId: v._id.toString(),
        recipientRole: "vendor",
        title: st === "approved" ? "Vendor Approved" : st === "rejected" ? "Vendor Rejected" : "Status Updated",
        message: st === "approved"
          ? "Your vendor account has been approved by admin."
          : st === "rejected"
          ? "Your vendor account was rejected by admin."
          : `Your vendor status was updated to ${st}.`,
        type: st === "approved" ? "vendor_approved" : "vendor_rejected",
        meta: { vendorId: v._id.toString(), status: st },
      });
    }
  } catch {}
  res.json({ vendor: v });
});

router.patch("/vendors/:id/approve-zones", requireRole("admin"), param("id").isString(), async (req, res) => {
  const v = await Vendor.findById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vendor not found" });
  if (v.pendingZones && v.pendingZones.length > 0) {
    v.zones = [...new Set([...(v.zones || []), ...v.pendingZones])];
    v.pendingZones = [];
    await v.save();
    try {
      await notify({
        recipientId: v._id.toString(),
        recipientRole: "vendor",
        title: "Zones Approved",
        message: "Your request to add new service zones has been approved.",
        type: "vendor_zones_approved",
        meta: { vendorId: v._id.toString(), zones: v.zones },
      });
    } catch {}
  }
  res.json({ vendor: v });
});

router.patch("/vendors/:id/reject-zones", requireRole("admin"), param("id").isString(), async (req, res) => {
  const v = await Vendor.findByIdAndUpdate(req.params.id, { $set: { pendingZones: [] } }, { new: true });
  if (!v) return res.status(404).json({ error: "Vendor not found" });
  try {
    await notify({
      recipientId: v._id.toString(),
      recipientRole: "vendor",
      title: "Zones Request Rejected",
      message: "Your request to add new service zones was rejected.",
      type: "vendor_zones_rejected",
      meta: { vendorId: v._id.toString() },
    });
  } catch {}
  res.json({ vendor: v });
});

router.get("/providers", requireRole("admin"), AdminController.listProviders);

router.patch("/providers/:id/status", requireRole("admin"), param("id").isString(), body("status").isIn(["approved", "pending", "rejected", "blocked"]), async (req, res) => {
  const status = String(req.body.status || "").trim().toLowerCase();
  const updates = {};
  if (status === "approved") {
    updates.adminApprovalStatus = "approved";
    updates.approvalStatus = "approved";
  } else if (status === "rejected") {
    updates.adminApprovalStatus = "rejected";
    updates.approvalStatus = "rejected";
  } else {
    updates.approvalStatus = status;
  }
  const p = await ProviderAccount.findByIdAndUpdate(req.params.id, updates, { new: true });
  try {
    if (p?._id) {
      await notify({
        recipientId: p._id.toString(),
        recipientRole: "provider",
        title: status === "approved" ? "Admin Approved" : status === "rejected" ? "Admin Rejected" : "Status Updated",
        message: status === "approved"
          ? "Your profile has been approved by admin."
          : status === "rejected"
          ? "Your profile was rejected by admin."
          : `Your status was updated to ${status}.`,
        type: status === "approved" ? "provider_admin_approved" : "provider_rejected",
        meta: { providerId: p._id.toString(), status },
        respectProviderQuietHours: true,
      });
    }
  } catch {}
  res.json({ provider: p });
});

router.patch("/providers/:id/approve-zones", requireRole("admin"), param("id").isString(), async (req, res) => {
  const p = await ProviderAccount.findById(req.params.id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  if (p.pendingZones && p.pendingZones.length > 0) {
    p.zones = [...new Set([...(p.zones || []), ...p.pendingZones])];
    p.pendingZones = [];
    await p.save();
    try {
      await notify({
        recipientId: p._id.toString(),
        recipientRole: "provider",
        title: "Zones Approved",
        message: "Your request to add new service zones has been approved.",
        type: "provider_zones_approved",
        meta: { providerId: p._id.toString(), zones: p.zones },
      });
    } catch {}
  }
  res.json({ provider: p });
});

router.patch("/providers/:id/reject-zones", requireRole("admin"), param("id").isString(), async (req, res) => {
  const p = await ProviderAccount.findByIdAndUpdate(req.params.id, { $set: { pendingZones: [] } }, { new: true });
  if (!p) return res.status(404).json({ error: "Provider not found" });
  try {
    await notify({
      recipientId: p._id.toString(),
      recipientRole: "provider",
      title: "Zones Request Rejected",
      message: "Your request to add new service zones was rejected.",
      type: "provider_zones_rejected",
      meta: { providerId: p._id.toString() },
    });
  } catch {}
  res.json({ provider: p });
});

router.get("/bookings", requireRole("admin"), AdminController.listBookings);

router.patch("/bookings/:id/assign", requireRole("admin"), param("id").isString(), body("providerId").isString().notEmpty(), async (req, res) => {
  const now = new Date();
  const b = await Booking.findByIdAndUpdate(
    req.params.id,
    {
      assignedProvider: req.body.providerId,
      status: "pending",
      adminEscalated: false,
      lastAssignedAt: now,
      expiresAt: computeExpiresAt(now),
    },
    { new: true }
  );
  try {
    if (b?.assignedProvider) {
      await notify({
        recipientId: b.assignedProvider,
        recipientRole: "provider",
        title: "New Booking Assigned",
        message: `A booking #${b._id.toString().slice(-6)} has been assigned to you.`,
        type: "booking_assigned",
        meta: { bookingId: b._id.toString() },
        respectProviderQuietHours: true,
      });
    }
    if (b?.customerId) {
      await notify({
        recipientId: b.customerId,
        recipientRole: "user",
        title: "Professional Assigned",
        message: `A professional has been assigned to booking #${b._id.toString().slice(-6)}.`,
        type: "booking_assigned",
        meta: { bookingId: b._id.toString() },
      });
    }
  } catch {}
  res.json({ booking: b });
});

router.get("/coupons", requireRole("admin"), AdminController.listCoupons);

router.post("/coupons", requireRole("admin"), body("code").isString().notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const c = await Coupon.create(req.body);
  res.status(201).json({ coupon: c });
});

router.delete("/coupons/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

router.get("/banners", requireRole("admin"), async (_req, res) => {
  // Admin listing should show all banners (including scheduled/future), unlike /content/banners which is active-only.
  const items = await Banner.find().lean();
  items.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || (Number(b.id || 0) - Number(a.id || 0)));
  res.json({ banners: items });
});

router.post("/banners", requireRole("admin"), body("gender").isString(), body("id").isNumeric(), async (req, res) => {
  const b = await Banner.create({
    gender: req.body.gender,
    id: req.body.id,
    title: req.body.title,
    subtitle: req.body.subtitle,
    gradient: req.body.gradient,
    image: req.body.image,
    cta: req.body.cta,
    linkTo: req.body.linkTo || "",
    priority: Number(req.body.priority || 1),
    startAt: req.body.startAt ? new Date(req.body.startAt) : null,
    endAt: req.body.endAt ? new Date(req.body.endAt) : null,
  });
  await bumpContentVersion();
  res.status(201).json({ banner: b });
});

router.post("/banners/upload", requireRole("admin"), upload.single("image"), AdminController.uploadBanner);

router.put("/banners/:id/:gender", requireRole("admin"), param("id").isString(), param("gender").isString(), async (req, res) => {
  const doc = await Banner.findOneAndUpdate(
    { id: Number(req.params.id), gender: req.params.gender },
    {
      ...req.body,
      linkTo: req.body.linkTo || "",
      priority: Number(req.body.priority || 1),
      startAt: req.body.startAt ? new Date(req.body.startAt) : null,
      endAt: req.body.endAt ? new Date(req.body.endAt) : null,
    },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  await bumpContentVersion();
  res.json({ banner: doc });
});

router.delete("/banners/:id/:gender", requireRole("admin"), param("id").isString(), param("gender").isString(), async (req, res) => {
  await Banner.deleteOne({ id: Number(req.params.id), gender: req.params.gender });
  await bumpContentVersion();
  res.json({ success: true });
});

// â”€â”€â”€â”€â”€ ADMIN HOME CONTENT (Spotlights / Gallery / Testimonials) â”€â”€â”€â”€â”€
router.get("/spotlights", requireRole("admin"), async (_req, res) => {
  const items = await Spotlight.find().lean();
  items.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || String(b.id).localeCompare(String(a.id)));
  res.json({ spotlights: items });
});

router.post("/spotlights/upload-video", requireRole("admin"), uploadMedia.single("video"), AdminController.uploadSpotlightVideo);

router.post("/spotlights",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("title").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Spotlight.findOneAndUpdate(
      { id: req.body.id },
      { ...req.body, priority: Number(req.body.priority || 1), startAt: req.body.startAt ? new Date(req.body.startAt) : null, endAt: req.body.endAt ? new Date(req.body.endAt) : null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await bumpContentVersion();
    res.status(201).json({ spotlight: doc });
  }
);
router.put("/spotlights/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  const doc = await Spotlight.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, priority: Number(req.body.priority || 1), startAt: req.body.startAt ? new Date(req.body.startAt) : null, endAt: req.body.endAt ? new Date(req.body.endAt) : null },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  await bumpContentVersion();
  res.json({ spotlight: doc });
});
router.delete("/spotlights/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  await Spotlight.deleteOne({ id: req.params.id });
  await bumpContentVersion();
  res.json({ success: true });
});

router.get("/gallery", requireRole("admin"), async (_req, res) => {
  const items = await GalleryItem.find().lean();
  items.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)) || String(b.id).localeCompare(String(a.id)));
  res.json({ gallery: items });
});

router.post("/gallery/upload-image", requireRole("admin"), upload.single("image"), AdminController.uploadGalleryImage);

router.post("/gallery",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("image").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await GalleryItem.findOneAndUpdate(
      { id: req.body.id },
      { ...req.body, priority: Number(req.body.priority || 1) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await bumpContentVersion();
    res.status(201).json({ gallery: doc });
  }
);
router.put("/gallery/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  const doc = await GalleryItem.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, priority: Number(req.body.priority || 1) },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  await bumpContentVersion();
  res.json({ gallery: doc });
});
router.delete("/gallery/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  await GalleryItem.deleteOne({ id: req.params.id });
  await bumpContentVersion();
  res.json({ success: true });
});

router.post("/testimonials",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("name").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const doc = await Testimonial.findOneAndUpdate(
      { id: req.body.id },
      { ...req.body, priority: Number(req.body.priority || 1) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await bumpContentVersion();
    res.status(201).json({ testimonial: doc });
  }
);
router.put("/testimonials/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  const doc = await Testimonial.findOneAndUpdate(
    { id: req.params.id },
    { ...req.body, priority: Number(req.body.priority || 1) },
    { new: true }
  );
  if (!doc) return res.status(404).json({ error: "Not found" });
  await bumpContentVersion();
  res.json({ testimonial: doc });
});
router.delete("/testimonials/:id", requireRole("admin"), param("id").isString(), async (req, res) => {
  await Testimonial.deleteOne({ id: req.params.id });
  await bumpContentVersion();
  res.json({ success: true });
});

router.get("/referral", requireRole("admin"), async (_req, res) => {
  const s = await ReferralSettings.findOne().lean();
  res.json({ settings: s || { referrerBonus: 100, refereeBonus: 50, maxReferrals: 10, isActive: true } });
});

router.put("/referral", requireRole("admin"), body("referrerBonus").isNumeric(), body("refereeBonus").isNumeric(), body("maxReferrals").isNumeric(), body("isActive").isBoolean(), async (req, res) => {
  const s = await ReferralSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
  res.json({ settings: s });
});

router.get("/commission", requireRole("admin"), async (_req, res) => {
  const s = await CommissionSettings.findOne().lean();
  res.json({ settings: s || { rate: 15, minPayout: 500 } });
});

router.put("/commission", requireRole("admin"), body("rate").isNumeric(), body("minPayout").isNumeric(), async (req, res) => {
  const s = await CommissionSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
  res.json({ settings: s });
});

router.get("/booking-settings", requireRole("admin"), async (_req, res) => {
  const s = await BookingSettings.findOne().lean();
  res.json({
    settings: s || {
      minBookingAmount: 500,
      minLeadTimeMinutes: 60,
      providerBufferMinutes: 60,
      serviceStartTime: "08:00",
      serviceEndTime: "19:00",
      slotIntervalMinutes: 30,
      maxBookingDays: 6,
      maxServicesPerBooking: 10,
      providerSearchLimit: 5,
      bookingHoldMinutes: 10,
      maxServiceRadiusKm: 5,
      providerNotificationStartTime: "07:00",
      providerNotificationEndTime: "22:00",
      allowPayAfterService: true,
      prebookingRequired: false,
    },
  });
});

router.put(
  "/booking-settings",
  requireRole("admin"),
  body("minBookingAmount").optional().isNumeric(),
  body("minLeadTimeMinutes").optional().isNumeric(),
  body("providerBufferMinutes").optional().isNumeric(),
  body("serviceStartTime").optional().isString(),
  body("serviceEndTime").optional().isString(),
  body("slotIntervalMinutes").optional().isNumeric(),
  body("maxBookingDays").optional().isNumeric(),
  body("maxServicesPerBooking").optional().isNumeric(),
  body("providerSearchLimit").optional().isNumeric(),
  body("bookingHoldMinutes").optional().isNumeric(),
  body("maxServiceRadiusKm").optional().isNumeric(),
  body("providerNotificationStartTime").optional().isString(),
  body("providerNotificationEndTime").optional().isString(),
  body("allowPayAfterService").optional().isBoolean(),
  body("prebookingRequired").optional().isBoolean(),
  async (req, res) => {
    const s = await BookingSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.json({ settings: s });
});

router.get("/performance-criteria", requireRole("admin"), async (_req, res) => {
  const s = await PerformanceSettings.findOne().lean();
  res.json({ settings: s || { minWeeklyHours: 20, minRatingThreshold: 4.5, maxCancellationsThreshold: 5 } });
});

router.put("/performance-criteria", requireRole("admin"), body("minWeeklyHours").isNumeric(), body("minRatingThreshold").isNumeric(), body("maxCancellationsThreshold").isNumeric(), async (req, res) => {
  const s = await PerformanceSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
  res.json({ settings: s });
});

// Customized Enquiries (Admin)
router.get("/custom-enquiries", requireRole("admin"), BookingsController.adminListCustomEnquiries);
router.patch("/custom-enquiries/:id/price-quote",
  requireRole("admin"),
  body("items").isArray(),
  body("totalAmount").isNumeric(),
  body("discountPrice").optional().isNumeric(),
  body("prebookAmount").optional().isNumeric(),
  body("totalServiceTime").optional().isString(),
  body("quoteExpiryAt").optional().isString(),
  body("quoteExpiryHours").optional().isNumeric(),
  BookingsController.adminPriceQuote
);
router.patch("/custom-enquiries/:id/final-approve", requireRole("admin"), BookingsController.adminFinalApprove);

router.put(
  "/settings",
  requireRole("admin"),
  body("startTime").isString(),
  body("endTime").isString(),
  body("providerStartTime").optional().isString(),
  body("providerEndTime").optional().isString(),
  body("autoAssign").isBoolean(),
  body("bufferMinutes").optional().isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const s = await OfficeSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
    res.json({ settings: s });
  }
);

router.get("/sos", requireRole("admin"), async (_req, res) => {
  const alerts = await SOSAlert.find().sort({ createdAt: -1 }).lean();
  res.json({ alerts });
});

router.patch("/sos/:id/resolve", requireRole("admin"), param("id").isString(), async (req, res) => {
  const a = await SOSAlert.findByIdAndUpdate(req.params.id, { status: "resolved" }, { new: true });
  res.json({ alert: a });
});

// System Settings
router.get("/system-settings", async (_req, res) => {
  const s = await SystemSettings.findOne().lean();
  res.json({ settings: s || { menSectionEnabled: false } });
});

router.put("/system-settings", requireRole("admin"), body("menSectionEnabled").isBoolean(), async (req, res) => {
  const s = await SystemSettings.findOneAndUpdate({}, req.body, { upsert: true, new: true });
  res.json({ settings: s });
});

// ───── CITIES & ZONES ─────
router.get("/cities", requireRole("admin"), AdminController.listCities);
router.post("/cities", requireRole("admin"), AdminController.createCity);
router.put("/cities/:cityId", requireRole("admin"), AdminController.updateCity);
router.delete("/cities/:cityId", requireRole("admin"), AdminController.deleteCity);
router.get("/cities/:cityId/zones", requireRole("admin"), AdminController.listZones);
router.post("/cities/:cityId/zones", requireRole("admin"), AdminController.createZone);
router.put("/zones/:zoneId", requireRole("admin"), AdminController.updateZone);
router.delete("/zones/:zoneId", requireRole("admin"), AdminController.deleteZone);
router.get("/zones/:zoneId/stats", requireRole("admin"), AdminController.getZoneStats);

// ───── ZONE CREATION FROM PROVIDER REQUESTS (Phase 4) ─────
router.get("/pending-zone-creations", requireRole("admin"), AdminController.listPendingZoneCreations);
router.post("/zones/create-from-request", requireRole("admin"), AdminController.createZoneFromRequest);
router.post("/zones/reject-request", requireRole("admin"), AdminController.rejectZoneCreationRequest);

router.get("/subscription-settings", requireRole("admin"), AdminSubscriptionController.getSettings);
router.put("/subscription-settings", requireRole("admin"), AdminSubscriptionController.updateSettings);
router.get("/subscription-plans", requireRole("admin"), AdminSubscriptionController.listPlans);
router.post("/subscription-plans", requireRole("admin"), AdminSubscriptionController.createPlan);
router.put("/subscription-plans/:planId", requireRole("admin"), AdminSubscriptionController.updatePlan);
router.delete("/subscription-plans/:planId", requireRole("admin"), AdminSubscriptionController.deletePlan);
router.get("/subscription-report", requireRole("admin"), AdminSubscriptionController.report);
router.post(
  "/push/broadcast",
  requireRole("admin"),
  body("roles").isArray({ min: 1 }),
  body("title").isString().notEmpty(),
  body("message").isString().notEmpty(),
  AdminPushController.broadcast
);
router.get("/push/broadcast/history", requireRole("admin"), AdminPushController.history);
router.post("/push/test", requireRole("admin"), AdminPushController.test);

// ───── PAYOUTS ─────
router.get("/payouts", requireRole("admin"), AdminController.listPayouts);
router.patch("/payouts/:id/status", requireRole("admin"), AdminController.updatePayoutStatus);

// ───── FEEDBACK MANAGEMENT ─────
router.get("/feedback", requireRole("admin"), AdminController.listFeedback);
router.get("/feedback/stats", requireRole("admin"), AdminController.getFeedbackStats);
router.delete("/feedback/:id", requireRole("admin"), AdminController.deleteFeedback);
router.patch("/feedback/:id/status", requireRole("admin"), AdminController.updateFeedbackStatus);

// ───── CUSTOMER COD MANAGEMENT ─────
router.patch("/customers/:id/toggle-cod", requireRole("admin"), AdminController.toggleCustomerCOD);
router.patch("/customers/:id/status", requireRole("admin"), AdminController.updateCustomerStatus);

export default router;
