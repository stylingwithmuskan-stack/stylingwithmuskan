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

  // Retry logic for Atlas connection
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}/${maxRetries}...`);
      
      await mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 60000, // 60 seconds
        socketTimeoutMS: 60000, // 60 seconds
        connectTimeoutMS: 60000,
        heartbeatFrequencyMS: 10000,
        family: 4, // Use IPv4, skip trying IPv6
      });
      
      console.log(`[DB] ✅ Mongo connected to Atlas/Remote db=${dbName}`);
      console.log(`[DB] Connection state: ${mongoose.connection.readyState}`); // 1 = connected
      
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
      
      return; // Success, exit function
      
    } catch (err) {
      lastError = err;
      console.error(`[DB] ❌ Attempt ${attempt} failed:`, err.message);
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`[DB] ⏳ Retrying in ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed
  console.error("\n[DB] ❌ All connection attempts failed");
  console.error("[DB] Error code:", lastError?.code);
  console.error("[DB] Error name:", lastError?.name);
  console.error("\n[DB] 💡 Troubleshooting tips:");
  console.error("   1. Check your internet connection");
  console.error("   2. Verify MongoDB Atlas IP whitelist (add 0.0.0.0/0 for testing)");
  console.error("   3. Check if VPN/Firewall is blocking connection");
  console.error("   4. Verify MongoDB Atlas credentials in .env file\n");
  
  throw lastError;
}
