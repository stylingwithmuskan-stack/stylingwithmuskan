import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function checkPedicure() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  console.log("Connected to DB.");

  const service = await mongoose.connection.collection("services").findOne({ name: /pedicure/i });
  console.log("Pedicure Service Document:", JSON.stringify(service, null, 2));
  process.exit(0);
}

checkPedicure().catch(console.error);
