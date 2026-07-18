import { v2 as cloudinary } from "cloudinary";
import https from "https";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const oldUrl = "https://res.cloudinary.com/dykqqkmqy/image/upload/v1782468859/services/xktm3az62tgzeqkm0ql3.jpg";

const getSignedUrl = (url) => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  if (match && match[1]) {
    const publicId = match[1];
    const isVideo = url.includes("/video/upload/");
    return cloudinary.url(publicId, {
      resource_type: isVideo ? "video" : "image",
      sign_url: true,
      secure: true
    });
  }
  return url;
};

const signed = getSignedUrl(oldUrl);
console.log("Signed URL:", signed);

https.get(signed, (res) => {
  console.log("Status Code:", res.statusCode);
  console.log("Headers:", res.headers);
  process.exit(0);
}).on("error", (err) => {
  console.error("Error:", err);
  process.exit(1);
});
