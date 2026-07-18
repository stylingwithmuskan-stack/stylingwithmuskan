import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function lookupDoc() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  console.log("Connected to DB.");

  const doc = await mongoose.connection.collection("services").findOne({ _id: new mongoose.Types.ObjectId("69d3593939906ab7bd6d20ae") });
  console.log("Document 69d3593939906ab7bd6d20ae:", JSON.stringify(doc, null, 2));
  
  process.exit(0);
}

lookupDoc().catch(console.error);
