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
import VendorSubAccount from "../../../models/VendorSubAccount.js";
import { notify } from "../../../lib/notify.js";
import { issueOtp, OTP_LENGTH, verifyOtpValue } from "../../../lib/otpService.js";
import { getMarketingCreditsBalance, getSubscriptionSnapshot } from "../../../lib/subscriptions.js";
import ProviderDayAvailability from "../../../models/ProviderDayAvailability.js";
import { defaultSlotsMap } from "../../../lib/slots.js";

// Helper function to create default availability for provider (30 days)
async function createDefaultProviderAvailability(providerId) {
  try {
    const defaultSlots = defaultSlotsMap("07:00", "22:00");
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
    status: "pending",
  });
  res.status(201).json({ vendor: v, message: "Registration submitted for admin approval" });
}

export async function registerRequest(req, res) {
  const { phone } = req.body;
  const isDev = (process.env.NODE_ENV !== "production");
  
  // Check if vendor already exists
  const exists = await Vendor.findOne({ phone }).lean();
  if (exists) return res.status(409).json({ error: "Account already exists. Please login." });

  let issued;
  try {
    issued = await issueOtp({
      redis,
      key: `v:reg:otp:${phone}`,
      phone,
      role: "vendor",
      intent: "register",
    });
  } catch {
    return res.status(502).json({ error: "Failed to send OTP" });
  }
  res.json({
    success: true,
    message: issued.message,
    deliveryMode: issued.deliveryMode,
    otpPreview: isDev ? issued.otp : "******",
  });
}

export async function verifyRegistrationOtp(req, res) {
  const { phone, otp, name, email, city, zones } = req.body;
  const valid = await verifyOtpValue({
    redis,
    key: `v:reg:otp:${phone}`,
    phone,
    role: "vendor",
    otp,
  });

  if (!valid) return res.status(400).json({ error: "Invalid OTP" });

  console.log('[Vendor Registration] Starting registration:', { phone, name, email, city, zones });

  try {
    const v = await Vendor.create({
      name,
      email,
      phone,
      city: normCity(city),
      zones: Array.isArray(zones) ? zones : [zones],
      status: "pending",
    });

    console.log('[Vendor Registration] SUCCESS - Vendor created:', { 
      id: v._id.toString(), 
      name: v.name, 
      city: v.city, 
      zones: v.zones,
      status: v.status 
    });

    // Notify admin
    try {
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "New Vendor Request",
        message: `New vendor ${name} has requested registration for ${city} (${(v.zones || []).join(", ")}).`,
        type: "system",
        meta: { vendorId: v._id.toString() },
      });
    } catch {}

    const token = issueRoleToken("vendor", v._id?.toString() || v.email);
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("vendorToken", token, {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      maxAge: 30 * 24 * 3600 * 1000,
    });

    res.status(201).json({ 
      success: true, 
      message: "Registration submitted for admin approval",
      vendor: v,
      vendorToken: token
    });
  } catch (err) {
    console.error('[Vendor Registration] ERROR:', err.message, err.stack);
    res.status(400).json({ error: err.message || "Registration failed" });
  }
}

export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const v = await Vendor.findOne({ email: req.body.email }).lean();
  if (!v) return res.status(400).json({ error: "Vendor not found" });
  if (v.status !== "approved") return res.status(403).json({ error: "Your account is pending admin approval" });
  const token = issueRoleToken("vendor", v._id?.toString() || v.email);
  const subscription = await getSubscriptionSnapshot(v._id?.toString() || v.email, "vendor");
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("vendorToken", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ vendor: { ...v, subscription }, vendorToken: token });
}

export async function getMe(req, res) {
  const v = await Vendor.findById(req.auth?.sub).lean();
  if (!v) return res.status(404).json({ error: "Vendor not found" });
  const subscription = await getSubscriptionSnapshot(v._id?.toString() || v.email, "vendor");
  res.json({ vendor: { ...v, subscription } });
}

export async function logout(_req, res) {
  res.clearCookie("vendorToken").json({ success: true });
}

export async function requestOtp(req, res) {
  const phone = (req.body.phone || "").trim();
  if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: "Invalid phone" });
  const isDev = (process.env.NODE_ENV !== "production");
  const exists = await Vendor.findOne({ phone }).lean();
  if (!exists) return res.status(404).json({ error: "No account found. Please register first." });
  let issued;
  try {
    issued = await issueOtp({
      redis,
      key: `v:otp:${phone}`,
      phone,
      role: "vendor",
      intent: "login",
    });
  } catch {
    return res.status(502).json({ error: "Failed to send OTP" });
  }
  res.json({
    success: true,
    message: issued.message,
    deliveryMode: issued.deliveryMode,
    otpPreview: isDev ? issued.otp : "******",
  });
}

export async function verifyOtp(req, res) {
  const phone = (req.body.phone || "").trim();
  const otp = (req.body.otp || "").trim();
  if (!/^\d{10}$/.test(phone) || otp.length !== OTP_LENGTH) return res.status(400).json({ error: "Invalid input" });
  const valid = await verifyOtpValue({
    redis,
    key: `v:otp:${phone}`,
    phone,
    role: "vendor",
    otp,
  });
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  const v = await Vendor.findOne({ phone }).lean();
  if (!v) return res.status(404).json({ error: "No account found. Please register first." });
  if (v.status !== "approved") return res.status(403).json({ error: "Your account is pending admin approval" });
  const token = issueRoleToken("vendor", v._id?.toString() || v.email);
  const subscription = await getSubscriptionSnapshot(v._id?.toString() || v.email, "vendor");
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("vendorToken", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ vendor: { ...v, subscription }, vendorToken: token });
}

export async function listProviders(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  const city = normCity(vendor?.city) || "";
  const zones = vendor?.zones || [];
  
  console.log('[Vendor] listProviders called:', { vendorId, vendorCity: vendor?.city, normalizedCity: city, zones });
  
  let q = {};
  if (zones.length > 0) {
    q = { 
      $and: [
        { city: new RegExp(`^${escapeRegex(city)}$`, "i") },
        { zones: { $in: zones.map(z => new RegExp(`^${escapeRegex(z)}$`, "i")) } }
      ]
    };
  } else if (city) {
    q = { city: new RegExp(`^${escapeRegex(city)}$`, "i") };
  }
  
  console.log('[Vendor] Query:', JSON.stringify(q, null, 2));
  
  let items = await ProviderAccount.find(q).sort({ createdAt: -1 }).lean();
  
  console.log('[Vendor] Found providers:', items.length);
  if (items.length > 0) {
    console.log('[Vendor] Sample provider cities:', items.slice(0, 3).map(p => ({ name: p.name, city: p.city, zones: p.zones })));
  }
  
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
  try {
    if (p?._id) {
      const t = status === "approved"
        ? "provider_vendor_approved"
        : status === "rejected"
        ? "provider_rejected"
        : "provider_vendor_approved";
      const title = status === "approved"
        ? "Vendor Approved"
        : status === "rejected"
        ? "Vendor Rejected"
        : "Status Updated";
      const msg = status === "approved"
        ? "Your profile is approved by vendor and sent for admin review."
        : status === "rejected"
        ? "Your profile was rejected by vendor."
        : `Your status was updated to ${status}.`;
      await notify({
        recipientId: p._id.toString(),
        recipientRole: "provider",
        title,
        message: msg,
        type: t,
        meta: { providerId: p._id.toString(), status },
        respectProviderQuietHours: true,
      });
    }
  } catch {}
  res.json({ provider: p });
}

export async function approveSPZones(req, res) {
  const { id } = req.params;
  const { requestIds } = req.body; // Optional: specific request IDs to approve
  
  const p = await ProviderAccount.findById(id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  
  // Enhanced workflow: Handle pendingZoneRequests
  if (p.pendingZoneRequests && p.pendingZoneRequests.length > 0) {
    const vendorId = req.auth?.sub;
    const vendor = await Vendor.findById(vendorId).lean();
    
    // Filter requests to approve (either specific IDs or all pending)
    let requestsToApprove = p.pendingZoneRequests.filter(r => r.vendorStatus === "pending");
    if (requestIds && Array.isArray(requestIds)) {
      requestsToApprove = requestsToApprove.filter(r => requestIds.includes(r._id?.toString()));
    }
    
    const existingZones = [];
    const newZones = [];
    
    for (const request of requestsToApprove) {
      // Update vendor approval
      request.vendorStatus = "approved";
      request.vendorReviewedAt = new Date();
      request.vendorReviewedBy = vendor?.name || vendorId;
      
      if (request.isNewZone) {
        // New zone: Forward to admin for zone creation
        newZones.push(request.zoneName);
        // Keep adminStatus as "pending" - admin needs to create zone
      } else {
        // Existing zone: Directly add to provider's zones
        existingZones.push(request.zoneName);
        request.adminStatus = "approved"; // Auto-approve for existing zones
        request.adminReviewedAt = new Date();
        request.adminReviewedBy = "auto";
        
        // Add to provider's zones array
        if (!p.zones.includes(request.zoneName)) {
          p.zones.push(request.zoneName);
        }
      }
    }
    
    await p.save();
    
    // Notifications
    try {
      if (existingZones.length > 0) {
        await notify({
          recipientId: p._id.toString(),
          recipientRole: "provider",
          title: "Zones Approved by Vendor",
          message: `Your request for zones ${existingZones.join(", ")} has been approved. You can now serve in these areas.`,
          type: "provider_zones_approved",
          meta: { providerId: p._id.toString(), zones: existingZones },
        });
      }
      
      if (newZones.length > 0) {
        await notify({
          recipientId: p._id.toString(),
          recipientRole: "provider",
          title: "New Zone Request Forwarded",
          message: `Your request for new zones ${newZones.join(", ")} has been approved by vendor and forwarded to admin for zone creation.`,
          type: "provider_zones_pending_admin",
          meta: { providerId: p._id.toString(), zones: newZones },
        });
        
        // Notify admin about new zone creation requests
        await notify({
          recipientId: "ADMIN001",
          recipientRole: "admin",
          title: "New Zone Creation Request",
          message: `Vendor ${vendor?.name || "Unknown"} approved provider ${p.name}'s request for new zones: ${newZones.join(", ")}. Please create zones.`,
          type: "zone_creation_request",
          meta: { 
            providerId: p._id.toString(), 
            vendorId: vendorId,
            zones: newZones,
            providerLocation: p.currentLocation,
            providerAddress: p.address
          },
        });
      }
    } catch (err) {
      console.error('[Vendor] Failed to send zone approval notifications:', err);
    }
    
    return res.json({ 
      success: true, 
      provider: p,
      summary: {
        existingZonesApproved: existingZones.length,
        newZonesForwardedToAdmin: newZones.length
      }
    });
  }
  
  // Legacy support: Handle old pendingZones array
  if (p.pendingZones && p.pendingZones.length > 0) {
    p.zones = [...new Set([...(p.zones || []), ...p.pendingZones])];
    p.pendingZones = [];
    await p.save();
    try {
      await notify({
        recipientId: p._id.toString(),
        recipientRole: "provider",
        title: "Zones Approved by Vendor",
        message: "Your request to add new service zones has been approved by your city vendor.",
        type: "provider_zones_approved",
        meta: { providerId: p._id.toString(), zones: p.zones },
      });
    } catch {}
  }
  
  res.json({ success: true, provider: p });
}

export async function rejectSPZones(req, res) {
  const { id } = req.params;
  const { requestIds, reason } = req.body; // Optional: specific request IDs and rejection reason
  
  const p = await ProviderAccount.findById(id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  
  // Enhanced workflow: Handle pendingZoneRequests
  if (p.pendingZoneRequests && p.pendingZoneRequests.length > 0) {
    const vendorId = req.auth?.sub;
    const vendor = await Vendor.findById(vendorId).lean();
    
    // Filter requests to reject (either specific IDs or all pending)
    let requestsToReject = p.pendingZoneRequests.filter(r => r.vendorStatus === "pending");
    if (requestIds && Array.isArray(requestIds)) {
      requestsToReject = requestsToReject.filter(r => requestIds.includes(r._id?.toString()));
    }
    
    const rejectedZones = [];
    
    for (const request of requestsToReject) {
      request.vendorStatus = "rejected";
      request.vendorReviewedAt = new Date();
      request.vendorReviewedBy = vendor?.name || vendorId;
      request.rejectionReason = reason || "Rejected by vendor";
      rejectedZones.push(request.zoneName);
    }
    
    await p.save();
    
    try {
      await notify({
        recipientId: p._id.toString(),
        recipientRole: "provider",
        title: "Zone Request Rejected by Vendor",
        message: `Your request for zones ${rejectedZones.join(", ")} was rejected. ${reason ? `Reason: ${reason}` : ''}`,
        type: "provider_zones_rejected",
        meta: { providerId: p._id.toString(), zones: rejectedZones, reason },
      });
    } catch {}
    
    return res.json({ 
      success: true, 
      provider: p,
      summary: {
        rejectedZones: rejectedZones.length
      }
    });
  }
  
  // Legacy support: Handle old pendingZones array
  p.pendingZones = [];
  await p.save();
  
  try {
    await notify({
      recipientId: p._id.toString(),
      recipientRole: "provider",
      title: "Zones Request Rejected by Vendor",
      message: "Your request to add new service zones was rejected by your city vendor.",
      type: "provider_zones_rejected",
      meta: { providerId: p._id.toString() },
    });
  } catch {}
  
  res.json({ success: true, provider: p });
}

export async function listBookings(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  const city = normCity(vendor?.city) || "";
  const zones = vendor?.zones || [];

  if (!city && zones.length === 0) {
    const bookings = await Booking.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ bookings });
  }

  // Find providers in vendor's areas
  let pQuery = {};
  if (zones.length > 0) {
    pQuery = { 
      $and: [
        { city: new RegExp(`^${escapeRegex(city)}$`, "i") },
        { zones: { $in: zones.map(z => new RegExp(`^${escapeRegex(z)}$`, "i")) } }
      ]
    };
  } else {
    pQuery = { city: new RegExp(`^${escapeRegex(city)}$`, "i") };
  }

  const providers = await ProviderAccount.find(pQuery).select("_id").lean();
  const providerIds = providers.map((p) => p._id?.toString());

  // Bookings assigned to these providers
  let byProvider = providerIds.length
    ? await Booking.find({ assignedProvider: { $in: providerIds } }).sort({ createdAt: -1 }).lean()
    : [];

  // Bookings in vendor's areas (by address)
  let bQuery = {};
  if (zones.length > 0) {
    bQuery = { "address.area": { $in: zones.map(z => new RegExp(escapeRegex(z), "i")) } };
  } else {
    bQuery = {
      $or: [
        { "address.area": new RegExp(escapeRegex(city), "i") },
        { "address.city": new RegExp(escapeRegex(city), "i") },
      ],
    };
  }

  const byAddress = await Booking.find(bQuery).sort({ createdAt: -1 }).lean();
  
  let combined = [...byProvider, ...byAddress];
  
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
      status: "vendor_assigned", 
      lastAssignedAt: now,
      expiresAt: null, // Manual vendor assignment should not expire automatically
      adminEscalated: false
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
  try {
    if (b?.assignedProvider) {
      await notify({
        recipientId: b.assignedProvider,
        recipientRole: "provider",
        title: "Booking Reassigned",
        message: `A booking #${b._id.toString().slice(-6)} has been reassigned to you.`,
        type: "booking_reassigned",
        meta: { bookingId: b._id.toString() },
        respectProviderQuietHours: true,
      });
    }
    if (b?.customerId) {
      await notify({
        recipientId: b.customerId,
        recipientRole: "user",
        title: "Provider Reassigned",
        message: `Your booking #${b._id.toString().slice(-6)} has been reassigned to another provider.`,
        type: "booking_reassigned",
        meta: { bookingId: b._id.toString() },
      });
    }
  } catch {}
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
  try {
    if (b?.customerId) {
      await notify({
        recipientId: b.customerId,
        recipientRole: "user",
        title: "Booking Cancelled",
        message: `Your booking #${b._id.toString().slice(-6)} was cancelled. Please rebook.`,
        type: "booking_cancelled",
        meta: { bookingId: b._id.toString() },
      });
    }
  } catch {}

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
  try {
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      title: "Custom Quote Ready",
      message: `Your custom enquiry quote is ready. Please review and confirm.`,
      type: "custom_quote_submitted",
      meta: { enquiryId: enq._id?.toString?.() },
    });
  } catch {}
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
      status: "vendor_assigned",
      lastAssignedAt: new Date(),
      expiresAt: null, // Manual vendor assignment should not expire automatically
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
  try {
    if (enq.maintainerProvider) {
      await notify({
        recipientId: enq.maintainerProvider,
        recipientRole: "provider",
        title: "Custom Booking Assigned",
        message: `A custom booking #${(enq.bookingId || "").slice(-6)} has been assigned to you.`,
        type: "booking_assigned",
        meta: { bookingId: enq.bookingId || "", enquiryId: enq._id?.toString?.() },
        respectProviderQuietHours: true,
      });
    }
    await notify({
      recipientId: enq.userId,
      recipientRole: "user",
      title: "Custom Booking Confirmed",
      message: `Your custom booking has been confirmed and a provider is assigned.`,
      type: "custom_approved",
      meta: { bookingId: enq.bookingId || "", enquiryId: enq._id?.toString?.() },
    });
  } catch {}
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
  const zones = vendor?.zones || [];

  let pQuery = {};
  if (zones.length > 0) {
    pQuery = { 
      $and: [
        { city: new RegExp(`^${escapeRegex(city)}$`, "i") },
        { 
          $or: [
            { zone: { $in: zones.map(z => new RegExp(`^${escapeRegex(z)}$`, "i")) } },
            { address: { $in: zones.map(z => new RegExp(escapeRegex(z), "i")) } }
          ]
        }
      ]
    };
  } else if (city) {
    pQuery = { city: new RegExp(`^${escapeRegex(city)}$`, "i") };
  }

  const providers = await ProviderAccount.find(pQuery).lean();
  const providerIds = providers.map((p) => p._id?.toString());

  let bQuery = {};
  if (zones.length > 0) {
    bQuery = { "address.area": { $in: zones.map(z => new RegExp(escapeRegex(z), "i")) } };
  } else if (city) {
    bQuery = {
      $or: [
        { "address.area": new RegExp(escapeRegex(city), "i") },
        { "address.city": new RegExp(escapeRegex(city), "i") },
      ],
    };
  }

  const bookings = (zones.length > 0 || city)
    ? await Booking.find({ 
        $or: [
          { assignedProvider: { $in: providerIds } },
          bQuery
        ]
      }).lean()
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
  
  // SOS alerts for vendor's area
  const sos = await SOSAlert.countDocuments({ 
    status: { $ne: "resolved" },
    $or: [
      { providerId: { $in: providerIds } },
      { bookingId: { $in: bookings.map(b => b._id.toString()) } }
    ]
  });

  // Zone-wise booking heatmap
  const heatmap = {};
  zones.forEach(z => { heatmap[z] = 0; });
  bookings.forEach(b => {
    const area = b.address?.area;
    if (area) {
      const match = zones.find(z => new RegExp(escapeRegex(z), "i").test(area));
      if (match) {
        heatmap[match] = (heatmap[match] || 0) + 1;
      }
    }
  });

  // Check for SWM City Manager Enterprise subscription
  const subscription = await UserSubscription.findOne({ userId: vendorId, status: 'active' });
  const subscriptionSnapshot = await getSubscriptionSnapshot(vendorId, "vendor");
  let advancedAnalytics = null;
  if (subscriptionSnapshot.isEnterprise) {
    advancedAnalytics = {
      demandInsights: `High demand for services in ${zones.join(", ") || city}.`,
      marketingCredits: await getMarketingCreditsBalance(vendorId),
      prioritySupport: subscriptionSnapshot.prioritySupport,
      nextBillingAt: subscriptionSnapshot.currentPeriodEnd,
      heatmap,
    };
  }

  res.json({
    stats: {
      providers: { total: providers.length, approved: providers.filter((p) => p.approvalStatus === "approved").length, pending: providers.filter((p) => p.approvalStatus === "pending").length },
      bookings: { total: bookings.length, active, completed: bookings.filter((b) => b.status === "completed").length, cancellations },
      revenue,
      sosActive: sos,
      advancedAnalytics,
      subscription: subscriptionSnapshot,
      heatmap, // Always provide heatmap if possible
    },
  });
}

export async function listSubAccounts(req, res) {
  const vendorId = req.auth?.sub;
  const subscription = await getSubscriptionSnapshot(vendorId, "vendor");
  if (!subscription.isEnterprise || !subscription.subAccountsEnabled) {
    return res.status(403).json({ error: "Enterprise subscription required." });
  }
  const subAccounts = await VendorSubAccount.find({ vendorId }).sort({ createdAt: -1 }).lean();
  res.json({ subAccounts, subscription });
}

export async function createSubAccount(req, res) {
  const vendorId = req.auth?.sub;
  const subscription = await getSubscriptionSnapshot(vendorId, "vendor");
  if (!subscription.isEnterprise || !subscription.subAccountsEnabled) {
    return res.status(403).json({ error: "Enterprise subscription required." });
  }
  const subAccount = await VendorSubAccount.create({
    vendorId,
    name: req.body.name,
    email: req.body.email || "",
    phone: req.body.phone || "",
    role: req.body.role || "operations",
  });
  res.status(201).json({ subAccount });
}

export async function deleteSubAccount(req, res) {
  const vendorId = req.auth?.sub;
  const subscription = await getSubscriptionSnapshot(vendorId, "vendor");
  if (!subscription.isEnterprise || !subscription.subAccountsEnabled) {
    return res.status(403).json({ error: "Enterprise subscription required." });
  }
  await VendorSubAccount.findOneAndDelete({ _id: req.params.id, vendorId });
  res.json({ success: true });
}

export async function requestZones(req, res) {
  const vendorId = req.auth?.sub;
  const { zones } = req.body;
  if (!Array.isArray(zones) || zones.length === 0) {
    return res.status(400).json({ error: "Zones array is required" });
  }

  const v = await Vendor.findByIdAndUpdate(
    vendorId,
    { $set: { pendingZones: zones } },
    { new: true }
  );

  try {
    await notify({
      recipientId: "ADMIN001",
      recipientRole: "admin",
      title: "Vendor Zone Update Request",
      message: `Vendor ${v.name} has requested to add new zones: ${zones.join(", ")}.`,
      type: "system",
      meta: { vendorId: v._id.toString(), pendingZones: zones },
    });
  } catch {}

  res.json({ success: true, vendor: v });
}


// List zone requests from providers in vendor's city (Phase 4)
export async function listZoneRequests(req, res) {
  const vendorId = req.auth?.sub;
  const vendor = await Vendor.findById(vendorId).lean();
  if (!vendor) return res.status(404).json({ error: "Vendor not found" });
  
  const city = normCity(vendor?.city) || "";
  if (!city) {
    return res.json({ requests: [] });
  }
  
  // Find all providers in vendor's city with pending zone requests
  const providers = await ProviderAccount.find({
    city: new RegExp(`^${escapeRegex(city)}$`, "i"),
    pendingZoneRequests: { $exists: true, $ne: [] }
  }).select('name phone address currentLocation pendingZoneRequests').lean();
  
  // Flatten and format zone requests
  const requests = [];
  for (const provider of providers) {
    if (!provider.pendingZoneRequests) continue;
    
    for (const request of provider.pendingZoneRequests) {
      requests.push({
        _id: request._id,
        providerId: provider._id,
        providerName: provider.name,
        providerPhone: provider.phone,
        providerAddress: provider.address,
        providerLocation: provider.currentLocation,
        zoneName: request.zoneName,
        isNewZone: request.isNewZone,
        requestedAt: request.requestedAt,
        vendorStatus: request.vendorStatus,
        vendorReviewedAt: request.vendorReviewedAt,
        vendorReviewedBy: request.vendorReviewedBy,
        adminStatus: request.adminStatus,
        rejectionReason: request.rejectionReason
      });
    }
  }
  
  // Sort by requested date (newest first)
  requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  
  res.json({ requests });
}
