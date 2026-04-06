import mongoose from "mongoose";
import { ServiceType } from "./src/models/Content.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  const types = await ServiceType.find().lean();
  console.log(`Service Types in DB (${MONGO_DB}):`, JSON.stringify(types, null, 2));
  process.exit(0);
}

run();
