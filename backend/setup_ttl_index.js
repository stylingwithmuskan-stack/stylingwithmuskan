import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log("Connected to DB");

  const Booking = mongoose.model("Booking", new mongoose.Schema({}, { strict: false }));
  
  console.log("Creating Partial TTL index for 'payment_pending' status...");
  
  // Create index on createdAt field
  // expireAfterSeconds: 600 (10 minutes)
  // partialFilterExpression: Only for payment_pending status
  await Booking.collection.createIndex(
    { createdAt: 1 },
    { 
      expireAfterSeconds: 600, 
      partialFilterExpression: { status: "payment_pending" },
      name: "payment_pending_timeout"
    }
  );

  console.log("Done! Index created successfully.");
  process.exit(0);
}

run();
