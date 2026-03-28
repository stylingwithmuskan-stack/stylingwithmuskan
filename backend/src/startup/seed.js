import mongoose from "mongoose";
import { ServiceType, BookingType, Category, Service, Banner, Provider, OfficeSettings } from "../models/Content.js";
import { BookingSettings } from "../models/Settings.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import { ensureSubscriptionDefaults } from "../lib/subscriptions.js";

export async function seedContentIfNeeded() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return;
    }
  } catch {}
  await ensureSubscriptionDefaults();
  const count = await ServiceType.countDocuments();
  if (count > 0) {
    // Even if initial content exists, ensure essential categories/services are present
    await ensureCategoriesAndServices();
    return;
  }

  const serviceTypes = [
    { id: "skin", label: "Skin Care", image: "/skin_service_banner_1772177557335.png", description: "Facials, waxing & cleanups", color: "from-amber-400 to-orange-500", textColor: "text-amber-600", bgColor: "bg-amber-100" },
    { id: "hair", label: "Hair Services", image: "/hair_service_banner_1772177572229.png", description: "Cutting, spa & coloring", color: "from-blue-400 to-indigo-500", textColor: "text-blue-600", bgColor: "bg-blue-100" },
    { id: "makeup", label: "Makeup & More", image: "/makeup_service_banner_1772177590551.png", description: "Party, bridal & grooming", color: "from-pink-400 to-rose-500", textColor: "text-pink-600", bgColor: "bg-pink-100" },
  ];

  const bookingTypes = [
    { id: "instant", label: "Instant Booking", icon: "⚡", description: "Pro reaches within 60 mins" },
    { id: "scheduled", label: "Pre-book Service", icon: "📅", description: "Choose your own date & time" },
    { id: "customize", label: "Custom Package", icon: "✨", description: "For events & bulk bookings" },
  ];

  const categories = [
    { id: "bridal", name: "Bridal", icon: "💍", gender: "women", serviceType: "makeup", bookingType: "instant", advancePercentage: 30, image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face" },
    { id: "facial", name: "Facial", icon: "✨", gender: "women", serviceType: "skin", bookingType: "instant", advancePercentage: 20, image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=150&h=150&fit=crop&crop=face" },
    { id: "waxing", name: "Waxing", icon: "🌿", gender: "women", serviceType: "skin", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=150&h=150&fit=crop&crop=face" },
    { id: "makeup", name: "Makeup", icon: "💄", gender: "women", serviceType: "makeup", bookingType: "instant", advancePercentage: 20, image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&h=150&fit=crop&crop=face" },
    { id: "hairspa", name: "Hair Spa", icon: "💆‍♀️", gender: "women", serviceType: "hair", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&crop=face" },
    { id: "manicure", name: "Manicure", icon: "💅", gender: "women", serviceType: "skin", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=150&h=150&fit=crop" },
    { id: "pedicure", name: "Pedicure", icon: "🦶", gender: "women", serviceType: "skin", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=150&h=150&fit=crop" },
    { id: "threading", name: "Threading", icon: "🪡", gender: "women", serviceType: "makeup", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=150&h=150&fit=crop&crop=face" },
    { id: "haircut-m", name: "Haircut", icon: "✂️", gender: "men", serviceType: "hair", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&h=150&fit=crop&crop=face" },
    { id: "beard", name: "Beard Styling", icon: "🧔", gender: "men", serviceType: "hair", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&h=150&fit=crop" },
    { id: "cleanup", name: "Cleanup", icon: "🧴", gender: "men", serviceType: "skin", bookingType: "instant", advancePercentage: 0, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
    { id: "haircolor", name: "Hair Color", icon: "🎨", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=150&h=150&fit=crop&crop=face" },
    { id: "grooming", name: "Grooming", icon: "💈", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=150&h=150&fit=crop" },
    { id: "facial-m", name: "Facial", icon: "🧖‍♂️", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=150&h=150&fit=crop&crop=face" },
    { id: "massage-m", name: "Massage", icon: "💪", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=150&h=150&fit=crop" },
    { id: "shave", name: "Clean Shave", icon: "🪒", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=150&h=150&fit=crop&crop=face" },
  ];

  const services = [
    { id: "s1", name: "Bridal Makeup Package", category: "bridal", gender: "women", price: 14999, originalPrice: 19999, duration: "3-4 hrs", rating: 4.9, reviews: 328, description: "Complete bridal transformation with HD makeup, hairstyling, and draping. Our expert beauticians ensure you look stunning on your special day.", includes: ["HD Makeup", "Hairstyling", "Saree Draping", "Touch-up Kit", "False Lashes"], steps: [{ name: "Skin Prep", description: "Cleansing, toning & moisturizing for a flawless base", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=120&h=120&fit=crop" }, { name: "Base Makeup", description: "HD foundation, concealer & setting for long wear", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&h=120&fit=crop" }, { name: "Eye Makeup", description: "Eyeshadow, liner, lashes for a dramatic look", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" }, { name: "Hairstyling", description: "Elegant updo or style as per preference", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" }, { name: "Final Touch", description: "Setting spray, touch-up kit handover", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=120&h=120&fit=crop" }], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop" },
  ];

  const banners = {
    women: [
      { id: 1, title: "Bridal Season Special", subtitle: "Flat 20% off on all bridal packages", gradient: "from-pink-200 via-rose-100 to-amber-100", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&h=400&fit=crop", cta: "Book Now" },
      { id: 2, title: "Glow Up Facial Fest", subtitle: "Premium facials starting ₹999", gradient: "from-purple-200 via-pink-100 to-rose-100", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&h=400&fit=crop", cta: "Explore" },
      { id: 3, title: "Monsoon Hair Spa", subtitle: "Repair & nourish your hair this season", gradient: "from-teal-100 via-pink-50 to-rose-100", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=400&fit=crop", cta: "Get Offer" },
    ],
    men: [
      { id: 1, title: "Grooming Essentials", subtitle: "Complete grooming package at ₹999", gradient: "from-slate-700 via-slate-600 to-blue-900", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&h=400&fit=crop", cta: "Book Now" },
      { id: 2, title: "Beard Boss Sale", subtitle: "Beard styling + haircut combo ₹549", gradient: "from-gray-800 via-slate-700 to-indigo-900", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=400&fit=crop", cta: "Grab Deal" },
      { id: 3, title: "Fresh Cut Friday", subtitle: "Flat 30% off on all haircuts", gradient: "from-zinc-800 via-gray-700 to-slate-800", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=400&fit=crop", cta: "Get Offer" },
    ],
  };

  const providers = [
    { id: "p1", name: "Muskan Sharma", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop", tag: "Best Rated", rating: 4.9, experience: "8+ Years", totalJobs: 1250, specialties: ["makeup", "skin", "hair"] },
    { id: "p2", name: "Priya Verma", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop", tag: "Top Choice", rating: 4.8, experience: "5+ Years", totalJobs: 890, specialties: ["skin", "makeup"] },
  ];

  await ServiceType.insertMany(serviceTypes);
  await BookingType.insertMany(bookingTypes);
  await Category.insertMany(categories);
  await Service.insertMany(services);
  await Banner.insertMany([
    ...banners.women.map((b) => ({ gender: "women", ...b })),
    ...banners.men.map((b) => ({ gender: "men", ...b })),
  ]);
  await Provider.insertMany(providers);
  await OfficeSettings.create({
    startTime: "09:00",
    endTime: "21:00",
    autoAssign: true,
    notificationMessage: "Our pros are sleeping. Service starts at 9:00 AM",
  });
  await BookingSettings.create({
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
  });
  console.log("Seeded content");
  // Ensure extended categories/services exist
  await ensureCategoriesAndServices();
}

export async function seedDemoDataIfNeeded() {
  try {
    if (mongoose.connection.readyState !== 1) return;
  } catch {}
  const demoPhone = process.env.DEMO_DEFAULT_PHONE || "1234567890";
  let user = await User.findOne({ phone: demoPhone });
  if (!user) {
    user = await User.create({
      phone: demoPhone,
      name: "Demo User",
      isVerified: true,
      addresses: [{ houseNo: "101", area: "Downtown", landmark: "Near Park", type: "home" }],
    });
    console.log("Seeded demo user", demoPhone);
  }
  const services = await Service.find().lean();
  if (services.length > 0) {
    const items = services.slice(0, Math.min(3, services.length)).map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.duration,
      category: s.category,
      serviceType: s.gender === "women" ? "skin" : "hair",
    }));
    const total = items.reduce((sum, i) => sum + (i.price || 0), 0);
    const existing = await Booking.findOne({ customerId: user._id.toString() });
    if (!existing) {
      const b = await Booking.create({
        customerId: user._id.toString(),
        customerName: user.name,
        services: items,
        totalAmount: total,
        prepaidAmount: Math.round(total * 0.2),
        balanceAmount: Math.round(total * 0.8),
        address: user.addresses?.[0] || { houseNo: "101", area: "Downtown", landmark: "" },
        slot: { date: new Date().toISOString().slice(0, 10), time: "10:00" },
        bookingType: "scheduled",
        status: "pending",
      });
      console.log("Seeded demo booking", b._id.toString());
    }
  }

  // Seed a demo provider and their bookings for dashboard (phone: 9638527410)
  try {
    const provPhone = "9638527410";
    let prov = await ProviderAccount.findOne({ phone: provPhone });
    if (!prov) {
      prov = await ProviderAccount.create({
        phone: provPhone,
        name: "Demo Beautician",
        email: "pro@example.com",
        gender: "women",
        experience: "3-5",
        profilePhoto: "",
        approvalStatus: "approved",
        registrationComplete: true,
        rating: 4.6,
        totalJobs: 120,
        city: "Demo City",
      });
      console.log("Seeded demo provider", provPhone);
    }
    const existingProvJobs = await Booking.countDocuments({ assignedProvider: prov._id.toString() });
    if (existingProvJobs === 0) {
      const today = new Date();
      const day = today.toISOString().slice(0, 10);
      const mk = (status, offsetHours, name, price) => ({
        customerId: "CUST-" + Math.random().toString(36).slice(2, 7),
        customerName: "Local Customer",
        services: [{ name, price, duration: "60m", category: "hair", serviceType: "instant" }],
        totalAmount: price,
        prepaidAmount: 0,
        balanceAmount: price,
        address: { houseNo: "A-12", area: "Downtown", landmark: "Near Park" },
        slot: { date: day, time: String(offsetHours).padStart(2, "0") + ":00" },
        bookingType: "instant",
        status,
        otp: "1234",
        assignedProvider: prov._id.toString(),
      });
      await Booking.insertMany([
        mk("incoming", 9, "Haircut", 299),
        mk("pending", 10, "Facial", 999),
        mk("accepted", 11, "Waxing", 799),
        mk("travelling", 12, "Hair Spa", 1299),
        mk("arrived", 13, "Threading", 99),
        mk("in_progress", 14, "Beard Styling", 299),
        mk("completed", 15, "Grooming Package", 1499),
        mk("cancelled", 16, "Cleanup", 699),
      ]);
      console.log("Seeded demo provider bookings", prov._id.toString());
    }
  } catch {}

  // Seed city-wide demo service providers if none exist
  try {
    const count = await ProviderAccount.countDocuments();
    if (count === 0) {
      const cities = [
        "Delhi",
        "Mumbai",
        "Bangalore",
        "Hyderabad",
        "Chennai",
        "Pune",
        "Kolkata",
        "Jaipur",
        "Gurgaon",
        "Noida",
        "Lucknow",
        "Chandigarh",
        "Indore",
      ];
      const docs = [];
      let idx = 0;
      const mkPhone = (base, add) => String(base + add).padStart(10, "9").slice(0, 10);
      for (const c of cities) {
        for (let i = 0; i < 3; i++) {
          idx++;
          docs.push({
            phone: mkPhone(9100000000, idx),
            name: `Demo ${c} Provider ${i + 1}`,
            email: `demo${i + 1}.${c.toLowerCase()}@swm.com`,
            city: c,
            gender: i % 2 === 0 ? "women" : "men",
            experience: i % 2 === 0 ? "1-3" : "3-5",
            profilePhoto: "",
            approvalStatus: i === 0 ? "approved" : "pending",
            registrationComplete: true,
            rating: 4.2 + (i % 2) * 0.3,
            totalJobs: 10 + i * 7,
          });
        }
      }
      await ProviderAccount.insertMany(docs);
      console.log("Seeded demo providers across cities");
    }
  } catch (e) {
    console.log("Demo providers seeding failed", e?.message || e);
  }

  // Seed a demo vendor for quick login
  try {
    const Vendor = (await import("../models/Vendor.js")).default;
    const exists = await Vendor.findOne({ email: "vendor@swm.com" }).lean();
    if (!exists) {
      await Vendor.create({
        name: "Demo Vendor",
        email: "vendor@swm.com",
        phone: "9999999999",
        city: "Indore",
        status: "approved",
        businessName: "SWM City Ops",
      });
      console.log("Seeded demo vendor vendor@swm.com (city: Indore)");
    }
  } catch (e) {
    console.log("Demo vendor seeding failed", e?.message || e);
  }

  // Seed two nearby users and two nearby providers (within ~5km) for nearest-provider tests
  try {
    const UserModel = (await import("../models/User.js")).default;
    const ProvModel = (await import("../models/ProviderAccount.js")).default;
    // Coordinates near Connaught Place, New Delhi
    const baseLat = 28.6315, baseLng = 77.2167;
    const users = [
      { phone: "9000000001", name: "Test User A", addresses: [{ houseNo: "A-101", area: "Connaught Place", landmark: "Block A", type: "home", lat: baseLat, lng: baseLng, city: "Delhi" }] },
      { phone: "9000000002", name: "Test User B", addresses: [{ houseNo: "B-202", area: "Barakhamba", landmark: "Metro", type: "home", lat: baseLat + 0.02, lng: baseLng + 0.02, city: "Delhi" }] },
    ];
    for (const u of users) {
      const exists = await UserModel.findOne({ phone: u.phone });
      if (!exists) {
        await UserModel.create({ phone: u.phone, name: u.name, isVerified: true, addresses: u.addresses });
        console.log("Seeded test user", u.phone);
      }
    }
    const providers = [
      { phone: "9000001001", name: "Nearby Pro 1", approvalStatus: "approved", registrationComplete: true, isOnline: true, currentLocation: { lat: baseLat + 0.01, lng: baseLng + 0.01 }, documents: { specializations: ["hair", "skin"] } },
      { phone: "9000001002", name: "Nearby Pro 2", approvalStatus: "approved", registrationComplete: true, isOnline: true, currentLocation: { lat: baseLat - 0.01, lng: baseLng - 0.01 }, documents: { specializations: ["makeup", "skin"] } },
    ];
    for (const p of providers) {
      const exists = await ProvModel.findOne({ phone: p.phone });
      if (!exists) {
        await ProvModel.create(p);
        console.log("Seeded nearby provider", p.phone);
      }
    }
  } catch (e) {
    console.log("Nearby seed failed", e?.message || e);
  }

  // Seed sample coupons if none exist
  try {
    const Coupon = (await import("../models/Coupon.js")).default;
    const countCoupons = await Coupon.countDocuments();
    if (countCoupons === 0) {
      const docs = [
        { code: "WELCOME50", discountType: "percentage", discountValue: 50, type: "PERCENT", value: 50, minOrder: 499, maxDiscount: 300, perUserLimit: 1, totalLimit: 1000, firstTimeOnly: true, isActive: true, category: "All" },
        { code: "FLAT100", discountType: "flat", discountValue: 100, type: "FIXED", value: 100, minOrder: 499, maxDiscount: 100, perUserLimit: 2, totalLimit: 1000, isActive: true, category: "All" },
        { code: "GLOW10", discountType: "percentage", discountValue: 10, type: "PERCENT", value: 10, minOrder: 799, maxDiscount: 200, perUserLimit: 3, totalLimit: 500, isActive: true, category: "Skin Care" },
      ];
      await Coupon.insertMany(docs);
      console.log("Seeded sample coupons");
    }
  } catch (e) {
    console.log("Coupon seed failed", e?.message || e);
  }
}

export async function ensureCategoriesAndServices() {
  // Upsert important categories (women cleanup included for explore flow)
  const mustHaveCategories = [
    // Women
    { id: "cleanup", name: "Cleanup", icon: "🧴", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&h=150&fit=crop" },
    { id: "facial", name: "Facial", icon: "✨", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=150&h=150&fit=crop" },
    { id: "waxing", name: "Waxing", icon: "🌿", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=150&h=150&fit=crop" },
    { id: "bridal", name: "Bridal", icon: "💍", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face" },
    { id: "makeup", name: "Makeup", icon: "💄", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&h=150&fit=crop&crop=face" },
    { id: "hairspa", name: "Hair Spa", icon: "💆‍♀️", gender: "women", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&crop=face" },
    { id: "manicure", name: "Manicure", icon: "💅", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=150&h=150&fit=crop" },
    { id: "pedicure", name: "Pedicure", icon: "🦶", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=150&h=150&fit=crop" },
    { id: "threading", name: "Threading", icon: "🪡", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=150&h=150&fit=crop&crop=face" },
    // Men
    { id: "cleanup", name: "Cleanup", icon: "🧴", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" },
    { id: "shave", name: "Clean Shave", icon: "🪒", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=150&h=150&fit=crop&crop=face" },
    { id: "haircut-m", name: "Haircut", icon: "✂️", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&h=150&fit=crop&crop=face" },
    { id: "beard", name: "Beard Styling", icon: "🧔", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&h=150&fit=crop" },
    { id: "haircolor", name: "Hair Color", icon: "🎨", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=150&h=150&fit=crop&crop=face" },
    { id: "grooming", name: "Grooming", icon: "💈", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=150&h=150&fit=crop&crop=face" },
    { id: "facial-m", name: "Facial", icon: "🧖‍♂️", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=150&h=150&fit=crop&crop=face" },
    { id: "massage-m", name: "Massage", icon: "💪", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=150&h=150&fit=crop" },
  ];
  const catOps = mustHaveCategories.map(c => ({
    updateOne: {
      filter: { id: c.id, gender: c.gender },
      update: { $setOnInsert: c },
      upsert: true,
    }
  }));

  if (catOps.length > 0) {
    await Category.bulkWrite(catOps);
  }

  // Upsert services across categories with price variations
  const servicesToEnsure = [
    // Women: Cleanup (skin)
    { id: "cleanup_basic_w1", name: "Basic Cleanup", category: "cleanup", gender: "women", price: 499, originalPrice: 699, duration: "45m", rating: 4.6, reviews: 129, description: "Basic skin cleanup for daily glow", includes: ["Cleansing", "Scrub", "Mask"], image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop" },
    { id: "cleanup_premium_w2", name: "Premium Cleanup", category: "cleanup", gender: "women", price: 799, originalPrice: 999, duration: "60m", rating: 4.8, reviews: 212, description: "Premium cleanup with hydration", includes: ["Cleansing", "Hydration", "Massage", "Mask"], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop" },
    // Women: Facial
    { id: "facial_bright_w1", name: "Brightening Facial", category: "facial", gender: "women", price: 1199, originalPrice: 1499, duration: "1h 15m", rating: 4.7, reviews: 98, description: "Brightening facial for instant radiance", includes: ["Cleanse", "Steam", "Extraction", "Brightening Mask"], image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&h=300&fit=crop" },
    { id: "facial_antiage_w2", name: "Anti‑Ageing Facial", category: "facial", gender: "women", price: 1699, originalPrice: 1999, duration: "1h 30m", rating: 4.9, reviews: 203, description: "Rejuvenating anti‑ageing therapy", includes: ["Cleanse", "Serum", "Lifting Massage", "Mask"], image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop" },
    // Women: Waxing
    { id: "waxing_full_w1", name: "Full Body Wax", category: "waxing", gender: "women", price: 1499, originalPrice: 1799, duration: "1h 30m", rating: 4.6, reviews: 150, description: "Full body wax with aloe care", includes: ["Arms", "Legs", "Underarms"], image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&h=300&fit=crop" },
    { id: "waxing_basic_w2", name: "Arms + Legs Wax", category: "waxing", gender: "women", price: 899, originalPrice: 1099, duration: "1h", rating: 4.5, reviews: 88, description: "Quick wax for arms & legs", includes: ["Arms", "Legs"], image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop" },
    // Women: Bridal
    { id: "bridal_package_w1", name: "Bridal Makeup Package", category: "bridal", gender: "women", price: 14999, originalPrice: 19999, duration: "3h", rating: 4.9, reviews: 328, description: "Complete bridal transformation", includes: ["HD Makeup", "Hairstyling", "Draping"], image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop" },
    // Women: Makeup
    { id: "makeup_party_w1", name: "Party Makeup", category: "makeup", gender: "women", price: 2999, originalPrice: 3999, duration: "90m", rating: 4.8, reviews: 245, description: "Glamorous party look", includes: ["Airbrush", "Hairstyle"], image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop" },
    // Women: Hair Spa
    { id: "hairspa_keratin_w1", name: "Keratin Hair Spa", category: "hairspa", gender: "women", price: 1299, originalPrice: 1799, duration: "75m", rating: 4.7, reviews: 367, description: "Deep conditioning hair spa", includes: ["Wash", "Condition", "Mask"], image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop" },
    // Women: Manicure
    { id: "manicure_classic_w1", name: "Classic Manicure", category: "manicure", gender: "women", price: 699, originalPrice: 899, duration: "45m", rating: 4.7, reviews: 112, description: "Nail and hand care", includes: ["Shape", "Cuticle", "Polish"], image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop" },
    // Women: Pedicure
    { id: "pedicure_spa_w1", name: "Spa Pedicure", category: "pedicure", gender: "women", price: 799, originalPrice: 999, duration: "60m", rating: 4.8, reviews: 156, description: "Relaxing foot care", includes: ["Soak", "Scrub", "Massage"], image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=400&h=300&fit=crop" },
    // Women: Threading
    { id: "threading_brows_w1", name: "Eyebrow Threading", category: "threading", gender: "women", price: 99, originalPrice: 149, duration: "15m", rating: 4.7, reviews: 220, description: "Precise brow shaping", includes: ["Brow Threading"], image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=400&h=300&fit=crop" },
    // Men: Cleanup
    { id: "cleanup_basic_m1", name: "Men’s Cleanup", category: "cleanup", gender: "men", price: 449, originalPrice: 599, duration: "40m", rating: 4.5, reviews: 75, description: "Daily cleanup for men", includes: ["Cleanse", "Scrub", "Mask"], image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=400&h=300&fit=crop" },
    { id: "cleanup_deluxe_m2", name: "Deluxe Men’s Cleanup", category: "cleanup", gender: "men", price: 799, originalPrice: 999, duration: "60m", rating: 4.8, reviews: 210, description: "Hydrating deluxe cleanup for instant glow", includes: ["Deep Cleanse", "Hydration", "Massage", "Mask"], image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop" },
    // Men: Shave
    { id: "shave_clean_m1", name: "Clean Shave", category: "shave", gender: "men", price: 199, originalPrice: 249, duration: "20m", rating: 4.7, reviews: 65, description: "Smooth, irritation‑free shave", includes: ["Pre‑shave", "Shave", "After‑shave"], image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=400&h=300&fit=crop&crop=face" },
    { id: "shave_deluxe_m2", name: "Deluxe Shave & Face Care", category: "shave", gender: "men", price: 349, originalPrice: 449, duration: "35m", rating: 4.8, reviews: 42, description: "Shave with mini cleanup", includes: ["Shave", "Cleanse", "Hydrating Mask"], image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=300&fit=crop" },
    // Men: Haircut
    { id: "haircut_classic_m1", name: "Classic Haircut", category: "haircut-m", gender: "men", price: 399, originalPrice: 599, duration: "30m", rating: 4.7, reviews: 1200, description: "Professional haircut", includes: ["Consult", "Cut", "Style"], image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop" },
    // Men: Beard
    { id: "beard_trim_m1", name: "Beard Styling & Trim", category: "beard", gender: "men", price: 299, originalPrice: 499, duration: "25m", rating: 4.7, reviews: 856, description: "Beard shaping and grooming", includes: ["Trim", "Shape", "Oil"], image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=300&fit=crop" },
    // Men: Hair Color
    { id: "haircolor_basic_m1", name: "Hair Color", category: "haircolor", gender: "men", price: 799, originalPrice: 1199, duration: "45m", rating: 4.7, reviews: 312, description: "Professional coloring", includes: ["Consult", "Apply", "Wash"], image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=300&fit=crop" },
    // Men: Grooming
    { id: "grooming_combo_m1", name: "Grooming Package", category: "grooming", gender: "men", price: 1499, originalPrice: 2199, duration: "90m", rating: 4.8, reviews: 678, description: "Complete grooming", includes: ["Haircut", "Beard", "Cleanup"], image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=300&fit=crop" },
    // Men: Facial
    { id: "facial_men_m1", name: "Men’s Facial", category: "facial-m", gender: "men", price: 999, originalPrice: 1299, duration: "60m", rating: 4.7, reviews: 190, description: "Relaxing facial", includes: ["Cleanse", "Scrub", "Mask"], image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=400&h=300&fit=crop" },
    // Men: Massage
    { id: "massage_relax_m1", name: "Relaxing Massage", category: "massage-m", gender: "men", price: 1199, originalPrice: 1499, duration: "60m", rating: 4.8, reviews: 145, description: "Full body massage", includes: ["Oil", "Massage"], image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop" },
  ];
  const servOps = servicesToEnsure.map(s => ({
    updateOne: {
      filter: { id: s.id },
      update: { $setOnInsert: s },
      upsert: true,
    }
  }));

  if (servOps.length > 0) {
    await Service.bulkWrite(servOps);
  }
}
