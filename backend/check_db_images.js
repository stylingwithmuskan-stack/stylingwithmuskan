import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dns from "dns";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function checkDb() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  console.log("Connected to DB.");

  const collections = ["services", "categories", "spotlights", "provideraccounts"];
  for (const name of collections) {
    const coll = mongoose.connection.collection(name);
    const docs = await coll.find({}).toArray();
    console.log(`\n--- Collection: ${name} (${docs.length} docs) ---`);
    for (const doc of docs) {
      const imageFields = ["image", "icon", "video", "poster", "profilePhoto", "avatar"];
      for (const field of imageFields) {
        if (doc[field]) {
          const filepath = path.join(__dirname, doc[field]);
          const exists = fs.existsSync(filepath);
          console.log(`Doc ID: ${doc._id}, Field: ${field}, Value: ${doc[field]}, Local file exists: ${exists}`);
        }
      }
      if (doc.gallery && Array.isArray(doc.gallery)) {
        for (const img of doc.gallery) {
          const filepath = path.join(__dirname, img);
          const exists = fs.existsSync(filepath);
          console.log(`Doc ID: ${doc._id}, Gallery image: ${img}, Local file exists: ${exists}`);
        }
      }
    }
  }
  process.exit(0);
}

checkDb().catch(console.error);
