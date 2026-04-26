import { Router } from "express";
import { body, validationResult, param } from "express-validator";
import jwt from "jsonwebtoken";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import { redis } from "../startup/redis.js";
import { upload } from "../middleware/upload.js";
import { uploadBuffer } from "../startup/cloudinary.js";
import { issueRoleToken, requireRole, requireAnyRole } from "../middleware/roles.js";
import BookingLog from "../models/BookingLog.js";
import { getIO } from "../startup/socket.js";
import LeaveRequest from "../models/LeaveRequest.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { OfficeSettings } from "../models/Content.js";
import { DEFAULT_TIME_SLOTS, defaultSlotsMap, isIsoDate, normalizeSlotsPayload, slotLabelToLocalDateTime, slotsMapToAvailableSlots, parseDurationToMinutes } from "../lib/slots.js";
import { daysBetweenInclusive, isoDateRangeIncludesWeekend, isoDateToLocalEnd, isoDateToLocalStart, toIsoDateFromAny } from "../lib/isoDateTime.js";
import { computeExpiresAt, getAcceptWindowMs, handleExhaustedAssignmentChain, pickNextProviderForBooking } from "../lib/assignment.js";
import { BookingSettings, CommissionSettings, PerformanceSettings } from "../models/Settings.js";
import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../config.js";
import { invalidateProviderSlots } from "../lib/availability.js";
import crypto from "crypto";
import { notify } from "../lib/notify.js";
import Vendor from "../models/Vendor.js";
import { issueOtp, OTP_LENGTH, verifyOtpValue } from "../lib/otpService.js";
import { ensureCityAndZoneNames, locationOutOfZoneMessage, resolveServiceLocation } from "../lib/locationResolution.js";
import {
  createLedgerEntry,
  getActiveSubscription,
  getProviderCommissionRate,
  getSubscriptionSnapshot,
  recordVendorPerformanceCommission,
} from "../lib/subscriptions.js";

const router = Router();

function logDevProviderFlow(message, payload = {}) {
  if (process.env.NODE_ENV === "production") return;
  try {
    console.log(`[ProviderAssignmentFlow] ${message}`, payload);
  } catch {}
}

async function normalizeProviderZoneSelection({ city = "", cityId = "", zones = [], zoneIds = [] } = {}) {
  const normalizedZones = Array.from(new Set((Array.isArray(zones) ? zones : []).map((z) => String(z || "").trim()).filter(Boolean)));
  const normalizedZoneIds = Array.from(new Set((Array.isArray(zoneIds) ? zoneIds : []).map((z) => String(z || "").trim()).filter(Boolean)));
  const resolved = [];
  for (const zoneName of normalizedZones) {
    // eslint-disable-next-line no-await-in-loop
    const names = await ensureCityAndZoneNames({ cityName: city, cityId, zoneName });
    resolved.push(names);
  }
  return {
    city: (resolved[0]?.cityName || city || "").trim(),
    cityId: (resolved[0]?.cityId || cityId || "").trim(),
    zones: Array.from(new Set([...normalizedZones, ...resolved.map((r) => r.zoneName).filter(Boolean)])),
    zoneIds: Array.from(new Set([...normalizedZoneIds, ...resolved.map((r) => r.zoneId).filter(Boolean)])),
  };
}

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
  const phone = String(req.body.phone || "").trim();
  const acc = await ProviderAccount.findOne({ phone }).lean();
  if (!acc) return res.status(404).json({ error: "No account found. Please register first." });
  const isDev = (process.env.NODE_ENV !== "production");
  let issued;
  try {
    issued = await issueOtp({
      redis,
      key: `sp:otp:${phone}`,
      phone,
      role: "provider",
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
});

router.post("/register-request", body("phone").matches(/^\d{10}$/), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const phone = req.body.phone;
  const existing = await ProviderAccount.findOne({ phone }).lean();
  if (existing?.registrationComplete) {
    return res.status(409).json({ error: "Account already exists. Please login." });
  }
  const isDev = (process.env.NODE_ENV !== "production");
  let issued;
  try {
    issued = await issueOtp({
      redis,
      key: `sp:reg:otp:${phone}`,
      phone,
      role: "provider",
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
});

router.post("/verify-registration-otp", body("phone").matches(/^\d{10}$/), body("otp").isLength({ min: OTP_LENGTH, max: OTP_LENGTH }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { phone, otp } = req.body;
  const valid = await verifyOtpValue({
    redis,
    key: `sp:reg:otp:${phone}`,
    phone,
    role: "provider",
    otp,
  });
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  await redis.set(`sp:reg:verified:${phone}`, "1", { EX: 600 });
  res.json({ success: true });
});

router.post("/verify-otp", body("phone").matches(/^\d{10}$/), body("otp").isLength({ min: OTP_LENGTH, max: OTP_LENGTH }), async (req, res) => {
  const { phone, otp } = req.body;
  const valid = await verifyOtpValue({
    redis,
    key: `sp:otp:${phone}`,
    phone,
    role: "provider",
    otp,
  });
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  const acc = await ProviderAccount.findOne({ phone });
  if (!acc) return res.status(404).json({ error: "No account found. Please register first." });
  // Mark provider online on successful login (required for assignment pool).
  try {
    acc.isOnline = true;
    await acc.save();
  } catch {}
  const token = issueRoleToken("provider", acc._id.toString());
  const subscription = await getSubscriptionSnapshot(acc._id.toString(), "provider");
  try {
    await notify({
      recipientId: acc._id.toString(),
      recipientRole: "provider",
      type: "system",
      title: "Login Successful",
      message: "You are logged in successfully.",
      respectProviderQuietHours: true,
    });
  } catch {}
  res.cookie("providerToken", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 * 1000 });
  res.json({
    provider: {
      ...acc.toObject(),
      subscription,
      isPro: subscription.isPro,
      proExpiry: subscription.currentPeriodEnd,
      proPlan: subscription.planId,
    },
    providerToken: token,
  });
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

  const officeSettings = await OfficeSettings.findOne().lean();
  const doc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
  const base = defaultSlotsMap(officeSettings?.providerStartTime, officeSettings?.providerEndTime);
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

    // Slots can be modified until 4 hours before the service time (local server time).
    const now = new Date();
    const cutoff = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const officeSettings = await OfficeSettings.findOne().lean();
    const existingDoc = await ProviderDayAvailability.findOne({ providerId, date }).lean();
    const currentMap = existingDoc?.availableSlots?.length
      ? (() => {
        const m = {};
        DEFAULT_TIME_SLOTS.forEach((s) => { m[s] = false; });
        for (const s of existingDoc.availableSlots) if (DEFAULT_TIME_SLOTS.includes(s)) m[s] = true;
        return m;
      })()
      : defaultSlotsMap(officeSettings?.providerStartTime, officeSettings?.providerEndTime);

    const normalized = normalizeSlotsPayload(req.body.slots);
    if (!normalized.ok) return res.status(400).json({ error: normalized.error });

    const nextEffective = { ...defaultSlotsMap(officeSettings?.providerStartTime, officeSettings?.providerEndTime), ...normalized.slots };

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
        return res.status(400).json({ error: "Some slots are locked (within 4 hours)", lockedSlots: locked });
      }
    }

    const availableSlots = slotsMapToAvailableSlots(nextEffective);

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
  body("endDate").isString().notEmpty().withMessage("End date is required"),
  body("reason").isString().notEmpty().trim().withMessage("Reason is required"),
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

    // endDate is now required
    const endDateStr = req.body.endDate;
    if (!endDateStr || !endDateStr.trim()) {
      return res.status(400).json({ error: "End date is required" });
    }

    const endIsoRaw = toIsoDateFromAny(endDateStr);
    const endIso = endIsoRaw || startIso;
    if (!endIso) return res.status(400).json({ error: "Invalid end date" });

    const dayCount = daysBetweenInclusive(startIso, endIso);
    if (!dayCount) return res.status(400).json({ error: "Invalid date range" });

    const includesWeekend = isoDateRangeIncludesWeekend(startIso, endIso);
    if (includesWeekend === null) return res.status(400).json({ error: "Invalid date range" });

    const requiresApproval = true;
    const status = "pending";

    const endAt = isoDateToLocalEnd(endIso);
    if (!endAt) return res.status(400).json({ error: "Invalid end date" });

    // Validate reason is not empty
    const reason = (req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Reason is required" });
    }

    const item = await LeaveRequest.create({
      providerId: pId,
      phone: prov.phone,
      type: "Full Day",
      startAt,
      endAt,
      endDate: endDateStr,
      reason: reason,
      status,
    });
    try {
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "Leave Request",
        message: `Provider ${prov.name || prov.phone} requested leave (${status}).`,
        type: "leave_requested",
        meta: { leaveId: item._id?.toString?.(), providerId: pId, status },
      });
    } catch {}
    res.status(201).json({ leave: item, requiresApproval });
  }
);

router.post(
  "/request-zones",
  requireRole("provider"),
  body("zones").isArray({ min: 1 }),
  async (req, res) => {
    const providerId = req.auth?.sub;
    const { zones } = req.body;
    if (!Array.isArray(zones) || zones.length === 0) {
      return res.status(400).json({ error: "Zones array is required" });
    }

    const p = await ProviderAccount.findById(providerId);
    if (!p) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const requestCity = String(req.body.city || p.city || "").trim();
    const requestCityId = String(req.body.cityId || p.cityId || "").trim();

    // Get all existing zones in provider's city for validation
    const cityZones = await (await import("../models/CityZone.js")).Zone.find({
      status: "active"
    }).populate('city').lean();
    
    const cityZoneNames = cityZones
      .filter(z => (
        (requestCityId && z.city?._id?.toString?.() === requestCityId)
        || (!requestCityId && z.city?.name?.toLowerCase() === requestCity?.toLowerCase())
      ))
      .map(z => z.name.toLowerCase());

    // Enhanced zone request tracking (Phase 4)
    const newRequests = zones.map(zoneName => {
      const isNewZone = !cityZoneNames.includes(zoneName.toLowerCase());
      
      return {
        zoneName,
        isNewZone,
        requestedAt: new Date(),
        providerAddress: p.address || "",
        cityId: requestCityId || p.cityId || "",
        cityName: requestCity || p.city || "",
        resolvedZoneId: "",
        resolvedZoneName: "",
        providerLocation: {
          lat: p.currentLocation?.lat || null,
          lng: p.currentLocation?.lng || null
        },
        vendorStatus: "pending",
        adminStatus: isNewZone ? "pending" : "pending" // Both need approval for new zones
      };
    });

    // Add to pendingZoneRequests array (new enhanced tracking)
    p.pendingZoneRequests = p.pendingZoneRequests || [];
    p.pendingZoneRequests.push(...newRequests);
    
    // Also update legacy pendingZones for backward compatibility
    p.pendingZones = zones;
    
    await p.save();

    const newZoneCount = newRequests.filter(r => r.isNewZone).length;
    const existingZoneCount = newRequests.length - newZoneCount;

    try {
      // Notify Admin
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "Provider Zone Update Request",
        message: `Provider ${p.name} has requested zones: ${zones.join(", ")}. ${newZoneCount > 0 ? `(${newZoneCount} new zone${newZoneCount > 1 ? 's' : ''})` : ''}`,
        type: "system",
        meta: { 
          providerId: p._id.toString(), 
          pendingZones: zones,
          newZoneCount,
          existingZoneCount
        },
      });

      // Notify Vendor of the city
      const city = p.city || "";
      if (city) {
        const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
        if (vendor) {
          await notify({
            recipientId: vendor._id.toString(),
            recipientRole: "vendor",
            title: "Provider Zone Update Request",
            message: `Provider ${p.name} in your city (${city}) has requested zones: ${zones.join(", ")}. ${newZoneCount > 0 ? `🆕 ${newZoneCount} new zone${newZoneCount > 1 ? 's' : ''} need creation` : ''}`,
            type: "system",
            meta: { 
              providerId: p._id.toString(), 
              pendingZones: zones,
              newZoneCount,
        existingZoneCount,
        providerLocation: p.currentLocation
      },
          });
        }
      }
    } catch (err) {
      console.error('[Provider] Failed to notify about zone request:', err);
    }

    res.json({ 
      success: true, 
      provider: p,
      summary: {
        totalRequests: zones.length,
        newZones: newZoneCount,
        existingZones: existingZoneCount
      }
    });
  }
);

router.post(
  "/request-category",
  requireRole("provider"),
  body("currentCategory").notEmpty(),
  body("requestedCategory").notEmpty(),
  async (req, res) => {
    const providerId = req.auth?.sub;
    const { currentCategory, requestedCategory } = req.body;

    const p = await ProviderAccount.findById(providerId);
    if (!p) return res.status(404).json({ error: "Provider not found" });

    try {
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "Category Change Request",
        message: `Provider ${p.name || p.phone} wants to add/change category: "${requestedCategory}" (Current: ${currentCategory})`,
        type: "category_request",
        meta: { 
          providerId: p._id?.toString?.(), 
          currentCategory, 
          requestedCategory 
        },
      });
    } catch {}

    res.json({ success: true, message: "Request sent to admin" });
  }
);

router.post("/register", body("phone").matches(/^\d{10}$/), body("name").isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const verified = await redis.get(`sp:reg:verified:${req.body.phone}`);
  if (!verified) {
    return res.status(403).json({ error: "OTP verification required before registration" });
  }
  await redis.del(`sp:reg:verified:${req.body.phone}`);
  const selectedZones = Array.isArray(req.body.zones) ? req.body.zones : (req.body.zone ? [req.body.zone] : []);
  const selectedZoneIds = Array.isArray(req.body.zoneIds) ? req.body.zoneIds.map((z) => String(z || "").trim()).filter(Boolean) : [];
  const lat = req.body.lat !== undefined ? Number(req.body.lat) : null;
  const lng = req.body.lng !== undefined ? Number(req.body.lng) : null;
  const selectedCity = String(req.body.city || "").trim();
  const selectedCityId = String(req.body.cityId || "").trim();
  const hasManualSelection = !!(selectedCityId || selectedCity) && (selectedZones.length > 0 || selectedZoneIds.length > 0);
  let resolvedLocation = null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    resolvedLocation = await resolveServiceLocation({
      lat,
      lng,
      cityId: selectedCityId,
      cityName: selectedCity,
    });
    if (!resolvedLocation.insideServiceArea && !String(req.body.customZone || "").trim() && !hasManualSelection) {
      return res.status(400).json({
        error: locationOutOfZoneMessage(),
        code: "OUT_OF_ZONE",
        location: resolvedLocation,
      });
    }
  }
  const effectiveLocation = resolvedLocation?.insideServiceArea ? resolvedLocation : null;
  const normalizedSelection = await normalizeProviderZoneSelection({
    city: effectiveLocation?.cityName || selectedCity,
    cityId: effectiveLocation?.cityId || selectedCityId,
    zones: selectedZones.length > 0
      ? selectedZones
      : (effectiveLocation?.zoneName ? [effectiveLocation.zoneName] : []),
    zoneIds: selectedZoneIds.length > 0 ? selectedZoneIds : (effectiveLocation?.zoneId ? [effectiveLocation.zoneId] : []),
  });
  const customZone = String(req.body.customZone || "").trim();
  const update = {
    name: req.body.name,
    email: req.body.email || "",
    address: req.body.address || "",
    city: normalizedSelection.city,
    cityId: normalizedSelection.cityId,
    zones: customZone ? Array.from(new Set([...normalizedSelection.zones, customZone])) : normalizedSelection.zones,
    zoneIds: normalizedSelection.zoneIds,
    baseZoneId: effectiveLocation?.zoneId || normalizedSelection.zoneIds[0] || "",
    serviceZoneIds: normalizedSelection.zoneIds,
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
      upiId: req.body.upiId || "",
      primaryCategory: req.body.primaryCategory || [],
      specializations: req.body.specializations || [],
      services: req.body.services || [],
      certifications: req.body.certifications || [],
    },
    approvalStatus: "pending_vendor",
    vendorApprovalStatus: "pending",
    adminApprovalStatus: "pending",
    registrationComplete: true,
    currentLocation: (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : undefined,
    lastLocationUpdate: (Number.isFinite(lat) && Number.isFinite(lng)) ? new Date() : undefined,
  };
  const acc = await ProviderAccount.findOneAndUpdate({ phone: req.body.phone }, update, { new: true, upsert: true });

  if (!resolvedLocation?.insideServiceArea && customZone) {
    acc.pendingZoneRequests = acc.pendingZoneRequests || [];
    acc.pendingZoneRequests.push({
      zoneName: customZone,
      isNewZone: true,
      requestedAt: new Date(),
      providerAddress: acc.address || "",
      cityId: normalizedSelection.cityId,
      cityName: normalizedSelection.city,
      resolvedZoneId: "",
      resolvedZoneName: "",
      providerLocation: { lat, lng },
      vendorStatus: "pending",
      adminStatus: "pending",
    });
    acc.pendingZones = Array.from(new Set([...(acc.pendingZones || []), customZone]));
    await acc.save();
  }

  try {
    await notify({
      recipientId: acc._id.toString(),
      recipientRole: "provider",
      type: "system",
      title: "Registration Submitted",
      message: "Your provider profile has been submitted and is pending approval.",
      respectProviderQuietHours: true,
    });
  } catch {}

  // Notify relevant vendor if zones are specified
  const zones = customZone ? Array.from(new Set([...(normalizedSelection.zones || []), customZone])) : (normalizedSelection.zones || []);
  if (zones.length > 0) {
    try {
      const city = normalizedSelection.city;
      const vendors = await Vendor.find({ 
        $or: [
          ...(normalizedSelection.cityId ? [{ cityId: normalizedSelection.cityId }] : []),
          { city: new RegExp(`^${city}$`, "i") },
        ],
        status: "approved"
      }).lean();

      for (const vendor of vendors) {
        await notify({
          recipientId: vendor._id.toString(),
          recipientRole: "vendor",
          title: "New Provider Request",
          message: `New provider ${req.body.name} has requested registration in your zones.`,
          type: "system",
          meta: { providerId: acc._id.toString() },
        });
      }
    } catch (err) {
      // Failed to notify vendor of new provider
    }
  }

  const token = issueRoleToken("provider", acc._id.toString());
  const subscription = await getSubscriptionSnapshot(acc._id.toString(), "provider");
  res.cookie("providerToken", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 * 1000 });
  res.json({
    provider: {
      ...acc.toObject(),
      subscription,
      isPro: subscription.isPro,
      proExpiry: subscription.currentPeriodEnd,
      proPlan: subscription.planId,
    },
    providerToken: token,
  });
});

router.get("/me/:phone", param("phone").matches(/^\d{10}$/), async (req, res) => {
  const acc = await ProviderAccount.findOne({ phone: req.params.phone }).lean();
  if (!acc) return res.json({ provider: null });
  const subscription = await getSubscriptionSnapshot(acc._id.toString(), "provider");
  res.json({
    provider: {
      ...acc,
      subscription,
      isPro: subscription.isPro,
      proExpiry: subscription.currentPeriodEnd,
      proPlan: subscription.planId,
    },
  });
});

router.patch("/me/profile", 
  requireRole("provider"),
  body("name").optional().isString().trim().notEmpty(),
  body("email").optional().isEmail().normalizeEmail(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    
    const providerId = req.auth.sub;
    const { name, email } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (email !== undefined) updates.email = email;

    const acc = await ProviderAccount.findByIdAndUpdate(
      providerId,
      { $set: updates },
      { new: true }
    ).lean();

    if (!acc) return res.status(404).json({ error: "Provider not found" });
    
    res.json({ success: true, provider: acc });
  }
);

router.get("/performance-criteria", requireAnyRole(["admin", "provider"]), async (_req, res) => {
  const s = await PerformanceSettings.findOne().lean();
  res.json({ settings: s || { minWeeklyHours: 20, minRatingThreshold: 4.5, maxCancellationsThreshold: 5 } });
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
      const providerId = provider._id?.toString();
      const recentBookings = await Booking.find({ assignedProvider: providerId }).sort({ createdAt: -1 }).limit(50).lean();

      // Rating from last 50 completed bookings with a rating
      const ratedBookings = recentBookings.filter(b => b.status === 'completed' && b.rating);
      const totalRating = ratedBookings.reduce((acc, b) => acc + b.rating, 0);
      const rating = ratedBookings.length > 0 ? (totalRating / ratedBookings.length) : 0;

      // Cancellations from last 50 bookings
      const cancellations = recentBookings.filter(b => (b.status || "").toLowerCase() === "cancelled").length;

      // Response Rate from last 50 bookings
      const completed = recentBookings.filter(b => (b.status || "").toLowerCase() === "completed").length;
      const responseRate = recentBookings.length > 0 ? Math.round((completed / recentBookings.length) * 100) : 0;
      const grade = responseRate >= 95 ? "A+" : responseRate >= 85 ? "A" : responseRate >= 70 ? "B" : responseRate > 0 ? "C" : "N/A";

      // Weekly trend from last 50 bookings
      const weekdayIdxToName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const dayTotals = Array(7).fill(0);
      const dayCompleted = Array(7).fill(0);
      for (const b of recentBookings) {
        const idx = new Date(b.createdAt).getDay();
        dayTotals[idx] += 1;
        if ((b.status || "").toLowerCase() === "completed") dayCompleted[idx] += 1;
      }
      const weeklyTrend = [1,2,3,4,5,6,0].map((dow) => { // Mon..Sun order
        const totalD = dayTotals[dow] || 0;
        const val = totalD > 0 ? Math.round((dayCompleted[dow] / totalD) * 100) : 0;
        return { day: weekdayIdxToName[dow], value: val };
      });

      // Weekly hours from slots
      const availability = await ProviderDayAvailability.find({ providerId, date: { $gte: toIsoDateFromAny(weekAgo) } }).lean();
      const weeklyHours = availability.reduce((acc, day) => acc + day.availableSlots.length * 0.5, 0);
      calendar = { availableHoursWeek: weeklyHours };

      // Hub metrics from last 50 bookings
      hub.jobs30d = recentBookings.length;
      const customerCount = new Map();
      for (const b of recentBookings) {
        const cid = b.customerId || "";
        if (!cid) continue;
        customerCount.set(cid, (customerCount.get(cid) || 0) + 1);
      }
      hub.repeatCustomers = Array.from(customerCount.values()).filter(c => c > 1).length;

      performance = { responseRate, cancellations, grade, weeklyTrend, rating };
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

router.get("/rankings/:city", requireAnyRole(["admin", "provider"]), async (req, res) => {
  try {
    const city = req.params.city;
    const providers = await ProviderAccount.find({ city }).lean();
    const rankedProviders = await Promise.all(providers.map(async (p) => {
      const recentBookings = await Booking.find({ assignedProvider: p._id.toString() }).sort({ createdAt: -1 }).limit(50).lean();
      const ratedBookings = recentBookings.filter(b => b.status === 'completed' && b.rating);
      const totalRating = ratedBookings.reduce((acc, b) => acc + b.rating, 0);
      const rating = ratedBookings.length > 0 ? (totalRating / ratedBookings.length) : 0;
      const completed = recentBookings.filter(b => (b.status || "").toLowerCase() === "completed").length;
      const responseRate = recentBookings.length > 0 ? Math.round((completed / recentBookings.length) * 100) : 0;
      return { ...p, rating, responseRate, completedJobs: completed };
    }));

    rankedProviders.sort((a, b) => {
      if (a.rating !== b.rating) return b.rating - a.rating;
      if (a.responseRate !== b.responseRate) return b.responseRate - a.responseRate;
      return b.completedJobs - a.completedJobs;
    });

    res.json({ rankings: rankedProviders });
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

// Delete account endpoint
router.delete("/me/account", requireRole("provider"), async (req, res) => {
  try {
    const providerId = req.auth.sub;
    
    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      assignedProvider: providerId,
      status: { $in: ["assigned", "accepted", "in_progress"] }
    });
    
    if (activeBookings > 0) {
      return res.status(400).json({ 
        error: "Cannot delete account with active bookings. Please complete or cancel all active bookings first." 
      });
    }
    
    // Delete provider account
    await ProviderAccount.findByIdAndDelete(providerId);
    
    // Clear auth cookie
    res.clearCookie("providerToken");
    
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting provider account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

router.get("/credits/:phone", param("phone").matches(/^\d{10}$/), async (req, res) => {
  const acc = await ProviderAccount.findOne({ phone: req.params.phone }).lean();
  if (!acc) return res.status(404).json({ error: "Not found" });
  const credits = acc.credits || 0;
  const transactions = await ProviderWalletTxn.find({ providerId: acc._id.toString() }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ credits, transactions });
});

router.post("/wallet/create-order", requireRole("provider"), body("amount").isNumeric(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const amount = Math.max(Number(req.body.amount) || 0, 0);
  if (amount < 100) return res.status(400).json({ error: "Minimum recharge amount is ₹100" });

  try {
    const isMockMode = !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_ID.includes("YOUR_RAZORPAY_KEY") || !RAZORPAY_KEY_ID.startsWith("rzp_");
    
    // Debug logging
    console.log("[ProviderWallet] Create order request:");
    console.log("  - Amount:", amount);
    console.log("  - Provider ID:", req.auth.sub);
    console.log("  - Key ID:", RAZORPAY_KEY_ID ? `${RAZORPAY_KEY_ID.substring(0, 15)}...` : "MISSING");
    console.log("  - Key Secret:", RAZORPAY_KEY_SECRET ? "SET" : "MISSING");
    console.log("  - Mock Mode:", isMockMode);
    
    if (isMockMode) {
      console.log("[ProviderWallet] Razorpay keys missing or placeholder, returning mock order");
      const mockId = "order_mock_" + amount + "_" + Math.random().toString(36).substring(7);
      const shortProviderId = String(req.auth.sub).slice(-8);
      const shortTimestamp = Date.now().toString().slice(-8);
      return res.json({
        order: {
          id: mockId,
          amount: amount * 100,
          currency: "INR",
          receipt: `SWM_${shortProviderId}_${shortTimestamp}`,
          status: "created",
          mock: true
        }
      });
    }
    
    console.log("[ProviderWallet] Creating Razorpay order...");
    const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    
    // Generate short receipt (max 40 chars for Razorpay)
    const shortProviderId = String(req.auth.sub).slice(-8); // Last 8 chars of provider ID
    const shortTimestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const receipt = `SWM_${shortProviderId}_${shortTimestamp}`; // Max 24 chars
    
    const order = await rzp.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt,
      notes: { providerId: req.auth.sub, type: "wallet_recharge" },
    });
    
    console.log("[ProviderWallet] ✅ Order created successfully:", order.id);
    res.json({ order });
  } catch (err) {
    console.error("[ProviderWallet] ❌ Razorpay order creation FAILED");
    console.error("[ProviderWallet] Error message:", err.message);
    console.error("[ProviderWallet] Error status:", err.statusCode);
    console.error("[ProviderWallet] Error description:", err.error?.description);
    console.error("[ProviderWallet] Full error:", err);
    res.status(502).json({ 
      error: "Payment gateway unavailable",
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
});

router.post("/wallet/verify-payment", requireRole("provider"), body("razorpay_payment_id").isString(), body("razorpay_order_id").isString(), body("razorpay_signature").isString(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  const providerId = req.auth.sub;

  try {
    const isMockMode = !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_ID.includes("YOUR_RAZORPAY_KEY") || !RAZORPAY_KEY_ID.startsWith("rzp_");
    
    if (isMockMode) {
      if (razorpay_order_id.startsWith("order_mock_")) {
        const acc = await ProviderAccount.findById(providerId);
        if (!acc) return res.status(404).json({ error: "Provider not found" });

        // Extract amount from mock order ID if present (order_mock_<amount>_<random>)
        const parts = razorpay_order_id.split("_");
        const amount = Number(parts[2] || req.body.amount || 100); 
        
        acc.credits = (acc.credits || 0) + amount;
        await acc.save();

        await ProviderWalletTxn.create({
          providerId,
          type: "recharge",
          amount,
          balanceAfter: acc.credits,
          meta: { title: "Wallet Recharge (Mock)", source: "mock", paymentId: razorpay_payment_id },
        });

        return res.json({ success: true, credits: acc.credits });
      }
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(razorpay_order_id + "|" + razorpay_payment_id).digest('hex');
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const rzp = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    const order = await rzp.orders.fetch(razorpay_order_id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const amount = order.amount / 100;

    const acc = await ProviderAccount.findById(providerId);
    if (!acc) return res.status(404).json({ error: "Provider not found" });

    acc.credits = (acc.credits || 0) + amount;
    await acc.save();

    await ProviderWalletTxn.create({
      providerId,
      type: "recharge",
      amount,
      balanceAfter: acc.credits,
      meta: { title: "Wallet Recharge", source: "razorpay", paymentId: razorpay_payment_id },
    });

    res.json({ success: true, credits: acc.credits });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    const existing = await ProviderAccount.findById(req.auth.sub);
    if (!existing) return res.status(404).json({ error: "Provider not found" });
    existing.currentLocation = { lat: req.body.lat, lng: req.body.lng };
    existing.lastLocationUpdate = new Date();
    const resolved = await resolveServiceLocation({
      lat: Number(req.body.lat),
      lng: Number(req.body.lng),
      cityId: String(existing.cityId || ""),
      cityName: String(existing.city || ""),
    });
    if (resolved.insideServiceArea) {
      existing.city = resolved.cityName || existing.city;
      existing.cityId = resolved.cityId || existing.cityId;
      existing.baseZoneId = resolved.zoneId || existing.baseZoneId;
      if (resolved.zoneName && !(existing.zones || []).includes(resolved.zoneName)) {
        existing.zones = Array.from(new Set([...(existing.zones || []), resolved.zoneName]));
      }
      if (resolved.zoneId && !(existing.zoneIds || []).includes(resolved.zoneId)) {
        existing.zoneIds = Array.from(new Set([...(existing.zoneIds || []), resolved.zoneId]));
      }
    }
    const acc = await existing.save();
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
    { name: "certifications", maxCount: 10 },
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
    if (files.certifications?.length) {
      const certUrls = [];
      for (const f of files.certifications) {
        const up = await uploadBuffer(f.buffer, folder);
        certUrls.push(up.secure_url);
      }
      docs.certifications = certUrls;
    }
    const finalUpdates = { ...updates };
    if (Object.keys(docs).length > 0) {
      Object.entries(docs).forEach(([k, v]) => {
        finalUpdates[`documents.${k}`] = v;
      });
    }
    const acc = await ProviderAccount.findOneAndUpdate({ phone }, { $set: finalUpdates }, { new: true, upsert: true });
    res.json({ provider: acc });
  }
);

router.get("/bookings/:providerId", requireRole("provider"), param("providerId").isString(), async (req, res) => {
  if (req.params.providerId !== req.auth?.sub) return res.status(403).json({ error: "Forbidden" });
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const acc = await ProviderAccount.findById(req.params.providerId).lean();
  const now = new Date();
  const threshold = new Date(now.getTime() - getAcceptWindowMs());
  const q = {
    assignedProvider: { $in: [req.params.providerId, acc?.phone].filter(Boolean) },
    $nor: [
      {
        status: { $in: ["pending", "Pending", "incoming", "final_approved"] },
        $or: [
          { expiresAt: { $ne: null, $lte: now } },
          { expiresAt: null, lastAssignedAt: { $ne: null, $lte: threshold } },
        ],
      },
    ],
  };
  let total = await Booking.countDocuments(q);
  const items = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  
  // Legacy Fallback: If any booking is missing customerPhone, fetch it from the User model
  const bookingsMissingPhone = items.filter(b => !b.customerPhone && b.customerId);
  if (bookingsMissingPhone.length > 0) {
    const customerIds = Array.from(new Set(bookingsMissingPhone.map(b => b.customerId)));
    const users = await User.find({ _id: { $in: customerIds } }).select("phone").lean();
    const userPhoneMap = new Map(users.map(u => [u._id.toString(), u.phone]));
    
    items.forEach(b => {
      if (!b.customerPhone && b.customerId && userPhoneMap.has(b.customerId.toString())) {
        b.customerPhone = userPhoneMap.get(b.customerId.toString());
      }
    });
  }

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
      io?.of("/bookings").to(b._id.toString()).emit("booking:update", { id: b._id.toString() });
    } catch {}
    try {
      if (b.customerId) {
        await notify({
          recipientId: b.customerId,
          recipientRole: "user",
          type: "payment_required",
          meta: { bookingId: b._id.toString(), amount: balance },
        });
      }
    } catch {}
    res.json({ booking: { ...b.toObject(), id: b._id.toString() }, order });
  } catch (err) {
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
  const originalAssignedProvider = String(b.assignedProvider || "");

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
    logDevProviderFlow("Provider tried to accept after assignment window expiry", {
      bookingId: b._id?.toString?.() || "",
      providerId: pId,
      assignedProvider: current,
      assignmentIndex: b.assignmentIndex,
      candidateProviders: b.candidateProviders || [],
      rejectedProviders: b.rejectedProviders || [],
      expiresAt: b.expiresAt || null,
    });
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
        io?.of("/bookings").to(b._id.toString()).emit("booking:update", { id: b._id.toString() });
      } catch {}
    } else {
      await handleExhaustedAssignmentChain({
        booking: b,
        now,
        fromProvider: current,
        escalationReason: "acceptance expiry",
      });
    }

    await b.save();
    await BookingLog.create({ action: "booking:accept-expired", userId: pId, bookingId: req.params.id, meta: { attempted: "accepted" } });
    try {
      if (picked?.providerId) {
        await notify({
          recipientId: picked.providerId,
          recipientRole: "provider",
          type: "booking_reassigned",
          meta: { bookingId: b._id.toString(), reason: "accept_expired" },
          respectProviderQuietHours: true,
        });
      }
    } catch {}
    logDevProviderFlow("Expired acceptance rerouted booking", {
      bookingId: b._id?.toString?.() || "",
      fromProvider: current,
      toProvider: picked?.providerId || "",
      newAssignmentIndex: picked?.index ?? -1,
      adminEscalated: b.adminEscalated === true,
      vendorEscalated: b.vendorEscalated === true,
      city: b.address?.city || "",
      expiresAt: b.expiresAt || null,
      status: b.status || "",
    });
    return res.status(409).json({
      error: "This booking request has expired for you and was reassigned to another provider.",
      code: "ACCEPT_WINDOW_EXPIRED",
      booking: b,
    });
  }

  // Handle rejection: move to next eligible candidate or escalate to admin
  if (next === "rejected") {
    const current = b.assignedProvider || "";
    logDevProviderFlow("Provider rejected booking request", {
      bookingId: b._id?.toString?.() || "",
      rejectedProviderId: current,
      assignmentIndex: b.assignmentIndex,
      candidateProviders: b.candidateProviders || [],
      rejectedProvidersBeforeUpdate: b.rejectedProviders || [],
      slotDate: b.slot?.date || "",
      slotTime: b.slot?.time || "",
    });
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
      try {
        await notify({
          recipientId: picked.providerId,
          recipientRole: "provider",
          type: "booking_reassigned",
          meta: { bookingId: b._id.toString(), reason: "rejected" },
          respectProviderQuietHours: true,
        });
      } catch {}
      logDevProviderFlow("Booking moved to next provider after rejection", {
        bookingId: b._id?.toString?.() || "",
        fromProvider: current,
        toProvider: picked.providerId,
        newAssignmentIndex: picked.index,
        rejectedProviders: b.rejectedProviders || [],
        expiresAt: b.expiresAt || null,
      });
    } else {
      const outcome = await handleExhaustedAssignmentChain({
        booking: b,
        now,
        fromProvider: current,
        escalationReason: "provider rejection",
      });
      logDevProviderFlow("Booking reached terminal branch after rejection because no next provider was eligible", {
        bookingId: b._id?.toString?.() || "",
        rejectedProviderId: current,
        candidateProviders: b.candidateProviders || [],
        rejectedProviders: b.rejectedProviders || [],
        city: b.address?.city || "",
        outcome: outcome.kind,
        adminEscalated: b.adminEscalated === true,
        vendorEscalated: b.vendorEscalated === true,
        status: b.status || "",
      });
    }
  } else if (next === "accepted") {
    // Wallet commission check before accepting
    const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
    const acc = await ProviderAccount.findById(pId);
    if (!acc) return res.status(403).json({ error: "Forbidden" });
    const rate = await getProviderCommissionRate(pId);
    const totalAmount = Number(b.totalAmount || 0);
    const discountAmount = Number(b.discount || 0);
    const fundedBy = String(b.discountFundedBy || "admin").toLowerCase();

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

    if (!b.commissionChargedAt && required > 0 && Number(acc.credits || 0) < required) {
      return res.status(409).json({
        error: "Insufficient wallet balance to accept this booking.",
        code: "INSUFFICIENT_WALLET",
        required,
        available: Number(acc.credits || 0),
      });
    }
    if (!b.commissionChargedAt && (required > 0 || (required === 0 && b.discount > 0))) {
      if (required > 0) {
        acc.credits = Math.max(Number(acc.credits || 0) - required, 0);
        await acc.save();
      }
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
      try {
        await notify({
          recipientId: pId,
          recipientRole: "provider",
          type: "commission_hold",
          meta: { bookingId: b._id.toString(), amount: required },
          respectProviderQuietHours: true,
        });
      } catch {}
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

    // Logic for Cancellation by Provider (Active Booking)
    const bookingTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
    const now = new Date();
    const officeSettings = await OfficeSettings.findOne().lean();
    const bufferMin = Math.max(Number(officeSettings?.bufferMinutes || 30), 0);
    const criticalThresholdMinutes = 60 + bufferMin; // 1 hour + buffer (e.g., 90 mins)

    const diffMs = bookingTime ? (bookingTime.getTime() - now.getTime()) : -1;
    const diffMins = diffMs / (1000 * 60);

    const isCritical = diffMins < criticalThresholdMinutes;

    if (isCritical) {
      // Scenario 1: Inside critical window -> Direct Cancel + User Notification
      b.status = "cancelled";
      b.cancelledBy = "provider";
      b.cancellationReason = req.body.reason || "Provider cancelled within critical window";
    } else {
      // Scenario 2: Outside critical window -> Vendor Escalation
      b.status = "provider_cancelled"; // Special status for Vendor Reassignment
      b.cancelledBy = "provider";
      b.cancellationReason = req.body.reason || "Provider requested reassignment";
    }
    
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
        try {
          await notify({
            recipientId: pId,
            recipientRole: "provider",
            type: "commission_refund",
            meta: { bookingId: b._id.toString(), amount: b.commissionAmount },
            respectProviderQuietHours: true,
          });
        } catch {}
      }
    }

    await b.save();
    await BookingLog.create({
      action: "booking:cancel",
      userId: pId,
      bookingId: b._id.toString(),
      meta: { oldStatus, by: "provider", isCritical, diffMins }
    });

    // Notifications
    try {
      const io = getIO();
      const payload = {
        id: b._id.toString(),
        status: b.status,
        providerName: req.provider?.name || "Professional",
        customerName: b.customerName,
        city: b.address?.city || "",
        bookingTime: b.slot?.time,
        bookingDate: b.slot?.date
      };

      if (isCritical) {
        // To User (Direct Message)
        io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "cancelled", message: "Your booking has been cancelled due to professional unavailability." });
        try {
          await notify({
            recipientId: b.customerId,
            recipientRole: "user",
            type: "booking_cancelled",
            meta: { bookingId: b._id.toString(), reason: "professional unavailable" },
          });
        } catch {}
      }

      // To Admin and Vendor
      io?.of("/admin").emit("booking:cancelled", { ...payload, by: "provider", isCritical });
      io?.of("/vendor").emit("booking:cancelled", { ...payload, by: "provider", isCritical });
      try {
        await notify({
          recipientId: "ADMIN001",
          recipientRole: "admin",
          type: "booking_cancelled",
          meta: { bookingId: b._id.toString(), city: b.address?.city || "", isCritical, reason: "cancelled by provider" },
        });
        const city = b.address?.city || "";
        if (city) {
          const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
          if (vendor) {
            await notify({
              recipientId: vendor._id?.toString(),
              recipientRole: "vendor",
              type: "booking_cancelled",
              meta: { bookingId: b._id.toString(), city, isCritical, reason: "cancelled by provider" },
            });
          }
        }
      } catch {}
    } catch (err) {
      // Socket notification failed
    }

    return res.json({ 
      booking: b, 
      message: isCritical 
        ? "Booking cancelled. User has been notified." 
        : "Cancellation sent to Vendor for reassignment." 
    });
  } else {
    // For other provider-driven statuses (travelling, arrived, in_progress, completed, etc.)
    // store normalized lower-case.
    b.status = next;

    // Handle manual cash payment confirmation from provider
    if (req.body.paymentMethod === "cash" && b.balanceAmount > 0) {
      const amountCollected = b.balanceAmount;
      b.paymentStatus = "Fully Paid";
      b.paymentSources = b.paymentSources || [];
      b.paymentSources.push({
        source: "cod",
        amount: amountCollected,
        paidAt: new Date()
      });
      b.balanceAmount = 0;
      
      await BookingLog.create({ 
        action: "booking:payment-update", 
        userId: pId, 
        bookingId: b._id.toString(), 
        meta: { amount: amountCollected, source: "cash", method: "provider_confirmed" } 
      });

      try {
        const io = getIO();
        io?.of("/bookings").to(`booking:${b._id}`).emit("booking:update", { 
          id: b._id.toString(), 
          paymentStatus: "Fully Paid",
          balanceAmount: 0
        });
      } catch {}
    }

    if (next !== "pending") b.expiresAt = null;
    if (next === "completed") {
      const activeSub = await getActiveSubscription(pId, "provider");
      await createLedgerEntry({
        userId: String(pId),
        userType: "provider",
        subscriptionId: activeSub?.subscription?.subscriptionId || "",
        planId: activeSub?.plan?.planId || "",
        entryType: "provider_settlement_adjustment",
        direction: "debit",
        amount: Number(b.commissionAmount || 0),
        meta: {
          bookingId: b._id.toString(),
          commissionRate: await getProviderCommissionRate(pId),
          completedAt: new Date(),
        },
      });
      const city = b.address?.city || "";
      if (city) {
        const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
        if (vendor) {
          const vendorSub = await getActiveSubscription(vendor._id.toString(), "vendor");
          const mode = vendorSub?.plan?.meta?.vendorPerformanceCommissionType || "percentage";
          const value = Number(vendorSub?.plan?.meta?.vendorPerformanceCommissionValue || 0);
          const vendorCommission =
            mode === "fixed"
              ? value
              : Math.round(Number(b.totalAmount || 0) * (value / 100));
          await recordVendorPerformanceCommission({
            vendorId: vendor._id.toString(),
            bookingId: b._id.toString(),
            amount: vendorCommission,
            meta: {
              planId: vendorSub?.plan?.planId || "",
              subscriptionId: vendorSub?.subscription?.subscriptionId || "",
              city,
              mode,
              value,
            },
          });
        }
      }
    }
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
      try {
        await notify({
          recipientId: pId,
          recipientRole: "provider",
          type: "commission_refund",
          meta: { bookingId: b._id.toString(), amount: Number(b.commissionAmount || 0) },
          respectProviderQuietHours: true,
        });
      } catch {}
    }
  }

  const effectiveStatus = String(b.status || next);

  await b.save();
  try {
    if (b?.slot?.date) {
      const ids = Array.from(new Set([originalAssignedProvider, String(b.assignedProvider || ""), pId].filter(Boolean)));
      for (const id of ids) {
        // Keep slot cache in sync for old and current assignees.
        // eslint-disable-next-line no-await-in-loop
        await invalidateProviderSlots(id, b.slot.date);
      }
    }
  } catch {}
  await BookingLog.create({ action: "booking:status", userId: pId, bookingId: req.params.id, meta: { status: effectiveStatus } });
    try {
      const io = getIO();
      // Broad cast for generic list refreshes
      io?.of("/bookings").emit("status:update", { id: req.params.id, status: effectiveStatus });
      // Direct room emit for modals/tracking pages
      io?.of("/bookings").to(`booking:${req.params.id}`).emit("booking:update", { 
        bookingId: req.params.id, 
        status: effectiveStatus 
      });
    } catch {}
  try {
    const notifyStatuses = new Set(["accepted", "completed", "payment_pending"]);
      if (b.customerId && notifyStatuses.has(effectiveStatus)) {
        await notify({
          recipientId: b.customerId,
          recipientRole: "user",
          type: "booking_status",
          meta: { bookingId: b._id.toString(), status: effectiveStatus },
        });
      }
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
    // Persist in Booking for instant loading on user side
    await Booking.findByIdAndUpdate(bookingId, {
      lastProviderLocation: {
        lat: req.body.lat,
        lng: req.body.lng,
        updatedAt: new Date()
      }
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

router.patch("/bookings/:id/activate-manual-assignment", requireRole("provider"), param("id").isString(), async (req, res) => {
  const providerId = req.auth?.sub;
  const booking = await Booking.findById(req.params.id);
  
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (String(booking.assignedProvider) !== String(providerId)) {
    return res.status(403).json({ error: "Forbidden: Booking not assigned to you" });
  }
  
  if (booking.commissionChargedAt) {
    return res.status(400).json({ error: "Commission already paid for this booking" });
  }
  
  const required = Number(booking.commissionAmount || 0);
  if (required <= 0) {
    // If no commission required, just mark it as charged
    booking.commissionChargedAt = new Date();
    await booking.save();
    return res.json({ success: true, booking });
  }
  
  const acc = await ProviderAccount.findById(providerId);
  if (!acc) return res.status(404).json({ error: "Provider not found" });
  
  if (Number(acc.credits || 0) < required) {
    return res.status(409).json({ 
      error: "Insufficient wallet balance to activate this booking.",
      required,
      available: Number(acc.credits || 0)
    });
  }
  
  // Deduct
  acc.credits = Math.max(Number(acc.credits || 0) - required, 0);
  await acc.save();
  
  booking.commissionChargedAt = new Date();
  await booking.save();
  
  // Transaction
  await ProviderWalletTxn.create({
    providerId,
    bookingId: booking._id.toString(),
    type: "commission_hold",
    amount: -required,
    balanceAfter: acc.credits,
    meta: { source: "manual_activation", amount: required },
  });
  
  // Sockets & Notifications
  try {
    const io = getIO();
    io?.of("/bookings").emit("status:update", { id: booking._id.toString(), status: booking.status });
    io?.of("/bookings").to(booking._id.toString()).emit("booking:update", { id: booking._id.toString(), commissionPaid: true });
    // Sound trigger via specialized event
    io?.of("/bookings").emit("provider:commission_paid", { providerId, bookingId: booking._id.toString(), amount: required });
  } catch {}
  
  try {
    await notify({
      recipientId: providerId,
      recipientRole: "provider",
      type: "commission_hold",
      meta: { bookingId: booking._id.toString(), amount: required },
      respectProviderQuietHours: true,
    });
  } catch {}
  
  res.json({ success: true, credits: acc.credits, booking });
});

export default router;
