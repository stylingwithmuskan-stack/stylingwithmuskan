import { v2 as cloudinary } from "cloudinary";

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function uploadBuffer(buffer, folder, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, ...options }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

export async function uploadBase64Image(base64Str, folder = "swm-app") {
  if (!base64Str || !base64Str.startsWith("data:image")) return base64Str;
  try {
    const base64Data = base64Str.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    const result = await uploadBuffer(buffer, folder);
    return result.secure_url;
  } catch (error) {
    console.error("Failed to upload base64 image to Cloudinary:", error);
    return base64Str; // fallback to original if it fails
  }
}
