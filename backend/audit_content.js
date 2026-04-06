import mongoose from "mongoose";
import { ServiceType, Category, Service } from "./src/models/Content.js";
import { City, Zone } from "./src/models/CityZone.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  const types = await ServiceType.find().lean();
  const cats = await Category.find().lean();
  const cities = await City.find({ status: "active" }).lean();
  const zones = await Zone.find({ status: "active" }).lean();

  console.log("=== CONTENT AUDIT ===");
  console.log("Service Types count:", types.length);
  types.forEach(t => console.log(`- Type: ${t.label} (ID: ${t.id}), Zones: ${JSON.stringify(t.zones)}`));
  
  console.log("\nCategories count:", cats.length);
  cats.forEach(c => console.log(`- Cat: ${c.name} (ID: ${c.id}), Type: ${c.serviceType}, Gender: ${c.gender}, Zones: ${JSON.stringify(c.zones)}`));
  
  console.log("\nCities count:", cities.length);
  cities.forEach(city => console.log(`- City: ${city.name}`));

  console.log("\nZones count:", zones.length);
  zones.forEach(zone => console.log(`- Zone: ${zone.name}`));

  process.exit(0);
}

run();
