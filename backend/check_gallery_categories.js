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

  const categories = await mongoose.connection.collection("categories").find({}).toArray();
  console.log("Categories:", JSON.stringify(categories.map(c => ({ name: c.name, image: c.image, icon: c.icon })), null, 2));

  const parentCategories = await mongoose.connection.collection("parentcategories").find({}).toArray();
  console.log("Parent Categories:", JSON.stringify(parentCategories.map(c => ({ name: c.name, image: c.image, icon: c.icon })), null, 2));

  const gallery = await mongoose.connection.collection("galleries").find({}).toArray();
  console.log("Gallery:", JSON.stringify(gallery, null, 2));

  process.exit(0);
}

lookup().catch(console.error);
