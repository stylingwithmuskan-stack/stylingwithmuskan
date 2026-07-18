import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import https from "https";
import dns from "dns";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

// Set DNS servers to resolve Mongo cluster correctly
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const localImagesDir = path.join(__dirname, "images");
if (!fs.existsSync(localImagesDir)) {
  fs.mkdirSync(localImagesDir, { recursive: true });
}

// Credentials mapping for dynamic Cloudinary signing
const credentials = {
  dr37io9cj: {
    cloud_name: "dr37io9cj",
    api_key: "332237926373493",
    api_secret: "QmkyDDYN2u78Ccp-G1QjQxeQV-s"
  },
  dykqqkmqy: {
    cloud_name: "dykqqkmqy",
    api_key: "351289775527126",
    api_secret: "NjpWz7VLSK93nWvHiY5IfX6FPMk"
  }
};

const downloadImage = (url, dest) => {
  return new Promise((resolve, reject) => {
    const secureUrl = url.replace('http://', 'https://');
    const file = fs.createWriteStream(dest);
    https.get(secureUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Status: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

async function migrateImages() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
    console.log("Connected to MongoDB for image migration.");

    // Helper to get local URL and download the file
    const getLocalUrlAndDownload = async (oldUrl) => {
      if (!oldUrl) return oldUrl;
      if (typeof oldUrl === 'string' && oldUrl.includes("res.cloudinary.com")) {
        const parts = oldUrl.split("/");
        const filename = parts[parts.length - 1];
        const dest = path.join(localImagesDir, filename);
        
        if (fs.existsSync(dest)) {
          return `/images/${filename}`;
        }

        // Extract cloud name from URL
        const cloudNameMatch = oldUrl.match(/res\.cloudinary\.com\/([^/]+)/);
        const cloudName = cloudNameMatch ? cloudNameMatch[1] : null;

        let downloadUrl = oldUrl;

        // If we have credentials for this cloud, sign the URL to bypass 401
        if (cloudName && credentials[cloudName]) {
          cloudinary.config({
            ...credentials[cloudName],
            secure: true
          });

          const match = oldUrl.match(/\/upload\/(?:v\d+\/)?(.+?)$/);
          if (match && match[1]) {
            let publicId = match[1];
            const extMatch = publicId.match(/(.+)\.[a-z0-9]+$/i);
            if (extMatch) {
              publicId = extMatch[1];
            }
            const isVideo = oldUrl.includes("/video/upload/");
            downloadUrl = cloudinary.url(publicId, {
              resource_type: isVideo ? "video" : "image",
              sign_url: true,
              secure: true
            });
          }
        }

        console.log(`Downloading ${downloadUrl} to ${dest}...`);
        try {
          await downloadImage(downloadUrl, dest);
          console.log(`Downloaded ${filename} successfully.`);
          return `/images/${filename}`;
        } catch (err) {
          console.error(`Failed to download ${oldUrl} (using signed URL: ${downloadUrl}):`, err.message);
          // Return original URL so we don't store a broken local path in DB
          return oldUrl;
        }
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
          if (doc[field] && typeof doc[field] === 'string' && (doc[field].includes("res.cloudinary.com") || doc[field].startsWith("/images/"))) {
            const localUrl = await getLocalUrlAndDownload(doc[field]);
            // If the localUrl is different from current value, update it
            if (localUrl !== doc[field]) {
              updateDoc[field] = localUrl;
              needsUpdate = true;
            }
          }
        }

        // Handle arrays of images (e.g. gallery in services)
        if (doc.gallery && Array.isArray(doc.gallery)) {
          let galleryUpdated = false;
          const newGallery = [];
          for (const img of doc.gallery) {
            if (img && typeof img === 'string' && (img.includes("res.cloudinary.com") || img.startsWith("/images/"))) {
              const localUrl = await getLocalUrlAndDownload(img);
              if (localUrl !== img) {
                galleryUpdated = true;
                newGallery.push(localUrl);
              } else {
                newGallery.push(img);
              }
            } else {
              newGallery.push(img);
            }
          }
          
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
