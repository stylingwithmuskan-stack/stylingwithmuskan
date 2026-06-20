import fs from 'fs/promises';
import path from 'path';
import { STORAGE_BASE_PATH } from '../config/storage.js';

/**
 * Deletes an image from the local storage.
 * @param {string} imageUrl - The relative URL path of the image (e.g., /images/user-avatar/2026/06/xxx.webp)
 */
export const deleteImage = async (imageUrl) => {
  if (!imageUrl) return;

  try {
    // We expect the imageUrl to be like /images/category/year/month/filename
    // So we strip the leading /images prefix
    const urlPath = new URL(imageUrl, 'http://localhost').pathname;
    
    // Split the path and discard the first segment if it matches '/images'
    const pathParts = urlPath.split('/').filter(Boolean);
    if (pathParts[0] === 'images') {
      pathParts.shift();
    }

    // Join the rest with the STORAGE_BASE_PATH
    const absolutePath = path.join(STORAGE_BASE_PATH, ...pathParts);

    // Check if file exists and delete
    try {
      await fs.access(absolutePath);
      await fs.unlink(absolutePath);
      console.log(`[Storage] Deleted image: ${absolutePath}`);
    } catch (err) {
      // Ignore if file doesn't exist
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  } catch (error) {
    console.error(`[Storage] Failed to delete image ${imageUrl}:`, error);
  }
};
