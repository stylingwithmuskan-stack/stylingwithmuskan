/**
 * Safe sessionStorage wrapper with in-memory fallback
 * Prevents crashes in restricted environments and provides per-tab isolation
 */

const memoryStorage = new Map();

function isStorageAvailable() {
  try {
    const test = '__session_storage_test__';
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

let storageAvailable = null;

function checkStorage() {
  if (storageAvailable === null) {
    storageAvailable = isStorageAvailable();
  }
  return storageAvailable;
}

export const safeSessionStorage = {
  getItem(key) {
    try {
      let value = null;
      if (checkStorage()) {
        value = sessionStorage.getItem(key);
      } else {
        value = memoryStorage.get(key) || null;
      }
      if (value === "null" || value === "undefined") return null;
      return value;
    } catch (error) {
      return memoryStorage.get(key) || null;
    }
  },

  setItem(key, value) {
    try {
      if (checkStorage()) {
        sessionStorage.setItem(key, value);
      }
      memoryStorage.set(key, value);
    } catch (error) {
      memoryStorage.set(key, value);
    }
  },

  removeItem(key) {
    try {
      if (checkStorage()) {
        sessionStorage.removeItem(key);
      }
      memoryStorage.delete(key);
    } catch (error) {
      memoryStorage.delete(key);
    }
  },

  clear() {
    try {
      if (checkStorage()) {
        sessionStorage.clear();
      }
      memoryStorage.clear();
    } catch (error) {
      memoryStorage.clear();
    }
  }
};

export default safeSessionStorage;
