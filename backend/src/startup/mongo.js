import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swm";
  mongoose.set("strictQuery", true);
  if (uri === "memory") {
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri, { dbName: process.env.MONGO_DB || "swm" });
      console.log(`[DB] Mongo connected (memory) db=${process.env.MONGO_DB || "swm"}`);
    } catch (e) {
      console.warn("[DB] mongodb-memory-server not available; continuing without Mongo connection");
    }
  } else {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGO_DB || "swm",
        serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      });
      console.log(`[DB] Mongo connected db=${process.env.MONGO_DB || "swm"}`);
    } catch (err) {
      console.error("[DB] Mongo connection error:", err.message);
      if (process.env.NODE_ENV === "development") {
        console.warn("[DB] Falling back to local/memory mode for development...");
        // Fallback to local or memory if atlas fails in dev
        const localUri = "mongodb://127.0.0.1:27017/swm";
        try {
          await mongoose.connect(localUri);
          console.log(`[DB] Connected to local MongoDB`);
        } catch (e) {
          console.error("[DB] Local MongoDB also failed.");
          throw err; // Re-throw if even local fails
        }
      } else {
        throw err;
      }
    }
  }
}
