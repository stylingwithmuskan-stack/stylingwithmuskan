import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: "./backend/.env" });

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  console.log("Connecting to:", MONGO_URI, "DB:", MONGO_DB);
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  const db = mongoose.connection.db;
  
  const userCount = await db.collection("users").countDocuments();
  console.log("Total Users in DB:", userCount);
  
  const providerCount = await db.collection("provideraccounts").countDocuments();
  console.log("Total Providers in DB:", providerCount);
  
  const vendorCount = await db.collection("vendors").countDocuments();
  console.log("Total Vendors in DB:", vendorCount);

  // Let's sample a few users and providers to see their cities/addresses
  const sampleUsers = await db.collection("users").find().limit(5).toArray();
  console.log("\nSample Users:");
  sampleUsers.forEach(u => {
    console.log(`- ID: ${u._id}, Name: ${u.name || u.firstName}, Addresses: ${JSON.stringify(u.addresses || [])}`);
  });

  const sampleProviders = await db.collection("provideraccounts").find().limit(5).toArray();
  console.log("\nSample Providers:");
  sampleProviders.forEach(p => {
    console.log(`- ID: ${p._id}, Name: ${p.name}, City: ${p.city}`);
  });

  process.exit(0);
}

run().catch(console.error);
