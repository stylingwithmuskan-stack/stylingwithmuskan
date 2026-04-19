import mongoose from "mongoose";
import dotenv from "dotenv";
import { createClient } from "redis";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

await mongoose.connect(MONGO_URI, { dbName: "swm" });
const db = mongoose.connection.db;

// 1. Show current value
const before = await db.collection("officesettings").findOne({});
console.log("BEFORE:", JSON.stringify({ startTime: before.startTime, endTime: before.endTime }));

// 2. Fix endTime from "09:08" to "21:00" (9 PM)
await db.collection("officesettings").updateOne(
  { _id: before._id },
  { $set: { endTime: "21:00" } }
);

// 3. Verify
const after = await db.collection("officesettings").findOne({});
console.log("AFTER:", JSON.stringify({ startTime: after.startTime, endTime: after.endTime }));

// 4. Clear Redis cache so frontend gets fresh data
try {
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  // Delete any cached office-settings keys
  const keys = await redis.keys("*office-settings*");
  if (keys.length > 0) {
    await redis.del(keys);
    console.log("Cleared Redis cache keys:", keys);
  } else {
    console.log("No cached office-settings keys found in Redis");
  }
  await redis.quit();
} catch (e) {
  console.log("Redis cache clear skipped:", e.message);
}

await mongoose.disconnect();
console.log("\n✅ Fix applied! endTime changed from '09:08' to '21:00' (9 PM)");
