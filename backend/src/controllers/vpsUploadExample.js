import { processAndSaveImage } from '../utils/imageProcessor.js';
import { deleteImage } from '../utils/imageDeleter.js';
import { IMAGE_CATEGORIES } from '../config/storage.js';

/**
 * Example controller showing how to handle image uploads to VPS
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    // 1. Ensure file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // 2. Process and save the image
    // Pass the buffer from multer memory storage
    // Resize to 500x500 for profile photos and compress
    const imageUrl = await processAndSaveImage(
      req.file.buffer, 
      IMAGE_CATEGORIES.USER_AVATAR, 
      { width: 500, height: 500, quality: 80 }
    );

    // 3. (Optional) Delete old image if user already has one
    // if (req.user.profilePhoto) {
    //   await deleteImage(req.user.profilePhoto);
    // }

    // 4. Update Database
    // await User.findByIdAndUpdate(req.user._id, { profilePhoto: imageUrl });

    // 5. Return success
    // Full URL to return to client (or you can just return the relative path)
    const fullUrl = `https://api.domain.com${imageUrl}`;

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully to VPS',
      imageUrl: fullUrl
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
};
