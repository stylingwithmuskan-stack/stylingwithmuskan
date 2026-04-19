import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
await mongoose.connect(MONGO_URI);

const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();
console.log("=== ALL COLLECTIONS ===");
for (const c of collections) {
  const count = await db.collection(c.name).countDocuments();
  console.log(`  ${c.name}: ${count} documents`);
}

// Check if providers are in a different collection
for (const c of collections) {
  if (c.name.toLowerCase().includes("provider")) {
    console.log(`\n=== ${c.name} SAMPLE ===`);
    const sample = await db.collection(c.name).find({}).limit(3).toArray();
    sample.forEach(doc => {
      console.log(`  _id: ${doc._id}, name: ${doc.name}, city: ${doc.city}, isOnline: ${doc.isOnline}, approvalStatus: ${doc.approvalStatus}, registrationComplete: ${doc.registrationComplete}`);
    });
  }
}

await mongoose.disconnect();
