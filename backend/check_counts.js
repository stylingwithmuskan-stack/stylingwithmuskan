import mongoose from "mongoose";
import { ServiceType, Category, Service } from "./src/models/Content.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  const typeCount = await ServiceType.countDocuments();
  const catCount = await Category.countDocuments();
  const servCount = await Service.countDocuments();
  
  console.log(`Counts - ServiceTypes: ${typeCount}, Categories: ${catCount}, Services: ${servCount}`);
  
  const allTypes = await ServiceType.find().lean();
  console.log("\nService Types:");
  allTypes.forEach(t => console.log(`- ${t.label} (${t.id})`));
  
  const allCats = await Category.find().lean();
  console.log("\nCategories:");
  allCats.forEach(c => console.log(`- ${c.name} (ID: ${c.id}, ServiceTypeRef: ${c.serviceType}, Gender: ${c.gender})`));

  process.exit(0);
}

run();
