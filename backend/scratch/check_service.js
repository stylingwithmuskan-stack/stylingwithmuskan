import mongoose from "mongoose";
import { Service } from "../src/models/Content.js";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  const service = await Service.findOne({ id: "1775216895275" }).lean();
  console.log("--- SERVICE 1775216895275 ---");
  console.log(JSON.stringify(service, null, 2));
  process.exit(0);
}

run();
