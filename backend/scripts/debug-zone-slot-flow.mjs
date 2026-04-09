import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { default: ProviderAccount } = await import("../src/models/ProviderAccount.js");
const { default: ProviderDayAvailability } = await import("../src/models/ProviderDayAvailability.js");
const { City, Zone } = await import("../src/models/CityZone.js");

const cityNameArg = String(process.argv[2] || "ujjain").trim();

try {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB,
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });

  const city = await City.findOne({ name: new RegExp(`^${cityNameArg}$`, "i") }).lean();
  const zones = await Zone.find(city?._id ? { city: city._id } : { name: /hub/i }).lean();
  const providers = await ProviderAccount.find(
    city?._id
      ? { $or: [{ cityId: String(city._id) }, { city: new RegExp(`^${cityNameArg}$`, "i") }] }
      : { city: new RegExp(`^${cityNameArg}$`, "i") }
  ).lean();

  console.log("=== CITY ===");
  console.log(JSON.stringify(city, null, 2));

  console.log("=== ZONES ===");
  console.log(JSON.stringify(zones.map((zone) => ({
    id: zone._id,
    name: zone.name,
    city: zone.city,
    status: zone.status,
    coordinatesCount: Array.isArray(zone.coordinates) ? zone.coordinates.length : 0,
    coordinates: zone.coordinates,
  })), null, 2));

  console.log("=== PROVIDERS ===");
  console.log(JSON.stringify(providers.map((provider) => ({
    id: provider._id,
    name: provider.name,
    phone: provider.phone,
    approvalStatus: provider.approvalStatus,
    registrationComplete: provider.registrationComplete,
    isOnline: provider.isOnline,
    city: provider.city,
    cityId: provider.cityId,
    zones: provider.zones,
    zoneIds: provider.zoneIds,
    baseZoneId: provider.baseZoneId,
    serviceZoneIds: provider.serviceZoneIds,
    pendingZones: provider.pendingZones,
    currentLocation: provider.currentLocation,
    primaryCategory: provider.documents?.primaryCategory,
    specializations: provider.documents?.specializations,
    services: provider.documents?.services,
    createdAt: provider.createdAt,
  })), null, 2));

  if (providers.length > 0) {
    const providerIds = providers.map((provider) => String(provider._id));
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return date.toISOString().slice(0, 10);
    });

    const availabilities = await ProviderDayAvailability.find({
      providerId: { $in: providerIds },
      date: { $in: dates },
    }).lean();

    console.log("=== AVAILABILITY ===");
    console.log(JSON.stringify(availabilities.map((item) => ({
      providerId: item.providerId,
      date: item.date,
      availableSlotsCount: Array.isArray(item.availableSlots) ? item.availableSlots.length : 0,
      sampleSlots: Array.isArray(item.availableSlots) ? item.availableSlots.slice(0, 6) : [],
    })), null, 2));
  }
} catch (error) {
  console.error("[debug-zone-slot-flow] Failed:", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}
