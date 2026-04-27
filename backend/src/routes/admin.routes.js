import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import Vendor from "../models/Vendor.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import Coupon from "../models/Coupon.js";
import SOSAlert from "../models/SOSAlert.js";
import { ReferralSettings, CommissionSettings, BookingSettings, PerformanceSettings, SystemSettings } from "../models/Settings.js";
import { upload, uploadMedia } from "../middleware/upload.js";
import { uploadBase64Image } from "../startup/cloudinary.js";
import { issueRoleToken, requireRole } from "../middleware/roles.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import { getIO } from "../startup/socket.js";
import * as AdminController from "../modules/admin/controllers/admin.controller.js";
import LeaveRequest from "../models/LeaveRequest.js";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../config.js";
import { ServiceType, Category, Service, OfficeSettings, Banner, BookingType } from "../models/Content.js";
import { Spotlight, GalleryItem, Testimonial } from "../models/SiteContent.js";
import { City } from "../models/CityZone.js";
import * as BookingsController from "../modules/bookings/controllers/bookings.controller.js";
import { canAssignProviderToBooking, computeExpiresAt } from "../lib/assignment.js";
import { bumpContentVersion } from "../lib/contentCache.js";
import { notify } from "../lib/notify.js";
import * as AdminSubscriptionController from "../modules/subscriptions/controllers/adminSubscription.controller.js";
import * as AdminPushController from "../modules/admin/controllers/adminPush.controller.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { defaultSlotsMap } from "../lib/slots.js";
import { invalidateProviderSlots } from "../lib/availability.js";

const router = Router();

// Helper function to create default availability for provider (30 days)
async function createDefaultProviderAvailability(providerId) {
  try {
    const office = await OfficeSettings.findOne().lean();
    const defaultSlots = defaultSlotsMap(office?.providerStartTime || "07:00", office?.providerEndTime || "22:00");
    const availableSlots = Object.keys(defaultSlots).filter(slot => defaultSlots[slot] === true);
    
    // Create availability for next 30 days
    const promises = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      promises.push(
        ProviderDayAvailability.findOneAndUpdate(
          { providerId: providerId.toString(), date: dateStr },
          { $set: { availableSlots } },
          { upsert: true, new: true }
        )
      );
    }
    
    await Promise.all(promises);
    console.log(`[Provider] Created default availability for provider ${providerId} (30 days, 7 AM - 10 PM)`);
  } catch (error) {
    console.error(`[Provider] Error creating default availability for ${providerId}:`, error.message);
  }
}

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
    if (req.body.image) {
      req.body.image = await uploadBase64Image(req.body.image, "service-types");
    }
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
    if (req.body.image) {
      req.body.image = await uploadBase64Image(req.body.image, "service-types");
    }
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
  const { gender, serviceType, minimal } = req.query;
  const q = {};
  if (gender) q.gender = gender;
  if (serviceType) q.serviceType = serviceType;
  
  let query = Category.find(q);
  if (minimal === "true") {
    query = query.select("id name serviceType gender");
  }
  
  const items = await query.lean();
  res.json({ categories: items });
});
router.post("/categories",
  requireRole("admin"),
  body("id").isString().notEmpty(),
  body("name").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "categories");
    if (req.body.icon) req.body.icon = await uploadBase64Image(req.body.icon, "categories");
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
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "categories");
    if (req.body.icon) req.body.icon = await uploadBase64Image(req.body.icon, "categories");
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
  const { category, gender, page = 1, limit = 10, minimal } = req.query;
  const q = {};
  if (category) q.category = category;
  if (gender) q.gender = gender;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Service.countDocuments(q);
  
  let query = Service.find(q);
  if (minimal === "true") {
    query = query.select("id name category gender");
  } else {
    query = query.select("-gallery -steps");
  }
  
  const items = await query.skip(skip).limit(parseInt(limit)).lean();
    
  res.json({ 
    services: items, 
    total,
    page: parseInt(page),
    limit: parseInt(limit)
  });
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
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "services");
    if (req.body.gallery && Array.isArray(req.body.gallery)) {
      req.body.gallery = await Promise.all(req.body.gallery.map(img => uploadBase64Image(img, "services")));
    }
    if (req.body.steps && Array.isArray(req.body.steps)) {
      req.body.steps = await Promise.all(req.body.steps.map(async step => {
        if (step.image) step.image = await uploadBase64Image(step.image, "services");
        return step;
      }));
    }
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
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "services");
    if (req.body.gallery && Array.isArray(req.body.gallery)) {
      req.body.gallery = await Promise.all(req.body.gallery.map(img => uploadBase64Image(img, "services")));
    }
    if (req.body.steps && Array.isArray(req.body.steps)) {
      req.body.steps = await Promise.all(req.body.steps.map(async step => {
        if (step.image) step.image = await uploadBase64Image(step.image, "services");
        return step;
      }));
    }
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
  
  // Enrich leaves with provider name and city
  const providerIds = [...new Set(items.map(i => i.providerId))].filter(Boolean);
  const providers = await ProviderAccount.find({ _id: { $in: providerIds } }, "name city").lean();
  const providerMap = providers.reduce((acc, p) => {
    acc[p._id.toString()] = p;
    return acc;
  }, {});

  const enriched = items.map(item => ({
    ...item,
    providerName: providerMap[item.providerId]?.name || "N/A",
    city: providerMap[item.providerId]?.city || "N/A",
  }));

  res.json({ leaves: enriched });
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
  const current = await Vendor.findById(req.params.id);
  if (!current) return res.status(404).json({ error: "Vendor not found" });
  const nextStatus = String(req.body.status || "").toLowerCase();
  const v = await Vendor.findByIdAndUpdate(req.params.id, { status: nextStatus }, { new: true });
  if (nextStatus === "approved" && v?.cityId) {
    try {
      await City.findByIdAndUpdate(v.cityId, { activeVendorId: v._id.toString() });
    } catch {}
  }
  try {
    if (v?._id) {
      const st = nextStatus;
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
    updates.isOnline = true;
  } else if (status === "rejected") {
    updates.adminApprovalStatus = "rejected";
    updates.approvalStatus = "rejected";
  } else {
    updates.approvalStatus = status;
  }
  const p = await ProviderAccount.findByIdAndUpdate(req.params.id, updates, { new: true });
  
  // Create default availability when provider is approved
  if (status === "approved" && p?._id) {
    await createDefaultProviderAvailability(p._id);
  }
  
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

router.patch("/providers/:id/profile", requireRole("admin"), param("id").isString(), AdminController.updateProviderProfile);
router.patch("/providers/:id/wallet/adjust", 
  requireRole("admin"), 
  param("id").isString(), 
  body("amount").isNumeric(),
  body("type").isIn(["add", "deduct"]),
  body("reason").optional().isString(),
  AdminController.adjustProviderWallet
);


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
router.get("/bookings/:id/available-providers", requireRole("admin"), AdminController.getAvailableProvidersForBooking);
router.patch("/bookings/:id/approve-images", requireRole("admin"), param("id").isString(), AdminController.approveBookingImages);


router.patch("/bookings/:id/assign", requireRole("admin"), param("id").isString(), body("providerId").isString().notEmpty(), async (req, res) => {
  try {
    const now = new Date();
    const { id } = req.params;
    const providerId = String(req.body.providerId || "").trim();

    const existing = await Booking.findById(id);
    if (!existing) return res.status(404).json({ error: "Booking not found" });

    const provider = await ProviderAccount.findById(providerId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    // 1. Check availability
    const allowed = await canAssignProviderToBooking(providerId, existing.toObject(), { ignoreLeadTime: true });
    if (!allowed) {
      return res.status(409).json({ error: "Selected provider is not free for this booking slot." });
    }

    const previousProviderId = String(existing.assignedProvider || "").trim();
    
    // 2. Commission handling logic (aligned with vendor.controller.js)
    const commissionSettings = await CommissionSettings.findOne().lean();
    const rate = Number(commissionSettings?.rate || 20);
    const totalAmount = Number(existing.totalAmount || 0);
    const discountAmount = Number(existing.discount || 0);
    const fundedBy = String(existing.discountFundedBy || "admin").toLowerCase();

    let required = 0;
    if (fundedBy === "admin") {
      const originalTotal = totalAmount + discountAmount;
      const discountRate = originalTotal > 0 ? (discountAmount / originalTotal) * 100 : 0;
      const effectiveRate = Math.max(0, rate - discountRate);
      required = Math.round(totalAmount * (effectiveRate / 100));
    } else {
      // For "platform" funded or other sources, commission is on the net amount paid by customer
      required = Math.round(totalAmount * (rate / 100));
    }
    required = Math.max(required, 0);

    if (required > 0) {
      // Refund previous provider if commission was already charged
      if (existing.commissionChargedAt && previousProviderId && previousProviderId !== providerId) {
        const prevProvider = await ProviderAccount.findById(previousProviderId);
        if (prevProvider && existing.commissionAmount > 0) {
          prevProvider.credits = Number(prevProvider.credits || 0) + existing.commissionAmount;
          await prevProvider.save();

          await ProviderWalletTxn.create({
            providerId: previousProviderId,
            bookingId: existing._id.toString(),
            type: "commission_refund",
            amount: existing.commissionAmount,
            balanceAfter: prevProvider.credits,
            meta: { reason: "admin_reassignment" },
          });

          try {
            await notify({
              recipientId: previousProviderId,
              recipientRole: "provider",
              type: "commission_refund",
              meta: { bookingId: existing._id.toString(), amount: existing.commissionAmount },
              respectProviderQuietHours: true,
            });
          } catch (notifyErr) {}
        }
      }

      // Check new provider balance
      const hasBalance = Number(provider.credits || 0) >= required;
      
      if (hasBalance) {
        // Deduct commission from new provider
        provider.credits = Math.max(Number(provider.credits || 0) - required, 0);
        await provider.save();

        // Update booking commission details
        existing.commissionAmount = required;
        existing.commissionChargedAt = new Date();
        existing.commissionRefundedAt = null;

        // Create transaction record
        await ProviderWalletTxn.create({
          providerId: provider._id.toString(),
          bookingId: existing._id.toString(),
          type: "commission_hold",
          amount: -required,
          balanceAfter: provider.credits,
          meta: { rate, totalAmount, source: "admin_assignment" },
        });

        // Notify new provider about commission deduction
        try {
          await notify({
            recipientId: providerId,
            recipientRole: "provider",
            type: "commission_hold",
            meta: { bookingId: existing._id.toString(), amount: required },
            respectProviderQuietHours: true,
          });
        } catch (notifyErr) {}
      } else {
        // Low balance: Assign but leave commissionChargedAt as null for manual activation
        existing.commissionAmount = required;
        existing.commissionChargedAt = null;
        existing.commissionRefundedAt = null;
      }
    }

    // 3. Update Booking Status and Assignee
    existing.assignedProvider = providerId;
    // Set status to "accepted" so it appears as mandatory in Provider Panel
    existing.status = "accepted";
    existing.isMandatory = true;
    existing.adminEscalated = false;
    existing.vendorEscalated = false;
    existing.lastAssignedAt = now;
    existing.expiresAt = null; // Manual assignment should not expire automatically
    
    const b = await existing.save();

    // 4. Notifications and Sync
    try {
      const io = getIO();
      io?.of("/bookings").emit("assignment:changed", {
        id: b._id.toString(),
        bookingId: b._id.toString(),
        toProvider: providerId,
        fromProvider: previousProviderId,
        reason: "admin_assigned",
        status: "accepted"
      });
      io?.of("/bookings").emit("status:update", { 
        id: b._id.toString(), 
        status: "vendor_assigned" 
      });
    } catch (ioErr) {}

    // Invalidate slot cache
    try {
      if (b?.slot?.date) {
        const ids = Array.from(new Set([previousProviderId, providerId].filter(Boolean)));
        for (const pid of ids) {
          await invalidateProviderSlots(pid, b.slot.date);
        }
      }
    } catch (slotErr) {}

    // Send push/app notifications
    try {
      if (b?.assignedProvider) {
        await notify({
          recipientId: b.assignedProvider,
          recipientRole: "provider",
          type: "booking_assigned",
          meta: { bookingId: b._id.toString(), reason: "admin_assigned" },
          respectProviderQuietHours: true,
        });
      }
      if (b?.customerId) {
        await notify({
          recipientId: b.customerId,
          recipientRole: "user",
          type: "booking_assigned",
          meta: { bookingId: b._id.toString() },
        });
      }
    } catch (notifyErr) {}

    res.json({ booking: b });
  } catch (error) {
    console.error("[Admin] Assignment Error:", error);
    res.status(500).json({ error: "Failed to assign provider" });
  }
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
    if (req.body.poster) req.body.poster = await uploadBase64Image(req.body.poster, "spotlights");
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
  if (req.body.poster) req.body.poster = await uploadBase64Image(req.body.poster, "spotlights");
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
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "gallery");
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
  if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "gallery");
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
    if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "testimonials");
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
  if (req.body.image) req.body.image = await uploadBase64Image(req.body.image, "testimonials");
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

router.put("/referral", 
  requireRole("admin"), 
  body("referrerBonus").isNumeric(), 
  body("refereeBonus").isNumeric(), 
  body("maxReferrals").isNumeric(), 
  body("isActive").isBoolean(), 
  body("adminManagedCodes").optional().isArray(),
  async (req, res) => {
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

// ==================== BOOKING TYPES MANAGEMENT ====================

// GET /admin/booking-types - List all booking types
router.get("/booking-types", requireRole("admin"), async (req, res) => {
  try {
    const types = await BookingType.find().sort({ createdAt: 1 }).lean();
    res.json({ bookingTypes: types });
  } catch (error) {
    console.error("[Admin] Error fetching booking types:", error);
    res.status(500).json({ error: "Failed to fetch booking types" });
  }
});

// POST /admin/booking-types - Create new booking type
router.post("/booking-types", 
  requireRole("admin"),
  body("id").isString().notEmpty().trim()
    .matches(/^[a-z0-9_-]+$/).withMessage("ID must contain only lowercase letters, numbers, hyphens, and underscores (no spaces)"),
  body("label").isString().notEmpty().trim(),
  body("icon").isString().notEmpty().trim(),
  body("description").isString().notEmpty().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id, label, icon, description } = req.body;
      
      // Additional validation: no spaces allowed in ID
      if (id.includes(' ')) {
        return res.status(400).json({ 
          error: "Booking type ID cannot contain spaces. Use hyphens or underscores instead (e.g., 'fast-return' or 'fast_return')" 
        });
      }
      
      // Check if id already exists
      const existing = await BookingType.findOne({ id });
      if (existing) {
        return res.status(400).json({ error: "Booking type ID already exists" });
      }
      
      const bookingType = await BookingType.create({
        id: id.toLowerCase().trim(),
        label: label.trim(),
        icon: icon.trim(),
        description: description.trim()
      });
      
      // Invalidate cache
      await bumpContentVersion();
      
      console.log(`[Admin] Created booking type: ${id}`);
      res.status(201).json({ bookingType });
    } catch (error) {
      console.error("[Admin] Error creating booking type:", error);
      
      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(400).json({ error: "Booking type ID already exists" });
      }
      
      res.status(500).json({ error: "Failed to create booking type" });
    }
  }
);

// PATCH /admin/booking-types/:id - Update booking type
router.patch("/admin/booking-types/:id",
  requireRole("admin"),
  param("id").isString().notEmpty(),
  body("label").optional().isString().trim(),
  body("icon").optional().isString().trim(),
  body("description").optional().isString().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      const updates = {};
      
      if (req.body.label) updates.label = req.body.label.trim();
      if (req.body.icon) updates.icon = req.body.icon.trim();
      if (req.body.description) updates.description = req.body.description.trim();
      
      const bookingType = await BookingType.findOneAndUpdate(
        { id },
        updates,
        { new: true }
      );
      
      if (!bookingType) {
        return res.status(404).json({ error: "Booking type not found" });
      }
      
      // Invalidate cache
      await bumpContentVersion();
      
      console.log(`[Admin] Updated booking type: ${id}`);
      res.json({ bookingType });
    } catch (error) {
      console.error("[Admin] Error updating booking type:", error);
      res.status(500).json({ error: "Failed to update booking type" });
    }
  }
);

// DELETE /admin/booking-types/:id - Delete booking type
router.delete("/admin/booking-types/:id",
  requireRole("admin"),
  param("id").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { id } = req.params;
      
      console.log(`[Admin] Attempting to delete booking type with id: "${id}"`);
      
      // Check if booking type exists first
      const existingType = await BookingType.findOne({ id });
      console.log(`[Admin] Found booking type:`, existingType);
      
      if (!existingType) {
        console.log(`[Admin] Booking type not found with id: "${id}"`);
        return res.status(404).json({ error: `Booking type not found: ${id}` });
      }
      
      // Check if booking type is in use
      const categoriesUsingType = await Category.countDocuments({ bookingType: id });
      const servicesUsingType = await Service.countDocuments({ bookingType: id });
      
      if (categoriesUsingType > 0 || servicesUsingType > 0) {
        return res.status(400).json({ 
          error: "Cannot delete booking type that is in use",
          usage: {
            categories: categoriesUsingType,
            services: servicesUsingType
          }
        });
      }
      
      const bookingType = await BookingType.findOneAndDelete({ id });
      
      // Invalidate cache
      await bumpContentVersion();
      
      console.log(`[Admin] Successfully deleted booking type: ${id}`);
      res.json({ message: "Booking type deleted successfully" });
    } catch (error) {
      console.error("[Admin] Error deleting booking type:", error);
      res.status(500).json({ error: "Failed to delete booking type" });
    }
  }
);

export default router;
