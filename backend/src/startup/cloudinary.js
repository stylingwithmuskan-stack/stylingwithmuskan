import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGES_DIR = path.resolve(__dirname, "../../images");

// Ensure local images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export function configureCloudinary() {
  console.log("[Storage] ✅ Local storage active. Uploads will be saved to backend/images.");
}

export function uploadBuffer(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      let ext = ".jpg";
      if (options.resource_type === "video") {
        ext = ".mp4";
      } else if (options.format) {
        ext = `.${options.format}`;
      }
      
      const prefix = folder ? folder.replace(/[^a-zA-Z0-9]/g, "_") + "_" : "";
      const filename = `${prefix}${crypto.randomBytes(8).toString("hex")}${ext}`;
      const destPath = path.join(IMAGES_DIR, filename);
      
      fs.writeFile(destPath, buffer, (err) => {
        if (err) {
          console.error("Local file write failed:", err);
          return reject(err);
        }
        resolve({
          secure_url: `/api/images/${filename}`
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

export async function uploadBase64Image(base64Str, folder = "swm-app") {
  if (!base64Str || !base64Str.startsWith("data:image")) return base64Str;
  try {
    const mimeMatch = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,/);
    let ext = ".jpg";
    if (mimeMatch && mimeMatch[1]) {
      ext = `.${mimeMatch[1]}`;
    }
    const base64Data = base64Str.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    
    const prefix = folder ? folder.replace(/[^a-zA-Z0-9]/g, "_") + "_" : "";
    const filename = `${prefix}${crypto.randomBytes(8).toString("hex")}${ext}`;
    const destPath = path.join(IMAGES_DIR, filename);
    
    await fs.promises.writeFile(destPath, buffer);
    return `/api/images/${filename}`;
  } catch (error) {
    console.error("Failed to upload base64 image locally:", error);
    return base64Str; // fallback to original if it fails
  }
}
