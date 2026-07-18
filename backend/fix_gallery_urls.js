/**
 * fix_gallery_urls.js
 * Fixes GalleryItems that have Cloudinary URLs → maps them to local /images/ files
 * Run: node fix_gallery_urls.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const IMAGES_DIR = path.join(__dirname, "images");

async function fixGalleryUrls() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  console.log("Connected to DB.");

  const coll = mongoose.connection.collection("galleryitems");
  const docs = await coll.find({}).toArray();

  console.log(`Found ${docs.length} gallery items.`);

  // Get all local gallery files
  const localGalleryFiles = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.startsWith("gallery_"))
    .map(f => ({ filename: f, path: `/images/${f}` }));

  console.log(`Found ${localGalleryFiles.length} local gallery files:`, localGalleryFiles.map(f => f.filename));

  for (const doc of docs) {
    const img = doc.image || "";
    console.log(`\nDoc: ${doc.id} | Title: ${doc.title} | Image: ${img}`);

    // If it's a Cloudinary URL, try to find matching local file
    if (img.includes("cloudinary.com")) {
      // Extract filename from cloudinary URL (last part)
      const urlFilename = img.split("/").pop(); // e.g., "nm14y1vl1hegcmv2rcuq.jpg"
      const baseFilename = urlFilename.split(".")[0]; // e.g., "nm14y1vl1hegcmv2rcuq"

      // Check if local file exists with this name
      const localMatch = localGalleryFiles.find(f => f.filename.includes(baseFilename));
      
      if (localMatch) {
        console.log(`  ✅ Found local match: ${localMatch.path}`);
        await coll.updateOne({ _id: doc._id }, { $set: { image: localMatch.path } });
        console.log(`  Updated!`);
      } else {
        // Try to find any gallery file with size match or just use first available
        console.log(`  ⚠️  No local match for ${urlFilename}`);
        console.log(`  Available local files: ${localGalleryFiles.map(f=>f.filename).join(', ')}`);
      }
    } else if (!img || img === "") {
      // No image at all
      if (localGalleryFiles.length > 0) {
        const suggested = localGalleryFiles[0].path;
        console.log(`  ℹ️  No image set. You may want to assign: ${suggested}`);
      }
    } else {
      console.log(`  ✓ Already a local path: ${img}`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone!");
  process.exit(0);
}

fixGalleryUrls().catch(e => { console.error(e); process.exit(1); });
