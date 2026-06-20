import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: 'dykqqkmqy',
  api_key: '351289775527126',
  api_secret: 'NjpWz7VLSK93nWvHiY5IfX6FPMk',
});

// Since the user wants to serve them from the codebase, we'll put them in frontend/public/assets/cloudinary
const targetFolder = path.resolve(__dirname, '../../frontend/public/assets/cloudinary');
if (!fs.existsSync(targetFolder)) {
  fs.mkdirSync(targetFolder, { recursive: true });
}

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    // Some Cloudinary URLs might be http instead of https, let's force https or handle it
    const secureUrl = url.replace('http://', 'https://');
    const file = fs.createWriteStream(dest);
    
    https.get(secureUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${secureUrl}: ${response.statusCode}`));
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
}

async function main() {
  console.log(`Target folder: ${targetFolder}`);
  let nextCursor = null;
  const allResources = [];
  let downloadedCount = 0;

  try {
    do {
      console.log('Fetching list of resources from Cloudinary...');
      const result = await cloudinary.api.resources({
        type: 'upload',
        max_results: 100,
        next_cursor: nextCursor,
        context: true,
        tags: true,
        metadata: true
      });

      console.log(`Found ${result.resources.length} resources in this batch.`);

      for (const resource of result.resources) {
        allResources.push(resource);
        const ext = path.extname(resource.secure_url) || '.jpg';
        // Replace slashes in public_id with underscores to avoid nested directories
        const filename = `${resource.public_id.replace(/\//g, '_')}${ext}`;
        const destPath = path.join(targetFolder, filename);
        
        console.log(`Downloading ${resource.public_id} (${resource.secure_url})...`);
        try {
          await downloadImage(resource.secure_url, destPath);
          resource.localPath = `/assets/cloudinary/${filename}`;
          downloadedCount++;
        } catch (err) {
          console.error(`Error downloading ${resource.public_id}:`, err);
        }
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);

    const metadataPath = path.join(targetFolder, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(allResources, null, 2));
    console.log(`\nFinished downloading ${downloadedCount} images!`);
    console.log(`Metadata saved to: ${metadataPath}`);
  } catch (err) {
    console.error('Error during processing:', err);
  }
}

main().catch(console.error);
