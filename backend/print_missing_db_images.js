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
  let totalMissing = 0;

  for (const name of collections) {
    const coll = mongoose.connection.collection(name);
    const docs = await coll.find({}).toArray();
    for (const doc of docs) {
      const imageFields = ["image", "icon", "video", "poster", "profilePhoto", "avatar"];
      for (const field of imageFields) {
        if (doc[field]) {
          const val = doc[field];
          if (val.startsWith("/images/")) {
            const filename = val.replace("/images/", "");
            const filepath = path.join(__dirname, "images", filename);
            const exists = fs.existsSync(filepath);
            if (!exists) {
              console.log(`MISSING: Collection: ${name}, Doc ID: ${doc._id}, Field: ${field}, Value: ${val}`);
              totalMissing++;
            }
          }
        }
      }
      if (doc.gallery && Array.isArray(doc.gallery)) {
        for (const img of doc.gallery) {
          if (img.startsWith("/images/")) {
            const filename = img.replace("/images/", "");
            const filepath = path.join(__dirname, "images", filename);
            const exists = fs.existsSync(filepath);
            if (!exists) {
              console.log(`MISSING: Collection: ${name}, Doc ID: ${doc._id}, Gallery image: ${img}`);
              totalMissing++;
            }
          }
        }
      }
    }
  }
  console.log(`Total missing files referenced in DB: ${totalMissing}`);
  process.exit(0);
}

checkDb().catch(console.error);
