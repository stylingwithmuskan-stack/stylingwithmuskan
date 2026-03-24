import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectMongo } from "../src/startup/mongo.js";
import User from "../src/models/User.js";
import ProviderAccount from "../src/models/ProviderAccount.js";
import ProviderDayAvailability from "../src/models/ProviderDayAvailability.js";
import Booking from "../src/models/Booking.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}

const SLOTS_8 = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

async function upsertUser({ phone, name, address }) {
  const update = {
    phone,
    name,
    isVerified: true,
    addresses: [address],
  };
  const u = await User.findOneAndUpdate({ phone }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  return u;
}

async function upsertProvider({ phone, name, city, rating, totalJobs, experience, lat, lng, specs }) {
  const update = {
    phone,
    name,
    city,
    rating,
    totalJobs,
    experience,
    approvalStatus: "approved",
    registrationComplete: true,
    isOnline: true,
    currentLocation: { lat, lng },
    documents: { specializations: specs },
  };
  const p = await ProviderAccount.findOneAndUpdate({ phone }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  return p;
}

async function run() {
  if (!process.env.MONGO_URI || process.env.MONGO_URI === "memory") {
    throw new Error("Set MONGO_URI in backend/.env to a real MongoDB (Atlas/local) before running this seed script");
  }

  await connectMongo();

  const indore = { city: "Indore", lat: 22.7196, lng: 75.8577 };
  const bhopal = { city: "Bhopal", lat: 23.2599, lng: 77.4126 };

  const user1Phone = "9990000001"; // has previous booked providers
  const user2Phone = "9990000002"; // first-time booking (no history)

  const user1 = await upsertUser({
    phone: user1Phone,
    name: "Demo User 1",
    address: {
      houseNo: "101",
      area: indore.city,
      landmark: "Vijay Nagar",
      type: "home",
      lat: indore.lat,
      lng: indore.lng,
    },
  });

  const user2 = await upsertUser({
    phone: user2Phone,
    name: "Demo User 2",
    address: {
      houseNo: "202",
      area: bhopal.city,
      landmark: "MP Nagar",
      type: "home",
      lat: bhopal.lat,
      lng: bhopal.lng,
    },
  });

  // Providers: 5 near each user location (within ~5km).
  const mkNear = (base, i) => ({
    lat: base.lat + (i - 2) * 0.008,
    lng: base.lng + (2 - i) * 0.008,
  });

  const indoreProviders = [];
  for (let i = 0; i < 5; i++) {
    const loc = mkNear(indore, i);
    indoreProviders.push(await upsertProvider({
      phone: `91000000${String(i + 1).padStart(2, "0")}`.slice(0, 10),
      name: `Indore Pro ${i + 1}`,
      city: indore.city,
      rating: 4.9 - i * 0.1,
      totalJobs: 1200 - i * 90,
      experience: `${6 + i}+ Years`,
      lat: loc.lat,
      lng: loc.lng,
      specs: i % 2 === 0 ? ["hair", "skin"] : ["skin", "makeup"],
    }));
  }

  const bhopalProviders = [];
  for (let i = 0; i < 5; i++) {
    const loc = mkNear(bhopal, i);
    bhopalProviders.push(await upsertProvider({
      phone: `92000000${String(i + 1).padStart(2, "0")}`.slice(0, 10),
      name: `Bhopal Pro ${i + 1}`,
      city: bhopal.city,
      rating: 4.8 - i * 0.1,
      totalJobs: 900 - i * 70,
      experience: `${5 + i}+ Years`,
      lat: loc.lat,
      lng: loc.lng,
      specs: i % 2 === 0 ? ["hair", "skin"] : ["skin", "makeup"],
    }));
  }

  const tomorrow = iso(addDays(new Date(), 1));
  const past = iso(addDays(new Date(), -10));

  // Cleanup previous demo bookings for these users/providers (best-effort).
  const userIds = [user1._id.toString(), user2._id.toString()];
  const providerIds = [...indoreProviders, ...bhopalProviders].map((p) => p._id.toString());
  await Booking.deleteMany({ customerId: { $in: userIds } });
  await Booking.deleteMany({ assignedProvider: { $in: providerIds }, "slot.date": { $in: [tomorrow, past] } });

  // Availability: set 8-slot schedule for tomorrow for all providers.
  for (const p of [...indoreProviders, ...bhopalProviders]) {
    await ProviderDayAvailability.findOneAndUpdate(
      { providerId: p._id.toString(), date: tomorrow },
      { providerId: p._id.toString(), date: tomorrow, availableSlots: SLOTS_8 },
      { upsert: true, new: true }
    );
  }

  // User1: create previous bookings (history) with first 2 Indore providers.
  const u1Id = user1._id.toString();
  for (let i = 0; i < 2; i++) {
    const prov = indoreProviders[i];
    await Booking.create({
      customerId: u1Id,
      customerName: user1.name || "Demo User 1",
      services: [{ name: "Haircut", price: 399, duration: "30m", category: "haircut-m", serviceType: "hair" }],
      totalAmount: 399,
      balanceAmount: 0,
      paymentStatus: "Paid",
      address: { houseNo: "101", area: indore.city, landmark: "Vijay Nagar" },
      slot: { date: past, time: "09:00 AM" },
      bookingType: "instant",
      status: "completed",
      assignedProvider: prov._id.toString(),
      otp: "1234",
      candidateProviders: [],
      rejectedProviders: [],
      assignmentIndex: 0,
      lastAssignedAt: new Date(),
      adminEscalated: false,
    });
  }

  // Block one slot tomorrow for Indore Pro 1 to verify slot filtering.
  await Booking.create({
    customerId: u1Id,
    customerName: user1.name || "Demo User 1",
    services: [{ name: "Cleanup", price: 499, duration: "45m", category: "cleanup", serviceType: "skin" }],
    totalAmount: 499,
    balanceAmount: 499,
    paymentStatus: "Pending",
    address: { houseNo: "101", area: indore.city, landmark: "Vijay Nagar" },
    slot: { date: tomorrow, time: "10:00 AM" },
    bookingType: "scheduled",
    status: "pending",
    assignedProvider: indoreProviders[0]._id.toString(),
    otp: "1234",
    candidateProviders: [],
    rejectedProviders: [],
    assignmentIndex: 0,
    lastAssignedAt: new Date(),
    adminEscalated: false,
  });

  console.log("\n[seed-booking-flow] DONE\n");
  console.log("Customer logins (OTP):");
  console.log(`- User 1 (has previous providers): phone=${user1Phone} otp=1234`);
  console.log(`- User 2 (first time booking):     phone=${user2Phone} otp=1234`);
  console.log("\nProvider logins (OTP): otp=123456");
  console.log("Indore providers:");
  for (const p of indoreProviders) console.log(`- ${p.name}: phone=${p.phone}`);
  console.log("Bhopal providers:");
  for (const p of bhopalProviders) console.log(`- ${p.name}: phone=${p.phone}`);
  console.log(`\nAvailability seeded for date=${tomorrow} with slots=${SLOTS_8.join(", ")}`);
  console.log("Blocked slot: Indore Pro 1 has 10:00 AM booked on that date.\n");
}

run()
  .catch((e) => {
    console.error("[seed-booking-flow] FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await mongoose.disconnect(); } catch {}
  });

