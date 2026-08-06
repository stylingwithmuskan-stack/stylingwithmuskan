import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import https from "https";
import dns from "dns";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

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

// Try downloading a missing image using all possible Cloudinary configurations
async function tryDownloadFromCloudinary(filename, collectionName) {
  const extMatch = filename.match(/(.+)\.([a-z0-9]+)$/i);
  if (!extMatch) return false;

  const publicIdRaw = extMatch[1];
  const dest = path.join(localImagesDir, filename);

  // We will try several potential paths in Cloudinary
  // 1. collectionName/publicIdRaw (e.g. services/filename)
  // 2. publicIdRaw (no folder)
  // 3. folders like 'providers', 'categories', etc.
  const possiblePaths = [
    `${collectionName}/${publicIdRaw}`,
    publicIdRaw,
    `providers/${publicIdRaw}`,
    `categories/${publicIdRaw}`,
    `parentcategories/${publicIdRaw}`
  ];

  // Try both credentials
  const cloudNames = ["dykqqkmqy", "dr37io9cj"];

  for (const cloudName of cloudNames) {
    const creds = credentials[cloudName];
    cloudinary.config({
      ...creds,
      secure: true
    });

    for (const cloudinaryPath of possiblePaths) {
      const isVideo = filename.endsWith(".mp4");
      const signedUrl = cloudinary.url(cloudinaryPath, {
        resource_type: isVideo ? "video" : "image",
        sign_url: true,
        secure: true
      });

      try {
        console.log(`Trying download for ${filename} from ${cloudName} (${cloudinaryPath})...`);
        await downloadImage(signedUrl, dest);
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          console.log(`-> SUCCESS! Downloaded ${filename}`);
          return true;
        }
      } catch (err) {
        // Silently continue to next combination
      }
    }
  }

  return false;
}

// Convert base64 data to local file and return the path
function saveBase64Image(base64Str) {
  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z-+0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }

    const ext = matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');
    const hash = crypto.createHash('md5').update(dataBuffer).digest('hex');
    const filename = `base64_${hash}.${ext}`;
    const dest = path.join(localImagesDir, filename);

    fs.writeFileSync(dest, dataBuffer);
    console.log(`Saved base64 image as ${filename}`);
    return `/images/${filename}`;
  } catch (err) {
    console.error("Failed to save base64 image:", err.message);
    return null;
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
    console.log("Connected to MongoDB for recovery.");

    const collections = [
      "services",
      "categories",
      "parentcategories",
      "spotlights",
      "galleries",
      "testimonials",
      "provideraccounts"
    ];

    for (const colName of collections) {
      console.log(`Scanning collection: ${colName}`);
      const collection = mongoose.connection.collection(colName);
      const docs = await collection.find({}).toArray();

      for (const doc of docs) {
        let needsUpdate = false;
        const updateDoc = {};

        // 1. Process standard fields
        const imageFields = ["image", "icon", "video", "poster", "profilePhoto", "avatar"];
        for (const field of imageFields) {
          if (doc[field] && typeof doc[field] === 'string') {
            const val = doc[field];

            // Handle base64 image
            if (val.startsWith("data:image/")) {
              const localUrl = saveBase64Image(val);
              if (localUrl) {
                updateDoc[field] = localUrl;
                needsUpdate = true;
              }
            }
            // Handle missing local image references
            else if (val.startsWith("/images/") || val.startsWith("/api/images/")) {
              const filename = val.startsWith("/api/images/") ? val.replace("/api/images/", "") : val.replace("/images/", "");
              const dest = path.join(localImagesDir, filename);
              const exists = fs.existsSync(dest) && fs.statSync(dest).size > 0;

              if (!exists) {
                console.log(`Missing file detected in DB reference: ${val}`);
                const success = await tryDownloadFromCloudinary(filename, colName);
                if (!success) {
                  console.error(`!!! Could not recover file ${filename} from Cloudinary`);
                }
              }
            }
          }
        }

        // 2. Process arrays (gallery)
        if (doc.gallery && Array.isArray(doc.gallery)) {
          const newGallery = [];
          let galleryUpdated = false;

          for (const img of doc.gallery) {
            if (img && typeof img === 'string') {
              if (img.startsWith("data:image/")) {
                const localUrl = saveBase64Image(img);
                if (localUrl) {
                  newGallery.push(localUrl);
                  galleryUpdated = true;
                } else {
                  newGallery.push(img);
                }
              } else if (img.startsWith("/images/") || img.startsWith("/api/images/")) {
                newGallery.push(img);
                const filename = img.startsWith("/api/images/") ? img.replace("/api/images/", "") : img.replace("/images/", "");
                const dest = path.join(localImagesDir, filename);
                const exists = fs.existsSync(dest) && fs.statSync(dest).size > 0;

                if (!exists) {
                  console.log(`Missing gallery file detected: ${img}`);
                  const success = await tryDownloadFromCloudinary(filename, colName);
                  if (!success) {
                    console.error(`!!! Could not recover gallery file ${filename} from Cloudinary`);
                  }
                }
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
          console.log(`Updated document ${doc._id} in ${colName}`);
        }
      }
    }

    console.log("Image recovery and base64 optimization completed.");
    process.exit(0);
  } catch (err) {
    console.error("Recovery script failed:", err);
    process.exit(1);
  }
}

main();
