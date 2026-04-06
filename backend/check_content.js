import mongoose from "mongoose";
import { ServiceType, Category, Service } from "./src/models/Content.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  const types = await ServiceType.find().lean();
  const cats = await Category.find().lean();
  const services = await Service.find().lean();
  
  console.log("--- SERVICE TYPES ---");
  console.log(JSON.stringify(types, null, 2));
  console.log("\n--- CATEGORIES ---");
  console.log(JSON.stringify(cats, null, 2));
  console.log("\n--- SERVICES ---");
  console.log(services.length, "services found.");
  
  process.exit(0);
}

run();
