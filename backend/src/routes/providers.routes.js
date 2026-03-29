import { Router } from "express";
import mongoose from "mongoose";
import { param, query, validationResult } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { DEFAULT_TIME_SLOTS, isIsoDate, slotLabelToLocalDateTime, parseDurationToMinutes } from "../lib/slots.js";
import { computeAvailableSlots } from "../lib/availability.js";

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
  };
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/:providerId/available-slots",
  requireAuth,
  param("providerId").isString().notEmpty(),
  query("date").isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

    const providerId = String(req.params.providerId || "").trim();
    const date = String(req.query.date || "").trim();
    if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

    const provider = await ProviderAccount.findById(providerId).lean();
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    const allowPending = process.env.NODE_ENV !== "production";
    const approvalOk = allowPending ? (provider.approvalStatus === "approved" || provider.approvalStatus === "pending") : provider.approvalStatus === "approved";
    if (!approvalOk || !provider.registrationComplete) {
      return res.status(404).json({ error: "Provider not available" });
    }

    const settings = await BookingSettings.findOne().lean();
    const result = await computeAvailableSlots(providerId, date, settings);
    res.json({ provider: providerCard(provider), ...result });
  }
);

// Debug endpoint to inspect busy slot windows (dev only)
router.get(
  "/debug/slot-windows",
  requireAuth,
  query("providerId").isString().notEmpty(),
  query("date").isString().notEmpty(),
  async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });
    const providerId = String(req.query.providerId || "").trim();
    const date = String(req.query.date || "").trim();
    if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

    const provider = await ProviderAccount.findById(providerId).lean();
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const settings = await BookingSettings.findOne().lean();
    const bufferMin = Math.max(Number(settings?.providerBufferMinutes || 0), 0);
    const bookings = await Booking.find({
      assignedProvider: providerId,
      "slot.date": date,
      status: { $ne: "cancelled" },
    }).select("slot slotStartAt slotEndAt services status").lean();

    const busyStatuses = new Set(["accepted", "travelling", "arrived", "in_progress"]);
    const windows = [];
    for (const b of (bookings || [])) {
      const st = String(b?.status || "").toLowerCase();
      if (!busyStatuses.has(st)) continue;
      const start = b?.slotStartAt ? new Date(b.slotStartAt) : slotLabelToLocalDateTime(date, b?.slot?.time);
      if (!start || Number.isNaN(start.getTime())) continue;
      const services = Array.isArray(b?.services) ? b.services : [];
      const totalMinutes = services.reduce((sum, it) => sum + parseDurationToMinutes(it?.duration, 60), 0) || 60;
      const end = b?.slotEndAt ? new Date(b.slotEndAt) : new Date(start.getTime() + (totalMinutes + bufferMin) * 60 * 1000);
      windows.push({
        bookingId: b._id?.toString(),
        status: st,
        slotTime: b?.slot?.time || "",
        durationMin: totalMinutes,
        bufferMin,
        startAt: start,
        endAt: end,
      });
    }

    res.json({ date, providerId, windows, count: windows.length });
  }
);

// Debug endpoint to inspect merged slots by city (dev only)
router.get(
  "/debug/merged-slots",
  requireAuth,
  query("date").isString().notEmpty(),
  async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

    const date = String(req.query.date || "").trim();
    if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

    const addr0 = (req.user?.addresses || [])[0] || {};
    const cityGuess = String(req.query.city || addr0.city || addr0.area || "").trim();
    const allowPending = process.env.NODE_ENV !== "production";
    const baseQ = { approvalStatus: allowPending ? { $in: ["approved", "pending"] } : "approved", registrationComplete: true };
    let providers = cityGuess
      ? await ProviderAccount.find({ ...baseQ, city: new RegExp(escapeRegex(cityGuess), "i") }).lean()
      : await ProviderAccount.find(baseQ).lean();
    if (cityGuess && providers.length === 0) {
      providers = await ProviderAccount.find(baseQ).lean();
    }
    if (providers.length === 0 && process.env.NODE_ENV !== "production") {
      providers = cityGuess
        ? await ProviderAccount.find({ ...baseQ, city: new RegExp(escapeRegex(cityGuess), "i") }).lean()
        : await ProviderAccount.find(baseQ).lean();
    }

    const settings = await BookingSettings.findOne().lean();
    const slotMap = {};
    const candidateProvidersBySlot = {};
    DEFAULT_TIME_SLOTS.forEach((s) => {
      slotMap[s] = false;
      candidateProvidersBySlot[s] = [];
    });

    const providerSummaries = [];
    for (const provider of providers) {
      const result = await computeAvailableSlots(provider._id?.toString(), date, settings);
      providerSummaries.push({
        id: provider._id?.toString(),
        name: provider.name || "",
        city: provider.city || "",
        slots: result.slots || [],
      });
      for (const slot of result.slots || []) {
        slotMap[slot] = true;
        candidateProvidersBySlot[slot].push(String(provider._id));
      }
    }

    const slots = DEFAULT_TIME_SLOTS.filter((s) => slotMap[s]);
    res.json({ date, city: cityGuess, slots, slotMap, candidateProvidersBySlot, providers: providerSummaries });
  }
);

router.get(
  "/available-slots-by-date",
  requireAuth,
  query("date").isString().notEmpty(),
  query("providerId").optional().isString(),
  query("serviceTypes").optional().isString(),
  query("city").optional().isString(),
  query("zone").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid input", details: errors.array() });

    const date = String(req.query.date || "").trim();
    const providerId = String(req.query.providerId || "").trim();
    const city = String(req.query.city || "").trim();
    const zone = String(req.query.zone || "").trim();
    const serviceTypes = String(req.query.serviceTypes || "").split(",").map(s => s.trim()).filter(Boolean);

    if (!isIsoDate(date)) return res.status(400).json({ error: "Invalid date" });

    const bookingSettings = await BookingSettings.findOne().lean();
    const officeSettings = await OfficeSettings.findOne().lean();
    const settings = { ...bookingSettings, ...officeSettings };

    // Case 1: Specific Provider Requested (Ensure it's a valid ID and not the string "null")
    if (providerId && providerId !== "null" && mongoose.isValidObjectId(providerId)) {
      const provider = await ProviderAccount.findById(providerId).lean();
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      const result = await computeAvailableSlots(providerId, date, settings);
      return res.json({
        date,
        slots: result.slots || [],
        slotMap: result.slotMap || {},
        provider: providerCard(provider)
      });
    }

    // Case 2: Any Professional Requested (Merged Slots)
    const addr0 = (req.user?.addresses || [])[0] || {};
    const cityGuess = city || String(addr0.city || addr0.area || "").trim();
    const zoneGuess = zone || String(addr0.zone || "").trim();
    
    const allowPending = process.env.NODE_ENV !== "production";
    const baseQ = {
      approvalStatus: allowPending ? { $in: ["approved", "pending"] } : "approved",
      registrationComplete: true
    };

    // Filter by city and zone
    let q = { ...baseQ };
    if (cityGuess) {
      q.city = new RegExp(`^${escapeRegex(cityGuess)}$`, "i");
    }
    if (zoneGuess) {
      q.$or = [
        { zone: new RegExp(`^${escapeRegex(zoneGuess)}$`, "i") },
        { address: new RegExp(escapeRegex(zoneGuess), "i") }
      ];
    }

    let providers = await ProviderAccount.find(q).lean();

    if (cityGuess && providers.length === 0 && !zoneGuess) {
      providers = await ProviderAccount.find(baseQ).lean();
    }

    // Filter by service types if provided
    if (serviceTypes.length > 0) {
      const wantSet = new Set(serviceTypes);
      providers = providers.filter(p => {
        const spec = p?.documents?.specializations || [];
        if (!Array.isArray(spec) || spec.length === 0) return true; // Default to true if no specs defined
        return spec.some(s => wantSet.has(s));
      });
    }

    const slotMap = {};
    const candidateProvidersBySlot = {};
    DEFAULT_TIME_SLOTS.forEach((s) => {
      slotMap[s] = false;
      candidateProvidersBySlot[s] = [];
    });

    for (const provider of providers) {
      const result = await computeAvailableSlots(provider._id?.toString(), date, settings);
      for (const slot of result.slots || []) {
        slotMap[slot] = true;
        candidateProvidersBySlot[slot].push(String(provider._id));
      }
    }

    const slots = DEFAULT_TIME_SLOTS.filter((s) => slotMap[s]);
    res.json({ date, slots, slotMap, candidateProvidersBySlot, city: cityGuess });
  }
);

router.patch("/:id/approve-zones", requireAuth, param("id").isString(), async (req, res) => {
  const p = await ProviderAccount.findById(req.params.id);
  if (!p) return res.status(404).json({ error: "Provider not found" });
  if (p.pendingZones && p.pendingZones.length > 0) {
    p.zones = [...new Set([...(p.zones || []), ...p.pendingZones])];
    p.pendingZones = [];
    await p.save();
    // Notification logic would go here if notify were imported
  }
  res.json({ provider: p });
});

router.patch("/:id/reject-zones", requireAuth, param("id").isString(), async (req, res) => {
  const p = await ProviderAccount.findByIdAndUpdate(req.params.id, { $set: { pendingZones: [] } }, { new: true });
  if (!p) return res.status(404).json({ error: "Provider not found" });
  res.json({ provider: p });
});

export default router;
