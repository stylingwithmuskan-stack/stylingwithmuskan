import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
console.log("Full URI (redacted password):", MONGO_URI?.replace(/:[^:@]+@/, ':***@'));

await mongoose.connect(MONGO_URI);

const admin = mongoose.connection.db.admin();

// List all databases
const dbs = await admin.listDatabases();
console.log("\n=== ALL DATABASES ===");
for (const db of dbs.databases) {
  console.log(`  ${db.name}: ${(db.sizeOnDisk / 1024).toFixed(1)} KB`);
}

// Check each database for provider-related collections
for (const dbInfo of dbs.databases) {
  if (dbInfo.name === 'admin' || dbInfo.name === 'local') continue;
  const db = mongoose.connection.client.db(dbInfo.name);
  const collections = await db.listCollections().toArray();
  if (collections.length > 0) {
    console.log(`\n=== ${dbInfo.name} collections ===`);
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  ${c.name}: ${count} docs`);
    }
  }
}

await mongoose.disconnect();
