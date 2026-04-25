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

// Master Initialization Endpoint - Aggregates 10 calls into 1
router.get("/init", async (req, res) => {
  try {
    const now = new Date();

    // Execute all cache checks/DB queries concurrently
    const [
      serviceTypes,
      bookingTypes,
      categories,
      popularServices,
      bannersData,
      providers,
      officeSettings,
      spotlightsData,
      gallery,
      testimonials
    ] = await Promise.all([
      cached("content:service-types", () => ServiceType.find().lean()),
      cached("content:booking-types", () => BookingType.find().lean()),
      cached("content:categories:all", () => Category.find().lean()),
      cached("content:services:popular", () => Service.find({ rating: { $gte: 4.5 } }).select("-gallery -steps").limit(50).lean()),

      // Banners Logic
      cached("content:banners:all", async () => {
        const items = await Banner.find({}).lean();
        const active = (items || []).filter((b) => {
          if (b.startAt && new Date(b.startAt).getTime() > now.getTime()) return false;
          if (b.endAt && new Date(b.endAt).getTime() < now.getTime()) return false;
          return true;
        });
        active.sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
        const grouped = active.reduce((acc, b) => {
          acc[b.gender] = acc[b.gender] || [];
          acc[b.gender].push({ ...b, priority: b.priority || 1 });
          return acc;
        }, {});
        return { women: grouped.women || [], men: grouped.men || [] };
      }),

      cached("content:providers", () => Provider.find().lean()),

      // Office Settings
      cached("content:office-settings", async () => {
        const s = await OfficeSettings.findOne().lean();
        return s || { startTime: "09:00", endTime: "21:00", autoAssign: true, bufferMinutes: 30, notificationMessage: "Our pros are sleeping. Service starts at 9:00 AM" };
      }),

      // Spotlights Logic
      cached("content:spotlights:all", async () => {
        const items = await Spotlight.find({ isActive: true }).lean();
        return (items || [])
          .filter((s) => {
            if (s.startAt && new Date(s.startAt).getTime() > now.getTime()) return false;
            if (s.endAt && new Date(s.endAt).getTime() < now.getTime()) return false;
            return true;
          })
          .sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
      }),

      // Gallery
      cached("content:gallery", async () => {
        const items = await GalleryItem.find({ isActive: true }).lean();
        return (items || []).sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
      }),

      // Testimonials
      cached("content:testimonials", async () => {
        const items = await Testimonial.find({ isActive: true }).lean();
        return (items || []).sort((a, b) => (Number(b.priority || 0) - Number(a.priority || 0)));
      })
    ]);

    // Handle like status for spotlights if user is authenticated (pass token if required, but usually /init is public)
    const userId = req.user?._id;
    const spotlights = userId ? spotlightsData.map(spotlight => ({
      ...spotlight,
      isLikedByUser: spotlight.likedBy?.some(id => id.toString() === userId.toString()) || false
    })) : spotlightsData;

    res.json({
      data: {
        serviceTypes: serviceTypes || [],
        bookingTypeConfig: bookingTypes || [],
        categories: categories || [],
        popularServices: popularServices || [],
        banners: bannersData || { women: [], men: [] },
        providers: providers || [],
        officeSettings,
        spotlights: spotlights || [],
        gallery: gallery || [],
        testimonials: testimonials || []
      }
    });
  } catch (error) {
    console.error("Init endpoint error:", error);
    res.status(500).json({ error: "Failed to initialize app content" });
  }
});

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
  const { category, gender, page = 1, limit } = req.query;
  const q = {};
  if (category) q.category = category;
  if (gender) q.gender = gender;
  
  // ✅ FIX: Use a high default limit (1000) for registration/catalog, 
  // but respect the requested limit if provided (e.g., from infinite scroll).
  const effectiveLimit = limit ? parseInt(limit) : 1000;
  const skip = (parseInt(page) - 1) * effectiveLimit;
  const key = `content:services:${category || "all"}:${gender || "all"}:p${page}:l${effectiveLimit}`;
  
  let data = [];
  try {
    data = await cached(key, () => 
      Service.find(q)
        .select("-gallery -steps")
        .skip(skip)
        .limit(effectiveLimit)
        .lean()
    );
  } catch {
    data = [];
  }
  
  if (!Array.isArray(data) || data.length === 0) {
    try {
      data = await Service.find(q)
        .select("-gallery -steps")
        .skip(skip)
        .limit(effectiveLimit)
        .lean();
    } catch { }
  }
  res.json({ data });
});

router.get("/services/:id", async (req, res) => {
  try {
    const service = await Service.findOne({ id: req.params.id }).lean();
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json({ data: service });
  } catch (error) {
    console.error("Fetch service error:", error);
    res.status(500).json({ error: "Failed to fetch service details" });
  }
});

router.get("/search", async (req, res) => {
  const { q: rawQ, gender, category } = req.query;
  const q = (rawQ || "").trim();
  if (!q || q.length < 2) return res.json({ data: [] });

  try {
    const qRegex = new RegExp(q, "i");

    // Find categories that match the query
    const matchingCategories = await Category.find({ name: qRegex }).select("id");
    const matchingCategoryIds = matchingCategories.map(c => c.id);

    const query = {
      $or: [
        { name: qRegex },
        { description: qRegex },
        { category: { $in: matchingCategoryIds } }
      ]
    };
    if (gender) query.gender = gender;
    if (category) query.category = category;

    let data = await Service.find(query).select("-gallery -steps").limit(50).lean();

    // Sort by relevance: Name matches first, then Category matches, then Description matches
    data.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(q.toLowerCase());
      const bNameMatch = b.name.toLowerCase().includes(q.toLowerCase());
      const aCatMatch = matchingCategoryIds.includes(a.category);
      const bCatMatch = matchingCategoryIds.includes(b.category);
      
      const getScore = (isName, isCat) => {
        if (isName) return 0;
        if (isCat) return 1;
        return 2;
      };

      const aScore = getScore(aNameMatch, aCatMatch);
      const bScore = getScore(bNameMatch, bCatMatch);

      if (aScore !== bScore) return aScore - bScore;
      return (b.rating || 0) - (a.rating || 0);
    });

    res.json({ data });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
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

router.get("/services/reviews/:serviceName", async (req, res) => {
  try {
    const { serviceName } = req.params;
    const Feedback = (await import("../models/Feedback.js")).default;
    const Booking = (await import("../models/Booking.js")).default;

    // 1. Get all active feedback for this service
    const feedbacks = await Feedback.find({ 
      serviceName: new RegExp(`^${escapeRegex(serviceName)}$`, "i"),
      status: "active" 
    }).sort({ createdAt: -1 }).limit(20).lean();

    // 2. Get all approved images from bookings for this service
    const bookingsWithImages = await Booking.find({
      $or: [
        { "services.name": new RegExp(`^${escapeRegex(serviceName)}$`, "i") },
        { "items.name": new RegExp(`^${escapeRegex(serviceName)}$`, "i") }
      ],
      imagesApproved: true,
      status: "completed"
    })
    .select("beforeImages afterImages productImages customerName createdAt")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    res.json({
      success: true,
      data: {
        feedbacks,
        gallery: bookingsWithImages.map(b => ({
          before: b.beforeImages || [],
          after: b.afterImages || [],
          products: b.productImages || [],
          customerName: b.customerName,
          date: b.createdAt
        }))
      }
    });
  } catch (error) {
    console.error("Error fetching service reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default router;
