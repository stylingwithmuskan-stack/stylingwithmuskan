import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "";
  const dbName = process.env.MONGO_DB || "swm";
  
  console.log('[DB] 🔌 Attempting MongoDB connection...');
  console.log('[DB] URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password
  console.log('[DB] Database:', dbName);
  
  mongoose.set("strictQuery", true);
  
  if (!uri) {
    throw new Error("MONGO_URI is not configured. Atlas connection is required.");
  }

  try {
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 30000, // Increased to 30s
    });
    console.log(`[DB] ✅ Mongo connected to Atlas/Remote db=${dbName}`);
    console.log(`[DB] Connection state: ${mongoose.connection.readyState}`); // 1 = connected
  } catch (err) {
    console.error("[DB] ❌ Mongo connection error:", err.message);
    console.error("[DB] Error code:", err.code);
    console.error("[DB] Error name:", err.name);
    throw err;
  }
  
  // Log connection events
  mongoose.connection.on('connected', () => {
    console.log('[DB] 🟢 Mongoose connected');
  });
  
  mongoose.connection.on('error', (err) => {
    console.error('[DB] 🔴 Mongoose connection error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('[DB] 🟡 Mongoose disconnected');
  });
}
