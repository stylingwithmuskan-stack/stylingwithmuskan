import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function lookup() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  console.log("Connected to DB.");

  const doc = await mongoose.connection.collection("services").findOne({ name: "Half leg" });
  console.log("Half leg doc:", JSON.stringify(doc, null, 2));

  const allWaxing = await mongoose.connection.collection("services").find({ name: /leg/i }).toArray();
  console.log("All matching 'leg':", JSON.stringify(allWaxing.map(d => ({ name: d.name, image: d.image })), null, 2));
  
  process.exit(0);
}

lookup().catch(console.error);
