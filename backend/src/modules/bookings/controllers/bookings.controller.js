import { validationResult } from "express-validator";
import Booking from "../../../models/Booking.js";
import Notification from "../../../models/Notification.js";
import mongoose from "mongoose";
import Coupon from "../../../models/Coupon.js";
import { OfficeSettings, Category } from "../../../models/Content.js";
import { BookingSettings } from "../../../models/Settings.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import BookingLog from "../../../models/BookingLog.js";
import CustomEnquiry from "../../../models/CustomEnquiry.js";
import UserSubscription from "../../../models/UserSubscription.js";
import SubscriptionPlan from "../../../models/SubscriptionPlan.js";
import { DEFAULT_TIME_SLOTS, slotLabelToLocalDateTime, parseSlotLabelToHM } from "../../../lib/slots.js";
import { isIsoDate } from "../../../lib/isoDateTime.js";
import { computeExpiresAt } from "../../../lib/assignment.js";
import { computeAvailableSlots } from "../../../lib/availability.js";
import Razorpay from "razorpay";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../../../config.js";
import { getIO } from "../../../startup/socket.js";

async function computeAdvanceFromCategories(items = [], bookingType = "instant") {
  // Logic: Instant bookings never require advance payment.
  const bType = String(bookingType || "instant").toLowerCase();
  if (bType === "instant") return 0;

  const catIds = Array.from(new Set(items.map((it) => it.category).filter(Boolean)));
  const cats = await Category.find({ id: { $in: catIds } }).lean();
  const byId = new Map(cats.map((c) => [c.id, c]));
  let sum = 0;
  for (const it of items) {
    const c = byId.get(it.category);
    if (!c) continue;
    const pct = Number(c.advancePercentage || 0);
    const catType = String(c.bookingType || "").toLowerCase();
    // Advance applies if category is scheduled/prebook/customize OR if explicitly requested as scheduled/prebook
    if (pct > 0 && (catType === "scheduled" || catType === "prebooking" || catType === "pre-book" || catType === "customize" || bType === "scheduled" || bType === "pre-book")) {
      sum += Math.ceil((Number(it.price) || 0) * (pct / 100));
    }
  }
  return Math.max(sum, 0);
}
function computeTotals(items = [], coupon) {
  const total = items.reduce((sum, it) => sum + (Number(it.price) * (Number(it.quantity) || 1)), 0);
  let discount = 0;
  if (coupon) {
    if (coupon.type) {
      if (String(coupon.type).toUpperCase() === "FIXED") {
        discount = Number(coupon.value);
      } else {
        discount = Math.round(total * (Number(coupon.value) / 100));
      }
    } else if (coupon.discountType) {
      if (coupon.discountType === "flat") {
        discount = Number(coupon.discountValue);
      } else {
        discount = Math.round(total * (Number(coupon.discountValue) / 100));
      }
    }
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    if (coupon.minOrder && total < coupon.minOrder) {
      discount = 0;
    }
  }
  return { total, discount, finalTotal: Math.max(total - discount, 0) };
}

function bookingServicesToItems(services = []) {
  if (!Array.isArray(services)) return [];
  return services.map((s) => ({
    name: s?.name || "",
    price: Number(s?.price) || 0,
    duration: s?.duration || "",
    category: s?.category || "",
    serviceType: s?.serviceType || "",
    quantity: 1,
  }));
}

async function loadBookingSettings() {
  const s = await BookingSettings.findOne().lean();
  return s || {
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
  };
}

function parseHHMMToMinutes(v) {
  const m = String(v || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

async function attachProviderToBookings(bookings = []) {
  const raw = Array.from(new Set(
    (bookings || []).map((b) => String(b?.assignedProvider || "")).filter(Boolean)
  ));
  if (raw.length === 0) return bookings;

  const idIds = raw.filter((v) => mongoose.isValidObjectId(v));
  const phoneIds = raw.filter((v) => /^\d{10}$/.test(v));

  const provsById = idIds.length
    ? await ProviderAccount.find({ _id: { $in: idIds } }).select("name phone rating profilePhoto experience city").lean()
    : [];
  const provsByPhone = phoneIds.length
    ? await ProviderAccount.find({ phone: { $in: phoneIds } }).select("name phone rating profilePhoto experience city").lean()
    : [];

  const byKey = new Map();
  for (const p of [...(provsById || []), ...(provsByPhone || [])]) {
    byKey.set(p._id.toString(), p);
    if (p.phone) byKey.set(String(p.phone), p);
  }
  return (bookings || []).map((b) => {
    const p = byKey.get(String(b.assignedProvider || ""));
    if (!p) return b;
    const slot = {
      ...(b.slot || {}),
      provider: {
        id: p._id.toString(),
        name: p.name || "",
        rating: p.rating || 0,
        profilePhoto: p.profilePhoto || "",
        experience: p.experience || "",
        city: p.city || "",
      },
    };
    return { ...b, slot };
  });
}

export async function list(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const q = { customerId: req.user._id.toString() };
  const total = await Booking.countDocuments(q);
  const items = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  let bookings = (items || []).map((b) => ({
    ...b,
    id: b._id?.toString?.() || b.id,
    // Back-compat for UI: some components expect booking.items[] (older shape) instead of booking.services[].
    items: Array.isArray(b.items) ? b.items : bookingServicesToItems(b.services),
  }));
  bookings = await attachProviderToBookings(bookings);
  res.json({ bookings, page, limit, total });
}

export async function quote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  let coupon = null;
  if (req.body.couponCode) {
    coupon = await Coupon.findOne({ code: req.body.couponCode, isActive: true }).lean();
  }
  const totals = computeTotals(req.body.items, coupon);
  const advanceAmount = await computeAdvanceFromCategories(req.body.items || [], req.body.bookingType);
  res.json({ ...totals, couponApplied: coupon ? coupon.code : null, advanceAmount });
}

export async function create(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { items, slot, address, bookingType, couponCode, allowAutoFallback } = req.body;
  const fallbackAddr = (req.user?.addresses && req.user.addresses[0]) ? req.user.addresses[0] : {};
  // Persist booking city for analytics + filtering. Back-compat: if city not provided, fall back to area.
  const safeAddress = {
    houseNo: address?.houseNo || fallbackAddr.houseNo || "",
    area: address?.area || fallbackAddr.area || "",
    landmark: address?.landmark || fallbackAddr.landmark || "",
    city: address?.city || address?.area || fallbackAddr.city || fallbackAddr.area || "",
    lat: address?.lat ?? fallbackAddr.lat ?? null,
    lng: address?.lng ?? fallbackAddr.lng ?? null,
  };
  const preferredProviderId = String(req.body.preferredProviderId || "").trim();
  let coupon = null;
  if (couponCode) coupon = await Coupon.findOne({ code: couponCode, isActive: true }).lean();
  const totals = computeTotals(items, coupon);
  const advanceAmount = await computeAdvanceFromCategories(items, bookingType);

  // Check for SWM Plus subscription
  const subscription = await UserSubscription.findOne({ userId: req.user._id.toString(), status: 'active' });
  if (subscription) {
    const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
    if (plan && plan.meta.discountPercentage > 0 && totals.finalTotal >= plan.meta.minCartValueForDiscount) {
      totals.discount += Math.round(totals.finalTotal * (plan.meta.discountPercentage / 100));
      totals.finalTotal = Math.max(totals.total - totals.discount, 0);
    }
  }

  const settings = await loadBookingSettings();
  if (settings?.minBookingAmount && totals.finalTotal < Number(settings.minBookingAmount)) {
    return res.status(400).json({ error: `Minimum booking amount is INR ${settings.minBookingAmount}.` });
  }
  if (settings?.maxServicesPerBooking && Array.isArray(items) && items.length > Number(settings.maxServicesPerBooking)) {
    return res.status(400).json({ error: `Maximum ${settings.maxServicesPerBooking} services allowed per booking.` });
  }
  const office = await OfficeSettings.findOne().lean();
  const now = new Date();
  const [startH, startM] = (office?.startTime || "09:00").split(":").map(Number);
  const [endH, endM] = (office?.endTime || "21:00").split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const withinOffice = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  let notificationStatus = withinOffice ? "immediate" : "queued";
  
  // Admin toggle check: If autoAssign is false in OfficeSettings, global auto-assign is disabled
  const autoAssignAllowed = office?.autoAssign !== false;
  
  // Use admin setting as base, but also respect if user explicitly asked for autoAssign (or if we want to force it)
  const autoAssign = autoAssignAllowed; 
  
  // Build candidate provider list within 5 km from user's address lat/lng if available
  const userLat = Number(req.user?.addresses?.[0]?.lat);
  const userLng = Number(req.user?.addresses?.[0]?.lng);
  const requestedDate = String(slot?.date || "").trim();
  const requestedTime = String(slot?.time || "").trim();
  const wantCats = new Set((items || []).map(it => String(it.category || "")).filter(Boolean));
  const wantTypes = new Set((items || []).map(it => String(it.serviceType || "")).filter(Boolean));
  const matchesSpecialty = (p) => {
    const spec = p?.documents?.specializations || [];
    if (!Array.isArray(spec) || spec.length === 0) return true;
    return spec.some(s => wantCats.has(s) || wantTypes.has(s));
  };
  const wantsKnownDate = isIsoDate(requestedDate);
  const wantsKnownSlot = DEFAULT_TIME_SLOTS.includes(requestedTime);
  let candidateProviders = [];

  // SWM Pro Partner lead assignment logic
  const proPartnerIds = (await UserSubscription.find({ userType: 'provider', status: 'active' })).map(s => s.userId);

  // Enforce booking window + lead time if slot is valid
  if (isIsoDate(requestedDate) && DEFAULT_TIME_SLOTS.includes(requestedTime)) {
    const slotStart = slotLabelToLocalDateTime(requestedDate, requestedTime);
    if (!slotStart) return res.status(400).json({ error: "Invalid booking slot" });
    const leadMs = Math.max(Number(settings?.minLeadTimeMinutes || 0), 0) * 60 * 1000;
    if (leadMs > 0 && slotStart.getTime() < (now.getTime() + leadMs)) {
      return res.status(400).json({ error: "Selected slot violates minimum lead time." });
    }
    const maxDays = Math.max(Number(settings?.maxBookingDays || 0), 0);
    if (maxDays > 0) {
      const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
      if (slotStart.getTime() > maxDate.getTime()) {
        return res.status(400).json({ error: "Selected slot exceeds maximum advance booking days." });
      }
    }
    const windowStartMin = parseHHMMToMinutes(settings?.serviceStartTime || "");
    const windowEndMin = parseHHMMToMinutes(settings?.serviceEndTime || "");
    const hm = parseSlotLabelToHM(requestedTime);
    if (windowStartMin !== null && windowEndMin !== null && hm) {
      const slotMin = hm.hour * 60 + hm.minute;
      if (slotMin < windowStartMin || slotMin > windowEndMin) {
        return res.status(400).json({ error: "Selected slot is outside service hours." });
      }
    }
  }
  const isProviderAvailableAtSlot = async (providerId) => {
    if (!wantsKnownSlot || !wantsKnownDate) return true;
    const avail = await computeAvailableSlots(providerId, requestedDate, settings);
    return avail?.slotMap?.[requestedTime] === true;
  };

  if (!Number.isNaN(userLat) && !Number.isNaN(userLng)) {
    const providers = await ProviderAccount.find({
      approvalStatus: "approved",
      registrationComplete: true,
      "currentLocation.lat": { $ne: null },
      "currentLocation.lng": { $ne: null }
    }).lean();
    const toRad = (v) => (v * Math.PI) / 180;
    const distKm = (a, b) => {
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const aVal = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
      return R * c;
    };
    const maxKm = Math.max(Number(settings?.maxServiceRadiusKm || 5), 1);
    const sorted = providers
      .filter(p => matchesSpecialty(p))
      .map(p => ({
        id: p._id.toString(),
        d: distKm({ lat: userLat, lng: userLng }, { lat: p.currentLocation.lat, lng: p.currentLocation.lng }),
        online: p.isOnline ? 1 : 0,
        isPro: proPartnerIds.includes(p._id.toString()) ? 1 : 0,
      }))
      .filter(x => x.d <= maxKm)
      .sort((a, b) => (b.isPro - a.isPro) || (b.online - a.online) || (a.d - b.d));

    for (const s of sorted) {
      if (await isProviderAvailableAtSlot(s.id)) candidateProviders.push(s.id);
    }
  }
  // If no location-based candidates, compute a fallback list (rating-based) so auto-assign still works.
  if (candidateProviders.length === 0) {
    const providers = await ProviderAccount.find({
      approvalStatus: "approved",
      registrationComplete: true,
    }).lean();

    const sorted = providers
      .filter(p => matchesSpecialty(p))
      .map((p) => ({
        id: p._id.toString(),
        rating: Number(p.rating || 0),
        jobs: Number(p.totalJobs || 0),
        online: p.isOnline ? 1 : 0,
      }))
      .sort((a, b) => {
        const o = b.online - a.online;
        if (o !== 0) return o;
        const r = b.rating - a.rating;
        if (r !== 0) return r;
        return b.jobs - a.jobs;
      });

    for (const s of sorted) {
      if (await isProviderAvailableAtSlot(s.id)) candidateProviders.push(s.id);
    }
  }

  const providerIsCandidate = (pid) => !!pid && candidateProviders.includes(pid);
  
  // LOGIC CHANGE: Check if preferred provider is busy
  if (preferredProviderId && !providerIsCandidate(preferredProviderId) && !allowAutoFallback) {
    return res.status(409).json({
      error: "Your selected provider is booked for the selected time slot. Do you want to auto allocation booking to the next provider?",
      code: "PREFERRED_PROVIDER_BUSY"
    });
  }

  let assignedProvider = "";
  if (autoAssignAllowed) {
    if (preferredProviderId && providerIsCandidate(preferredProviderId)) {
      assignedProvider = preferredProviderId;
      candidateProviders = [preferredProviderId, ...candidateProviders.filter((x) => x !== preferredProviderId)];
    } else if (candidateProviders.length > 0) {
      // If preferred is busy or not specified, pick the best candidate automatically
      assignedProvider = candidateProviders[0];
    }
  }

  // If autoAssign is completely OFF or NO providers were found even in candidate list, it stays unassigned/admin-escalated.
  // We only fail if user expects something that is absolutely impossible (like no providers exist at all for that slot)
  if (!assignedProvider && autoAssignAllowed && candidateProviders.length === 0) {
    return res.status(409).json({
      error: "No professionals are currently available for this slot. Please try a different time or date.",
      code: "NO_PROVIDERS",
    });
  }
  const maxCandidates = Math.max(Number(settings?.providerSearchLimit || 0), 0);
  if (maxCandidates > 0 && candidateProviders.length > maxCandidates) {
    candidateProviders = candidateProviders.slice(0, maxCandidates);
  }
  const assignmentIndex = assignedProvider ? 0 : -1;
  const lastAssignedAt = assignedProvider ? new Date() : null;
  const expiresAt = assignedProvider ? computeExpiresAt(lastAssignedAt) : null;

  // Developer Log: Track assignment
  if (assignedProvider) {
    const isPreferred = assignedProvider === preferredProviderId;
    const isAnyPro = !preferredProviderId;
    // Fetch name for console logging
    let provName = "Unknown";
    try {
      const pDoc = await ProviderAccount.findById(assignedProvider).select("name").lean();
      if (pDoc) provName = pDoc.name;
    } catch (e) {}
    
    let mode = "AUTO-ASSIGNED";
    if (isPreferred) mode = "PREFERRED";
    else if (isAnyPro) mode = "ANY-PROFESSIONAL (Random)";
    
    console.log(`[Booking] Assignment: ${mode} Provider = ${provName} (ID: ${assignedProvider})`);
  } else {
    console.log(`[Booking] Assignment: NO Provider assigned (Admin escalation required)`);
  }

  const booking = await Booking.create({
    customerId: req.user._id.toString(),
    customerName: req.user.name || "",
    services: items.map(it => ({
      name: it.name, price: it.price, duration: it.duration, category: it.category, serviceType: it.serviceType,
    })),
    totalAmount: totals.finalTotal,
    discount: totals.discount,
    prepaidAmount: 0,
    balanceAmount: totals.finalTotal,
    paymentStatus: "Pending",
    address: safeAddress,
    slot,
    bookingType,
    status: "pending",
    notificationStatus,
    assignedProvider,
    maintainProvider: preferredProviderId || "",
    otp: (Math.floor(1000 + Math.random() * 9000)).toString(),
    beforeImages: [],
    afterImages: [],
    productImages: [],
    providerImages: [],
    providerFeedback: "",
    candidateProviders,
    rejectedProviders: [],
    assignmentIndex,
    lastAssignedAt,
    expiresAt,
    adminEscalated: autoAssignAllowed ? !assignedProvider : true,
  });
  let order = null;
  if (advanceAmount > 0 && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const rzp = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
      });
      order = await rzp.orders.create({
        amount: advanceAmount * 100,
        currency: "INR",
        receipt: `swm_${booking._id}`,
        notes: { bookingId: booking._id.toString() },
      });
    } catch (e) {
      order = null;
    }
  }
  {
    const base = { ...booking.toObject(), id: booking._id.toString() };
    const enriched = (await attachProviderToBookings([{
      ...base,
      items: Array.isArray(base.items) ? base.items : bookingServicesToItems(base.services),
    }]))[0];
    res.status(201).json({
      booking: enriched,
      totals,
      advanceAmount,
      order,
    });
  }
  if (notificationStatus === "queued") {
    await BookingLog.create({
      action: "booking:queue",
      userId: req.user._id.toString(),
      bookingId: booking._id.toString(),
      meta: { reason: "outside_office_hours" },
    });
  }
  await BookingLog.create({
    action: "booking:create",
    userId: req.user._id.toString(),
    bookingId: booking._id.toString(),
    meta: { totals, advanceAmount }
  });
}

export async function getById(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() }).lean();
  if (!booking) return res.status(404).json({ error: "Not found" });
  const base = {
    ...booking,
    id: booking._id?.toString?.() || booking.id,
    items: Array.isArray(booking.items) ? booking.items : bookingServicesToItems(booking.services),
  };
  const enriched = (await attachProviderToBookings([base]))[0];
  res.json({ booking: enriched });
}

export async function track(req, res) {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Not found" });
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() }).lean();
  if (!booking) return res.status(404).json({ error: "Not found" });

  const lat = booking.address?.lat;
  const lng = booking.address?.lng;
  const userLocation = (typeof lat === "number" && typeof lng === "number") ? { lat, lng } : null;

  let providerLocation = null;
  let providerMeta = null;
  const providerId = String(booking.assignedProvider || "").trim();
  if (providerId) {
    let provider = null;
    if (mongoose.isValidObjectId(providerId)) {
      provider = await ProviderAccount.findById(providerId).select("name currentLocation").lean();
    } else if (/^\d{10}$/.test(providerId)) {
      provider = await ProviderAccount.findOne({ phone: providerId }).select("name currentLocation").lean();
    }
    if (provider) {
      const plat = provider.currentLocation?.lat;
      const plng = provider.currentLocation?.lng;
      if (typeof plat === "number" && typeof plng === "number") {
        providerLocation = { lat: plat, lng: plng };
      }
      providerMeta = { id: provider._id?.toString?.() || "", name: provider.name || "" };
    }
  }

  res.json({
    bookingId: booking._id?.toString?.() || id,
    userLocation,
    providerLocation,
    providerMeta,
  });
}

export async function createCustomEnquiry(req, res) {
  const { name, phone, eventType, noOfPeople, date, timeSlot, selectedServices, notes, address } = req.body;
  const fallbackAddr = (req.user?.addresses && req.user.addresses[0]) ? req.user.addresses[0] : {};
  const items = (selectedServices || []).map((s) => ({
    id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0,
  }));
  const peopleCount = Number(noOfPeople);
  const doc = await CustomEnquiry.create({
    userId: req.user._id.toString(),
    name, phone, eventType, noOfPeople,
    peopleCount: Number.isFinite(peopleCount) ? peopleCount : 0,
    scheduledAt: { date, timeSlot },
    items,
    notes: notes || "",
    address: {
      houseNo: address?.houseNo || fallbackAddr.houseNo || "",
      area: address?.area || fallbackAddr.area || "",
      landmark: address?.landmark || fallbackAddr.landmark || "",
      lat: address?.lat ?? fallbackAddr.lat ?? null,
      lng: address?.lng ?? fallbackAddr.lng ?? null,
      city: address?.city || fallbackAddr.city || "",
    },
    status: "enquiry_created",
    paymentStatus: "pending",
    timeline: [{ action: "enquiry_created" }],
  });
  res.status(201).json({ enquiry: doc });
}

export async function listCustomEnquiries(req, res) {
  const items = await CustomEnquiry.find({ userId: req.user._id.toString() }).sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function userAcceptCustomEnquiry(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });
  if (enq.quote?.expiryAt) {
    const exp = new Date(enq.quote.expiryAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      enq.status = "quote_expired";
      enq.timeline.push({ action: "quote_expired", meta: { at: exp.toISOString() } });
      await enq.save();
      return res.status(409).json({ error: "Quote has expired. Please request a new quote.", code: "QUOTE_EXPIRED" });
    }
  }
  enq.status = "waiting_for_customer_payment";
  enq.timeline.push({ action: "waiting_for_customer_payment" });
  await enq.save();
  res.json({ enquiry: enq });
}

export async function userMarkCustomAdvancePaid(req, res) {
  const { id } = req.params;
  const amount = Number(req.body.amount || 0);
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });
  if (enq.quote?.expiryAt) {
    const exp = new Date(enq.quote.expiryAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      enq.status = "quote_expired";
      enq.timeline.push({ action: "quote_expired", meta: { at: exp.toISOString() } });
      await enq.save();
      return res.status(409).json({ error: "Quote has expired. Please request a new quote.", code: "QUOTE_EXPIRED" });
    }
  }
  const paid = amount > 0 ? amount : Number(enq.quote?.prebookAmount || 0);
  enq.paymentStatus = "paid";
  enq.prebookAmountPaid = paid;
  enq.prebookPaidAt = new Date();
  enq.status = "advance_paid";
  enq.timeline.push({ action: "advance_paid", meta: { amount: paid } });
  await enq.save();
  res.json({ enquiry: enq });
}

export async function userRejectCustomEnquiry(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findOne({ _id: id, userId: req.user._id.toString() });
  if (!enq) return res.status(404).json({ error: "Not found" });

  const st = String(enq.status || "").toLowerCase();
  if (["service_completed", "completed"].includes(st)) {
    return res.status(409).json({ error: "Completed enquiries cannot be rejected." });
  }

  enq.status = "rejected";
  enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
  enq.timeline.push({
    action: "rejected",
    meta: { by: "customer", paymentStatus: enq.paymentStatus || "pending" },
  });
  await enq.save();
  res.json({ enquiry: enq });
}

// Admin helpers
export async function adminListCustomEnquiries(_req, res) {
  const items = await CustomEnquiry.find().sort({ createdAt: -1 }).lean();
  res.json({ enquiries: items });
}

export async function adminPriceQuote(req, res) {
  const { id } = req.params;
  const { items, totalAmount, discountPrice, notes, prebookAmount, totalServiceTime, quoteExpiryHours, quoteExpiryAt } = req.body;
  const enq = await CustomEnquiry.findById(id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  let expiryAt = null;
  if (quoteExpiryAt) {
    const dt = new Date(quoteExpiryAt);
    expiryAt = Number.isNaN(dt.getTime()) ? null : dt;
  } else if (quoteExpiryHours) {
    const hours = Number(quoteExpiryHours);
    if (Number.isFinite(hours) && hours > 0) {
      expiryAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }
  enq.quote = {
    items: (items || []).map((s) => ({ id: s.id, name: s.name, category: s.category, serviceType: s.serviceType, quantity: s.quantity || 1, price: Number(s.price) || 0 })),
    totalAmount: Number(totalAmount) || 0,
    discountPrice: Number(discountPrice) || 0,
    notes: notes || "",
    prebookAmount: Number(prebookAmount) || 0,
    totalServiceTime: String(totalServiceTime || ""),
    expiryAt,
  };
  enq.status = "admin_approved";
  enq.timeline.push({ action: "admin_approved", meta: { totalAmount: enq.quote.totalAmount, discountPrice: enq.quote.discountPrice } });
  await enq.save();
  res.json({ enquiry: enq });
}

export async function adminFinalApprove(req, res) {
  const { id } = req.params;
  const enq = await CustomEnquiry.findById(id);
  if (!enq) return res.status(404).json({ error: "Not found" });
  const createBookingNow = req.body?.createBooking !== false;
  let booking = null;
  if (createBookingNow) {
    // Convert to a normal booking with quoted items
    const items = (enq.quote?.items || enq.items || []);
    const total = (enq.quote?.totalAmount ?? items.reduce((s, it) => s + (Number(it.price) * (it.quantity || 1)), 0));
    booking = await Booking.create({
      customerId: enq.userId,
      customerName: enq.name || "",
      services: items.map(it => ({ name: it.name, price: it.price, duration: "", category: it.category, serviceType: it.serviceType })),
      totalAmount: total,
      prepaidAmount: 0,
      balanceAmount: total,
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
      status: "final_approved",
      assignedProvider: enq.maintainerProvider || "",
      maintainProvider: enq.maintainerProvider || "",
      teamMembers: Array.isArray(enq.teamMembers) ? enq.teamMembers : [],
    });
    enq.bookingId = booking._id.toString();
  }
  enq.status = "final_approved";
  enq.timeline.push({ action: "final_approved", meta: { bookingId: booking?._id?.toString?.() || "" } });
  await enq.save();
  res.json({ enquiry: enq, booking });
}

export async function cancel(req, res) {
  const { id } = req.params;
  const booking = await Booking.findOne({ _id: id, customerId: req.user._id.toString() });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  // Check for SWM Plus subscription for free cancellation
  const subscription = await UserSubscription.findOne({ userId: req.user._id.toString(), status: 'active' });
  if (subscription) {
    const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
    if (plan && plan.benefits.includes("FREE_CANCELLATION")) {
      const bookingTime = new Date(booking.slot.date + 'T' + booking.slot.time);
      const now = new Date();
      const diffHours = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (diffHours > 2) { // Free cancellation up to 2 hours before
        booking.status = "cancelled";
        await booking.save();
        return res.json({ booking, message: "Booking cancelled successfully with SWM Plus benefits." });
      }
    }
  }

  const status = (booking.status || "").toLowerCase();
  const restrictedStatuses = ["arrived", "in_progress", "completed", "cancelled", "rejected"];
  if (restrictedStatuses.includes(status)) {
    return res.status(400).json({ 
      error: `Cannot cancel booking with current status: ${booking.status}` 
    });
  }

  const oldStatus = booking.status;
  booking.status = "cancelled";
  await booking.save();

  await BookingLog.create({
    action: "booking:cancel",
    userId: req.user._id.toString(),
    bookingId: id,
    meta: { oldStatus, by: "customer" }
  });

  // Socket notifications
  try {
    const io = getIO();
    const payload = { 
      id: booking._id.toString(), 
      status: "cancelled", 
      customerName: booking.customerName,
      city: booking.address?.city || ""
    };

    // To Provider
    if (booking.assignedProvider) {
      io?.of("/bookings").emit("status:update", { id: booking._id.toString(), status: "cancelled", providerId: booking.assignedProvider });
    }

    // To Admin and Vendor (City based)
    io?.of("/admin").emit("booking:cancelled", payload);
    io?.of("/vendor").emit("booking:cancelled", payload);

    // Create DB Notifications
    if (booking.assignedProvider) {
      await Notification.create({
        recipientId: booking.assignedProvider,
        recipientRole: "provider",
        title: "Booking Cancelled",
        message: `Booking #${booking._id.toString().slice(-6)} has been cancelled by the customer.`,
        type: "booking_cancel",
        meta: { bookingId: booking._id.toString() }
      });
    }
  } catch (err) {
    console.error("Socket notification failed:", err);
  }

  res.json({ booking });
}
