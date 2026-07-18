import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localImagesDir = path.join(__dirname, "images");

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

async function main() {
  console.log("Starting missing images download from metadata...");

  const metadataFiles = ["metadata.json", "metadata_videos.json"];
  let allResources = [];

  for (const file of metadataFiles) {
    const filePath = path.join(localImagesDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        allResources = allResources.concat(data);
        console.log(`Loaded metadata from ${file}`);
      } catch (err) {
        console.error(`Failed to parse ${file}:`, err.message);
      }
    }
  }

  console.log(`Total resources to check: ${allResources.length}`);
  let downloadedCount = 0;

  for (const resource of allResources) {
    const oldUrl = resource.secure_url;
    if (!oldUrl) continue;

    const parts = oldUrl.split("/");
    const filename = parts[parts.length - 1];
    const dest = path.join(localImagesDir, filename);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      continue; // already exists and has content
    }

    // Extract cloud name
    const cloudNameMatch = oldUrl.match(/res\.cloudinary\.com\/([^/]+)/);
    const cloudName = cloudNameMatch ? cloudNameMatch[1] : null;

    let downloadUrl = oldUrl;

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

    console.log(`Downloading missing file: ${filename} from ${downloadUrl}...`);
    try {
      await downloadImage(downloadUrl, dest);
      console.log(`Downloaded ${filename} successfully.`);
      downloadedCount++;
    } catch (err) {
      console.error(`Failed to download ${filename}:`, err.message);
    }
  }

  console.log(`Successfully downloaded ${downloadedCount} missing files.`);
  process.exit(0);
}

main().catch(console.error);
