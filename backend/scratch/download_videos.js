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

const targetFolder = path.resolve(__dirname, '../images'); // Target folder is backend/images
if (!fs.existsSync(targetFolder)) {
  fs.mkdirSync(targetFolder, { recursive: true });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
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
  let nextCursor = null;
  const allVideos = [];
  let downloadedCount = 0;

  try {
    do {
      const result = await cloudinary.api.resources({
        resource_type: 'video',
        max_results: 100,
        next_cursor: nextCursor,
        context: true,
        tags: true,
        metadata: true
      });

      for (const resource of result.resources) {
        allVideos.push(resource);
        const ext = path.extname(resource.secure_url) || '.mp4';
        const filename = `${resource.public_id.replace(/\//g, '_')}${ext}`;
        const destPath = path.join(targetFolder, filename);
        
        console.log(`Downloading video ${resource.public_id}...`);
        try {
          await downloadFile(resource.secure_url, destPath);
          resource.localPath = `/images/${filename}`;
          downloadedCount++;
        } catch (err) {
          console.error(`Error downloading ${resource.public_id}:`, err);
        }
      }
      nextCursor = result.next_cursor;
    } while (nextCursor);

    const metadataPath = path.join(targetFolder, 'metadata_videos.json');
    fs.writeFileSync(metadataPath, JSON.stringify(allVideos, null, 2));
    console.log(`Finished downloading ${downloadedCount} videos!`);
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(console.error);
