import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the base path from environment or default to local storage
const defaultStoragePath = path.resolve(__dirname, '../../../../storage');
export const STORAGE_BASE_PATH = process.env.STORAGE_BASE_PATH || defaultStoragePath;

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const IMAGE_CATEGORIES = {
  USER_AVATAR: 'user-avatar',
  BOOKINGS: 'bookings',
  PROVIDERS: 'providers',
  SERVICES: 'services',
  REELS: 'reels',
  DOCS: 'docs',
  OFFERLY: 'offerly',
  LEARNZY: 'learnzy',
  SAMPLES: 'samples',
  DEFAULT: 'misc'
};

// Ensure base storage directory exists
if (!fs.existsSync(STORAGE_BASE_PATH)) {
  fs.mkdirSync(STORAGE_BASE_PATH, { recursive: true });
}
