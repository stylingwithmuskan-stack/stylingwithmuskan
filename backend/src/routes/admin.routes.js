import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import Vendor from "../models/Vendor.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import Coupon from "../models/Coupon.js";
import SOSAlert from "../models/SOSAlert.js";
import { ReferralSettings, CommissionSettings, BookingSettings } from "../models/Settings.js";
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
  res.json({ leave: item });
});

// ───── CUSTOM ENQUIRIES ─────
router.get("/custom-enquiries", requireRole("admin"), AdminController.listCustomEnquiries);
router.patch("/custom-enquiries/:id/price-quote", requireRole("admin"), AdminController.customEnquiryPriceQuote);
router.patch("/custom-enquiries/:id/final-approve", requireRole("admin"), AdminController.customEnquiryFinalApprove);

router.patch("/leaves/:id/reject", requireRole("admin"), async (req, res) => {
  const item = await LeaveRequest.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ leave: item });
});

router.patch("/vendors/:id/status", requireRole("admin"), param("id").isString(), body("status").isIn(["approved", "pending", "rejected", "blocked"]), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const v = await Vendor.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  res.json({ vendor: v });
});

router.get("/providers", requireRole("admin"), AdminController.listProviders);

router.patch("/providers/:id/status", requireRole("admin"), param("id").isString(), body("status").isIn(["approved", "pending", "rejected", "blocked"]), async (req, res) => {
  const p = await ProviderAccount.findByIdAndUpdate(req.params.id, { approvalStatus: req.body.status }, { new: true });
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
  }
);

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

export default router;
