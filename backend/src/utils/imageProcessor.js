import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { STORAGE_BASE_PATH } from '../config/storage.js';

/**
 * Process and save an uploaded image buffer.
 * @param {Buffer} buffer - The image buffer from multer
 * @param {string} category - Category folder (e.g., 'user-avatar', 'bookings')
 * @param {Object} options - Resize options { width, height, quality }
 * @returns {Promise<string>} - The relative URL path of the saved image
 */
export const processAndSaveImage = async (buffer, category, options = {}) => {
  try {
    const { width, height, quality = 80 } = options;

    // Create year/month subdirectories
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // UUID for unique filename
    const filename = `${uuidv4()}.webp`;

    // Target directory: STORAGE_BASE_PATH/category/YYYY/MM/
    const targetDir = path.join(STORAGE_BASE_PATH, category, year, month);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filepath = path.join(targetDir, filename);

    // Initialize sharp pipeline
    let pipeline = sharp(buffer);

    // Resize if width/height are provided
    if (width || height) {
      pipeline = pipeline.resize({
        width: width || null,
        height: height || null,
        fit: sharp.fit.inside,
        withoutEnlargement: true
      });
    }

    // Convert to webp and save
    await pipeline
      .webp({ quality })
      .toFile(filepath);

    // Return the URL path
    return `/images/${category}/${year}/${month}/${filename}`;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process and save image');
  }
};
