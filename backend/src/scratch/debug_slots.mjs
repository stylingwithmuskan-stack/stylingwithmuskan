import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
console.log("Connecting to:", MONGO_URI?.substring(0, 40) + "...");

await mongoose.connect(MONGO_URI);
console.log("Connected!\n");

const db = mongoose.connection.db;

// 1. Check how many providers exist
const allProviders = await db.collection("provideraccounts").find({}).toArray();
console.log(`=== TOTAL PROVIDERS: ${allProviders.length} ===\n`);

for (const p of allProviders) {
  console.log(`Provider: ${p.name || "unnamed"} (${p._id})`);
  console.log(`  city: "${p.city}", cityId: "${p.cityId || ""}"`);
  console.log(`  zones: ${JSON.stringify(p.zones || [])}`);
  console.log(`  zoneIds: ${JSON.stringify(p.zoneIds || [])}`);
  console.log(`  baseZoneId: "${p.baseZoneId || ""}"`);
  console.log(`  serviceZoneIds: ${JSON.stringify(p.serviceZoneIds || [])}`);
  console.log(`  approvalStatus: "${p.approvalStatus}"`);
  console.log(`  registrationComplete: ${p.registrationComplete}`);
  console.log(`  isOnline: ${p.isOnline}`);
  console.log(`  specializations: ${JSON.stringify(p.documents?.specializations || [])}`);
  console.log(`  primaryCategory: ${JSON.stringify(p.documents?.primaryCategory || [])}`);
  console.log(`  services: ${JSON.stringify(p.documents?.services || [])}`);
  console.log();
}

// 2. Check what the query would match with the request params
const zoneId = "69e36895864104f43d6648bc";
const city = "indore";
const allowPending = true;
const pendingStatuses = ["pending", "pending_vendor", "pending_admin"];

const baseQ = {
  approvalStatus: { $in: ["approved", ...pendingStatuses] },
  registrationComplete: true,
  isOnline: true,
};

// Exact query from the route
const q = {
  ...baseQ,
  city: new RegExp(`^${city}$`, "i"),
  $or: [
    { serviceZoneIds: zoneId },
    { zoneIds: zoneId },
    { baseZoneId: zoneId },
  ],
};

console.log("=== QUERY (city + zoneId) ===");
console.log(JSON.stringify(q, (k,v) => v instanceof RegExp ? v.toString() : v, 2));
const matched = await db.collection("provideraccounts").find(q).toArray();
console.log(`Matched: ${matched.length}`);
matched.forEach(p => console.log(`  - ${p.name} (${p._id})`));

// 3. Try just baseQ
console.log("\n=== QUERY (just baseQ: approved + registrationComplete + isOnline) ===");
const baseMatched = await db.collection("provideraccounts").find(baseQ).toArray();
console.log(`Matched: ${baseMatched.length}`);
baseMatched.forEach(p => console.log(`  - ${p.name} (${p._id}), city=${p.city}, isOnline=${p.isOnline}`));

// 4. Try just city
console.log("\n=== QUERY (city only, no isOnline filter) ===");
const cityMatched = await db.collection("provideraccounts").find({
  city: new RegExp(`^${city}$`, "i"),
}).toArray();
console.log(`Matched: ${cityMatched.length}`);
cityMatched.forEach(p => console.log(`  - ${p.name} (${p._id}), approvalStatus=${p.approvalStatus}, regComplete=${p.registrationComplete}, isOnline=${p.isOnline}`));

// 5. Check service types and categories
console.log("\n=== SERVICE TYPES (checking id 1776512508549) ===");
const serviceTypes = await db.collection("servicetypes").find({}).toArray();
serviceTypes.forEach(st => console.log(`  id: ${st.id}, label: "${st.label}"`));

console.log("\n=== CATEGORIES (checking id 1776512702322) ===");
const categories = await db.collection("categories").find({}).toArray();
categories.forEach(cat => console.log(`  id: ${cat.id}, name: "${cat.name}"`));

// 6. Check ProviderDayAvailability for date 2026-04-19
console.log("\n=== PROVIDER DAY AVAILABILITY for 2026-04-19 ===");
const dayAvail = await db.collection("providerdayavailabilities").find({ date: "2026-04-19" }).toArray();
console.log(`Records found: ${dayAvail.length}`);
dayAvail.forEach(d => console.log(`  provider: ${d.providerId}, slots: ${(d.availableSlots || []).length}`));

// 7. Check leave requests
console.log("\n=== LEAVE REQUESTS ===");
const leaves = await db.collection("leaverequests").find({ status: "approved" }).toArray();
console.log(`Approved leaves: ${leaves.length}`);
leaves.forEach(l => console.log(`  provider: ${l.providerId}, start: ${l.startAt}, end: ${l.endAt}`));

// 8. Check BookingSettings
console.log("\n=== BOOKING SETTINGS ===");
const bookingSettings = await db.collection("bookingsettings").findOne({});
console.log(JSON.stringify(bookingSettings, null, 2));

// 9. Check OfficeSettings
console.log("\n=== OFFICE SETTINGS ===");
const officeSettings = await db.collection("officesettings").findOne({});
console.log(JSON.stringify(officeSettings, null, 2));

// 10. Check bookings for the date
console.log("\n=== BOOKINGS for 2026-04-19 ===");
const bookings = await db.collection("bookings").find({ "slot.date": "2026-04-19" }).toArray();
console.log(`Bookings found: ${bookings.length}`);
bookings.forEach(b => console.log(`  id: ${b._id}, provider: ${b.assignedProvider}, status: ${b.status}, slot: ${b.slot?.time}`));

await mongoose.disconnect();
console.log("\nDone.");
