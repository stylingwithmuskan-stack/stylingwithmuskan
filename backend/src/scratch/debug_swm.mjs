import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Connect specifically to swm database
const swmUri = MONGO_URI.replace("/?appName=", "/swm?appName=");
console.log("Connecting to swm DB:", swmUri?.replace(/:[^:@]+@/, ':***@'));
await mongoose.connect(swmUri);

const db = mongoose.connection.db;
console.log("Connected to DB:", db.databaseName);

// 1. Check providers
console.log("\n=== PROVIDER ACCOUNTS ===");
const providers = await db.collection("provideraccounts").find({}).toArray();
console.log(`Total: ${providers.length}`);
for (const p of providers) {
  console.log(`\nProvider: ${p.name || "unnamed"} (${p._id})`);
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
}

// 2. Check service types
console.log("\n=== SERVICE TYPES ===");
const serviceTypes = await db.collection("servicetypes").find({}).toArray();
serviceTypes.forEach(st => console.log(`  id: ${st.id}, label: "${st.label}", _id: ${st._id}`));

// 3. Check categories
console.log("\n=== CATEGORIES ===");
const categories = await db.collection("categories").find({}).toArray();
categories.forEach(cat => console.log(`  id: ${cat.id}, name: "${cat.name}", _id: ${cat._id}`));

// 4. Check zones
console.log("\n=== ZONES ===");
const zones = await db.collection("zones").find({}).toArray();
zones.forEach(z => console.log(`  ${JSON.stringify(z)}`));

// 5. Check cities
console.log("\n=== CITIES ===");
const cities = await db.collection("cities").find({}).toArray();
cities.forEach(c => console.log(`  ${JSON.stringify(c)}`));

// 6. Check OfficeSettings
console.log("\n=== OFFICE SETTINGS ===");
const officeSettings = await db.collection("officesettings").findOne({});
console.log(JSON.stringify(officeSettings, null, 2));

// 7. Check ProviderDayAvailability
console.log("\n=== PROVIDER DAY AVAILABILITY (for 2026-04-19) ===");
const dayAvail = await db.collection("providerdayavailabilities").find({ date: "2026-04-19" }).toArray();
console.log(`Records for 2026-04-19: ${dayAvail.length}`);
dayAvail.forEach(d => console.log(`  provider: ${d.providerId}, slots count: ${(d.availableSlots || []).length}, slots: ${JSON.stringify((d.availableSlots || []).slice(0,5))}...`));

// Also check any availability docs
const allAvail = await db.collection("providerdayavailabilities").find({}).limit(3).toArray();
console.log(`\nTotal availability docs: ${await db.collection("providerdayavailabilities").countDocuments()}`);
allAvail.forEach(d => console.log(`  provider: ${d.providerId}, date: ${d.date}, slotsCount: ${(d.availableSlots || []).length}`));

// 8. Bookings
console.log("\n=== BOOKINGS ===");
const bookings = await db.collection("bookings").find({}).toArray();
bookings.forEach(b => console.log(`  id: ${b._id}, provider: ${b.assignedProvider}, status: ${b.status}, slotDate: ${b.slot?.date}, slotTime: ${b.slot?.time}`));

await mongoose.disconnect();
console.log("\nDone.");
