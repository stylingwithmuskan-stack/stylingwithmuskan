/**
 * Safe localStorage wrapper with in-memory fallback
 * Prevents crashes in restricted WebView environments (iOS in-app browsers)
 */

// In-memory fallback storage
const memoryStorage = new Map();

// Check if localStorage is available and working
function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// Cache the availability check result
let storageAvailable = null;

function checkStorage() {
  if (storageAvailable === null) {
    storageAvailable = isStorageAvailable();
    if (!storageAvailable) {
      console.warn('[SafeStorage] localStorage not available, using in-memory fallback');
    }
  }
  return storageAvailable;
}

/**
 * Safe storage API that falls back to in-memory storage
 * when localStorage is blocked or unavailable
 */
export const safeStorage = {
  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @returns {string|null} - Stored value or null
   */
  getItem(key) {
    try {
      if (checkStorage()) {
        return localStorage.getItem(key);
      }
      return memoryStorage.get(key) || null;
    } catch (error) {
      console.warn(`[SafeStorage] getItem failed for key "${key}":`, error);
      return memoryStorage.get(key) || null;
    }
  },

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {string} value - Value to store
   */
  setItem(key, value) {
    try {
      if (checkStorage()) {
        localStorage.setItem(key, value);
      }
      // Always store in memory as backup
      memoryStorage.set(key, value);
    } catch (error) {
      console.warn(`[SafeStorage] setItem failed for key "${key}":`, error);
      // Fallback to memory storage
      memoryStorage.set(key, value);
    }
  },

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   */
  removeItem(key) {
    try {
      if (checkStorage()) {
        localStorage.removeItem(key);
      }
      memoryStorage.delete(key);
    } catch (error) {
      console.warn(`[SafeStorage] removeItem failed for key "${key}":`, error);
      memoryStorage.delete(key);
    }
  },

  /**
   * Clear all storage
   */
  clear() {
    try {
      if (checkStorage()) {
        localStorage.clear();
      }
      memoryStorage.clear();
    } catch (error) {
      console.warn('[SafeStorage] clear failed:', error);
      memoryStorage.clear();
    }
  },

  /**
   * Check if storage is available
   * @returns {boolean}
   */
  isAvailable() {
    return checkStorage();
  }
};

export default safeStorage;
