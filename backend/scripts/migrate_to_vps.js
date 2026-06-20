import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Setup environment and paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || path.resolve(__dirname, '../../storage');
const LOCAL_IMAGES_DIR = path.resolve(__dirname, '../images');

async function migrateImages() {
  try {
    console.log('Starting Migration from Local Downloaded Images to VPS Storage Structure...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Read metadata files
    const metadataPath = path.join(LOCAL_IMAGES_DIR, 'metadata.json');
    const videosMetadataPath = path.join(LOCAL_IMAGES_DIR, 'metadata_videos.json');
    const alternateMetadataPath = path.join(LOCAL_IMAGES_DIR, 'cloudinary_metadata.json');
    
    let allResources = [];
    try {
      const imgData = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      allResources = allResources.concat(imgData);
    } catch (e) {
      console.log('No metadata.json found, skipping.');
    }

    try {
      const altData = JSON.parse(await fs.readFile(alternateMetadataPath, 'utf8'));
      allResources = allResources.concat(altData);
      console.log('Successfully read cloudinary_metadata.json');
    } catch (e) {
      console.log('No cloudinary_metadata.json found, skipping.');
    }

    try {
      const vidData = JSON.parse(await fs.readFile(videosMetadataPath, 'utf8'));
      allResources = allResources.concat(vidData);
    } catch (e) {
      console.log('No metadata_videos.json found or failed to parse.');
    }

    if (allResources.length === 0) {
      console.log('No resources found to migrate.');
      process.exit(0);
    }

    console.log(`Loaded ${allResources.length} resources from metadata.`);

    // 2. Setup mappings and move files
    const urlMapping = {};

    for (const resource of allResources) {
      const oldUrl = resource.secure_url;
      if (!oldUrl) continue;

      let filename = '';
      let sourceFilePath = '';
      const ext = path.extname(new URL(oldUrl).pathname) || '.jpg';

      if (resource.localPath) {
        filename = path.basename(resource.localPath);
        sourceFilePath = path.join(LOCAL_IMAGES_DIR, filename);
      } else {
        filename = path.basename(resource.public_id) + ext;
        const possiblePaths = [
          path.join(LOCAL_IMAGES_DIR, resource.public_id + ext),
          path.join(LOCAL_IMAGES_DIR, resource.public_id.replace(/\//g, '_') + ext),
          path.join(LOCAL_IMAGES_DIR, filename)
        ];
        for (const p of possiblePaths) {
          try {
            await fs.access(p);
            sourceFilePath = p;
            break;
          } catch (e) {}
        }
      }

      if (!sourceFilePath) {
        console.warn(`Could not find local file for ${resource.public_id}`);
        continue;
      }
      
      
      // Determine category (from public_id or default)
      const parts = resource.public_id.split('/');
      let category = parts.length > 1 ? parts[0] : 'misc';
      
      // Target directory (YYYY/MM)
      const now = new Date(resource.created_at || Date.now());
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      const targetDir = path.join(STORAGE_BASE_PATH, category, year, month);
      await fs.mkdir(targetDir, { recursive: true });
      
      const targetFilePath = path.join(targetDir, filename);

      try {
        await fs.access(sourceFilePath);
        await fs.copyFile(sourceFilePath, targetFilePath);
        // Optional: await fs.unlink(sourceFilePath); // Delete original to save space
        
        const newUrl = `https://api.domain.com/images/${category}/${year}/${month}/${filename}`;
        urlMapping[oldUrl] = newUrl;
        console.log(`Migrated: ${oldUrl} -> ${newUrl}`);
      } catch (err) {
        console.warn(`Source file not found or could not be moved: ${sourceFilePath}`);
      }
    }

    console.log(`Successfully mapped and copied ${Object.keys(urlMapping).length} files.`);

    // 3. Update MongoDB
    console.log('Updating MongoDB collections...');
    
    const collections = await mongoose.connection.db.collections();
    
    for (const collection of collections) {
      const cursor = collection.find({});
      let updatedCount = 0;
      
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        let modified = false;
        
        // Convert to string to easily search for Cloudinary URLs
        let docStr = JSON.stringify(doc);
        
        for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
          if (docStr.includes(oldUrl)) {
            // Replace globally
            docStr = docStr.split(oldUrl).join(newUrl);
            modified = true;
          }
        }
        
        if (modified) {
          const updatedDoc = JSON.parse(docStr);
          // Preserve _id correctly
          updatedDoc._id = doc._id;
          await collection.updateOne({ _id: doc._id }, { $set: updatedDoc });
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        console.log(`Updated ${updatedCount} documents in collection: ${collection.collectionName}`);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateImages();
