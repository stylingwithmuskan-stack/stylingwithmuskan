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

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  const galleryItems = await mongoose.connection.collection("galleryitems").find({}).toArray();
  console.log("galleryitems:", JSON.stringify(galleryItems, null, 2));

  process.exit(0);
}

lookup().catch(console.error);
