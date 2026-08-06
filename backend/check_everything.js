import mongoose from "mongoose";
import { ServiceType, Category } from "./src/models/Content.js";
import { City } from "./src/models/CityZone.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  const types = await ServiceType.find().lean();
  console.log("--- SERVICE TYPES ---");
  types.forEach(t => console.log(`ID: ${t.id}, Label: ${t.label}, Zones: ${JSON.stringify(t.zones)}`));
  
  const categories = await Category.find().lean();
  console.log("\n--- CATEGORIES ---");
  categories.forEach(c => console.log(`ID: ${c.id}, Name: ${c.name}, ServiceType: ${c.serviceType}, Gender: ${c.gender}, Zones: ${JSON.stringify(c.zones)}`));
  
  const cities = await City.find().lean();
  console.log("\n--- CITIES ---");
  cities.forEach(city => console.log(`Name: ${city.name}, ActiveVendor: ${city.activeVendorId}`));

  process.exit(0);
}

run();
