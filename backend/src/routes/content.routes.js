import { Router } from "express";
import { redis } from "../startup/redis.js";
import { ServiceType, BookingType, Category, Service, Banner, Provider, OfficeSettings } from "../models/Content.js";
import { BookingSettings } from "../models/Settings.js";
import { Spotlight, GalleryItem, Testimonial } from "../models/SiteContent.js";
import { versionedKey } from "../lib/contentCache.js";
import { City, Zone } from "../models/CityZone.js";
import { resolveServiceLocation } from "../lib/locationResolution.js";

const router = Router();

async function cached(keyBase, fn) {
  try {
    const key = await versionedKey(keyBase);
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
    const data = await fn();
    await redis.set(key, JSON.stringify(data), { EX: 300 });
    return data;
  } catch {
    // If Redis is down/misconfigured, serve fresh data without caching.
    return await fn();
  }
}

router.get("/service-types", async (_req, res) => {
  let data = [];
  try {
    data = await cached("content:service-types", () => ServiceType.find().lean());
  } catch {
    data = [];
  }
  // Fallback to fresh DB query if cache is empty but DB has data
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await ServiceType.find().lean();
    } catch { }
  }
  res.json({ data });
});

router.get("/booking-types", async (_req, res) => {
  let data = [];
  try {
    data = await cached("content:booking-types", () => BookingType.find().lean());
  } catch {
    data = [];
  }
  // Fallback
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await BookingType.find().lean();
    } catch { }
  }
  res.json({ data });
});

router.get("/categories", async (req, res) => {
  const gender = req.query.gender;
  let data = [];
  try {
    data = await cached(`content:categories:${gender || "all"}`, () =>
      gender ? Category.find({ gender }).lean() : Category.find().lean()
    );
  } catch {
    data = [];
    /* Fallback disabled for production
    const base = [
      // Women (skin)
      { id: "cleanup", name: "Cleanup", gender: "women", serviceType: "skin", bookingType: "instant" },
      { id: "facial", name: "Facial", gender: "women", serviceType: "skin", bookingType: "instant" },
      { id: "waxing", name: "Waxing", gender: "women", serviceType: "skin", bookingType: "instant" },
      // Men (skin / hair)
      { id: "cleanup", name: "Cleanup", gender: "men", serviceType: "skin", bookingType: "instant" },
      { id: "shave", name: "Clean Shave", gender: "men", serviceType: "skin", bookingType: "instant" },
      { id: "haircut-m", name: "Haircut", gender: "men", serviceType: "hair", bookingType: "instant" },
    ];
    data = gender ? base.filter(b => b.gender === gender) : base;
    */
  }
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await (gender ? Category.find({ gender }).lean() : Category.find().lean());
    } catch { }
  }
  res.json({ data });
});

router.get("/services", async (req, res) => {
  const { category, gender } = req.query;
  const q = {};
  if (category) q.category = category;
  if (gender) q.gender = gender;
  const key = `content:services:${category || "all"}:${gender || "all"}`;
  let data = [];
  try {
    data = await cached(key, () => Service.find(q).lean());
  } catch {
    data = [];
    /* Fallback disabled for production
    const all = [
      // Women Cleanup
      { id: "cleanup_basic_w1", name: "Basic Cleanup", category: "cleanup", gender: "women", price: 499, originalPrice: 699, duration: "45m", rating: 4.6, reviews: 129, description: "Basic skin cleanup for daily glow", includes: ["Cleansing", "Scrub", "Mask"], image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop" },
      { id: "cleanup_premium_w2", name: "Premium Cleanup", category: "cleanup", gender: "women", price: 799, originalPrice: 999, duration: "60m", rating: 4.8, reviews: 212, description: "Premium cleanup with hydration", includes: ["Cleansing", "Hydration", "Massage", "Mask"], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop" },
      // Women Facial
      { id: "facial_bright_w1", name: "Brightening Facial", category: "facial", gender: "women", price: 1199, originalPrice: 1499, duration: "1h 15m", rating: 4.7, reviews: 98, description: "Brightening facial for instant radiance", includes: ["Cleanse", "Steam", "Extraction", "Brightening Mask"], image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&h=300&fit=crop" },
      { id: "facial_antiage_w2", name: "Anti‑Ageing Facial", category: "facial", gender: "women", price: 1699, originalPrice: 1999, duration: "1h 30m", rating: 4.9, reviews: 203, description: "Rejuvenating anti‑ageing therapy", includes: ["Cleanse", "Serum", "Lifting Massage", "Mask"], image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop" },
      // Women Waxing
      { id: "waxing_full_w1", name: "Full Body Wax", category: "waxing", gender: "women", price: 1499, originalPrice: 1799, duration: "1h 30m", rating: 4.6, reviews: 150, description: "Full body wax with aloe care", includes: ["Arms", "Legs", "Underarms"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&h=300&fit=crop" },
      { id: "waxing_basic_w2", name: "Arms + Legs Wax", category: "waxing", gender: "women", price: 899, originalPrice: 1099, duration: "1h", rating: 4.5, reviews: 88, description: "Quick wax for arms & legs", includes: ["Arms", "Legs"], image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop" },
      // Men Cleanup
      { id: "cleanup_basic_m1", name: "Men’s Cleanup", category: "cleanup", gender: "men", price: 449, originalPrice: 599, duration: "40m", rating: 4.5, reviews: 75, description: "Daily cleanup for men", includes: ["Cleanse", "Scrub", "Mask"], image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=400&h=300&fit=crop" },
      // Men Shave
      { id: "shave_clean_m1", name: "Clean Shave", category: "shave", gender: "men", price: 199, originalPrice: 249, duration: "20m", rating: 4.7, reviews: 65, description: "Smooth, irritation‑free shave", includes: ["Pre‑shave", "Shave", "After‑shave"], image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=400&h=300&fit=crop&crop=face" },
      { id: "shave_deluxe_m2", name: "Deluxe Shave & Face Care", category: "shave", gender: "men", price: 349, originalPrice: 449, duration: "35m", rating: 4.8, reviews: 42, description: "Shave with mini cleanup", includes: ["Shave", "Cleanse", "Hydrating Mask"], image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=300&fit=crop" },
    ];
    data = all.filter(s => {
      const byCat = category ? s.category === category : true;
      const byGen = gender ? s.gender === gender : true;
      return byCat && byGen;
    });
    */
  }
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await Service.find(q).lean();
    } catch { }
  }
  res.json({ data });
});

router.get("/banners", async (req, res) => {
  const { gender } = req.query;
  const key = `content:banners:${gender || "all"}`;
  let data = {};
  try {
    data = await cached(key, async () => {
      const now = new Date();
      const items = await Banner.find(gender ? { gender } : {}).lean();
      const active = (items || []).filter((b) => {
        if (b.startAt && new Date(b.startAt).getTime() > now.getTime()) return false;
        if (b.endAt && new Date(b.endAt).getTime() < now.getTime()) return false;
        return true;
      });
      active.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
      const grouped = active.reduce((acc, b) => {
        acc[b.gender] = acc[b.gender] || [];
        acc[b.gender].push({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          gradient: b.gradient,
          image: b.image,
          cta: b.cta,
          linkTo: b.linkTo || "",
          priority: b.priority || 1,
          startAt: b.startAt || null,
          endAt: b.endAt || null,
        });
        return acc;
      }, {});
      return { women: grouped.women || [], men: grouped.men || [] };
    });
  } catch {
    data = { women: [], men: [] };
  }
  res.json({ data });
});

router.get("/spotlights", async (req, res) => {
  const { gender } = req.query;
  const userId = req.user?._id; // Get user ID from auth middleware if available
  const key = `content:spotlights:${gender || "all"}`;
  let data = [];
  try {
    data = await cached(key, async () => {
      const now = new Date();
      const q = { isActive: true };
      if (gender) q.$or = [{ gender }, { gender: "" }];
      const items = await Spotlight.find(q).lean();
      return (items || [])
        .filter((s) => {
          if (s.startAt && new Date(s.startAt).getTime() > now.getTime()) return false;
          if (s.endAt && new Date(s.endAt).getTime() < now.getTime()) return false;
          return true;
        })
        .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
    });

    // Add isLikedByUser flag if user is logged in
    if (userId) {
      data = data.map(spotlight => ({
        ...spotlight,
        isLikedByUser: spotlight.likedBy?.some(id => id.toString() === userId.toString()) || false
      }));
    }
  } catch {
    data = [];
  }
  res.json({ data });
});

// Like/Unlike spotlight endpoint
router.post("/spotlights/:id/like", async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const spotlight = await Spotlight.findOne({ id: req.params.id });
    if (!spotlight) {
      return res.status(404).json({ error: "Spotlight not found" });
    }

    const likedIndex = spotlight.likedBy.findIndex(id => id.toString() === userId.toString());

    if (likedIndex > -1) {
      // Unlike
      spotlight.likedBy.splice(likedIndex, 1);
      spotlight.likes = Math.max(0, spotlight.likes - 1);
    } else {
      // Like
      spotlight.likedBy.push(userId);
      spotlight.likes += 1;
    }

    await spotlight.save();

    res.json({
      success: true,
      likes: spotlight.likes,
      isLikedByUser: likedIndex === -1
    });
  } catch (error) {
    console.error("Error toggling spotlight like:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

router.get("/gallery", async (_req, res) => {
  let data = [];
  try {
    data = await cached("content:gallery", async () => {
      const items = await GalleryItem.find({ isActive: true }).lean();
      return (items || []).sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
    });
  } catch {
    data = [];
  }
  res.json({ data });
});

router.get("/testimonials", async (_req, res) => {
  let data = [];
  try {
    data = await cached("content:testimonials", async () => {
      const items = await Testimonial.find({ isActive: true }).lean();
      return (items || []).sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
    });
  } catch {
    data = [];
  }
  res.json({ data });
});

router.get("/providers", async (_req, res) => {
  let data = [];
  try {
    data = await cached("content:providers", () => Provider.find().lean());
  } catch {
    data = [];
  }
  res.json({ data });
});

router.get("/office-settings", async (_req, res) => {
  let data = {};
  try {
    data = await cached("content:office-settings", async () => {
      const s = await OfficeSettings.findOne().lean();
      return s || { startTime: "09:00", endTime: "21:00", autoAssign: true, bufferMinutes: 30, notificationMessage: "Our pros are sleeping. Service starts at 9:00 AM" };
    });
  } catch {
    data = { startTime: "09:00", endTime: "21:00", autoAssign: true, bufferMinutes: 30, notificationMessage: "Our pros are sleeping. Service starts at 9:00 AM" };
  }
  res.json({ data });
});

router.get("/cities", async (_req, res) => {
  const cities = await City.find({ status: "active" }).sort({ name: 1 }).lean();
  res.json({ cities });
});

router.get("/zones", async (req, res) => {
  const { cityId, cityName } = req.query;
  let q = { status: "active" };
  if (cityId) q.city = cityId;
  else if (cityName) {
    const city = await City.findOne({ name: new RegExp(`^${cityName}$`, "i") });
    if (city) q.city = city._id;
    else return res.json({ zones: [] });
  }
  const zones = await Zone.find(q).sort({ name: 1 }).lean();
  res.json({ zones });
});

router.get("/resolve-location", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const cityId = String(req.query.cityId || "").trim();
  const cityName = String(req.query.cityName || "").trim();
  const resolved = await resolveServiceLocation({ lat, lng, cityId, cityName });
  res.json({ location: resolved });
});

router.get("/booking-settings", async (_req, res) => {
  let data = {};
  try {
    data = await cached("content:booking-settings", async () => {
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
    });
  } catch {
    data = {
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
  res.json({ data });
});

export default router;
