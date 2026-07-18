import { redis } from './src/startup/redis.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function clearCache() {
  try {
    console.log("Connecting to Redis...");
    if (!redis.isOpen) {
      await redis.connect();
    }
    const keys = await redis.keys("content:*");
    console.log(`Found ${keys.length} content keys in Redis. Deleting them...`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Content cache cleared.");
    } else {
      console.log("No content cache keys found.");
    }
    
    try {
      await redis.flushAll();
      console.log("Redis flushAll complete.");
    } catch (e) {
      console.warn("flushAll not supported or failed, but key deletion succeeded:", e.message);
    }
    
    await redis.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Failed to clear Redis cache:", err);
    process.exit(1);
  }
}

clearCache();
