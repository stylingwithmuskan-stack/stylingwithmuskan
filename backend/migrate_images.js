import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for image migration.");

    // Helper to get local URL
    const getLocalUrl = (oldUrl) => {
      if (!oldUrl) return oldUrl;
      if (typeof oldUrl === 'string' && oldUrl.includes("res.cloudinary.com")) {
        const parts = oldUrl.split("/");
        const filename = parts[parts.length - 1];
        // Ensure you use your API base url here if needed, but relative or absolute path is fine.
        return `/images/${filename}`;
      }
      return oldUrl;
    };

    const collectionsToUpdate = [
      "services",
      "categories",
      "parentcategories",
      "spotlights",
      "galleries",
      "testimonials",
      "provideraccounts"
    ];

    for (const collectionName of collectionsToUpdate) {
      console.log(`Processing collection: ${collectionName}`);
      const collection = mongoose.connection.collection(collectionName);
      const docs = await collection.find({}).toArray();
      
      let updatedCount = 0;
      for (const doc of docs) {
        let needsUpdate = false;
        const updateDoc = {};

        // Check common image fields
        const imageFields = ["image", "icon", "video", "poster", "profilePhoto", "avatar"];
        for (const field of imageFields) {
          if (doc[field] && typeof doc[field] === 'string' && doc[field].includes("res.cloudinary.com")) {
            updateDoc[field] = getLocalUrl(doc[field]);
            needsUpdate = true;
          }
        }

        // Handle arrays of images (e.g. gallery in services)
        if (doc.gallery && Array.isArray(doc.gallery)) {
          let galleryUpdated = false;
          const newGallery = doc.gallery.map(img => {
            if (img && typeof img === 'string' && img.includes("res.cloudinary.com")) {
              galleryUpdated = true;
              return getLocalUrl(img);
            }
            return img;
          });
          
          if (galleryUpdated) {
            updateDoc.gallery = newGallery;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await collection.updateOne({ _id: doc._id }, { $set: updateDoc });
          updatedCount++;
        }
      }
      console.log(`Updated ${updatedCount} documents in ${collectionName}.`);
    }

    console.log("Image migration completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrateImages();
