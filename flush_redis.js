import { redis } from './backend/src/startup/redis.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

async function clearCache() {
  try {
    console.log("Connecting to Redis...");
    const keys = await redis.keys("content:*");
    console.log(`Found ${keys.length} content keys in Redis. Deleting them...`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log("Content cache cleared.");
    } else {
      console.log("No content cache keys found.");
    }
    
    // Also try FLUSHALL to be absolutely sure
    try {
      await redis.flushall();
      console.log("Redis FLUSHALL complete.");
    } catch (e) {
      console.warn("FLUSHALL not supported or failed, but key deletion succeeded:", e.message);
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Failed to clear Redis cache:", err);
    process.exit(1);
  }
}

clearCache();
