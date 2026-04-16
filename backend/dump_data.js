import mongoose from "mongoose";
import { ServiceType, Category } from "./src/models/Content.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  console.log("--- All Service Types ---");
  const types = await ServiceType.find().lean();
  console.log(types);
  
  console.log("\n--- All Categories ---");
  const cats = await Category.find().lean();
  console.log(cats);

  process.exit(0);
}

run();
