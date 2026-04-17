
import { redis } from './backend/src/startup/redis.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

async function research() {
  try {
    const providerId = '69de96d039906ab7bd9547d8';
    const date = '2026-04-17';
    
    console.log(`\n--- Checking Redis for Hritik (${providerId}) on ${date} ---`);

    // Get version
    const ver = await redis.get(`slots:ver:${providerId}:${date}`) || "0";
    console.log(`Version: ${ver}`);

    // Scan for keys
    const keys = await redis.keys(`slots:${providerId}:${date}:*`);
    console.log(`Found ${keys.length} cached slot keys:`);
    
    for (const key of keys) {
        const val = await redis.get(key);
        console.log(`\nKey: ${key}`);
        const parsed = JSON.parse(val || '{}');
        console.log(`Is 05:30 PM available in cache? ${parsed.slotMap?.['05:30 PM']}`);
        if (parsed.slotMap?.['05:30 PM'] === false) {
            console.log('Reason in cache: ', parsed.reason);
        }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

research();
