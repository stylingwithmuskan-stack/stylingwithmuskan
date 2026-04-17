import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  
  const Booking = mongoose.model("Booking", new mongoose.Schema({}, { strict: false }));
  
  const stats = await Booking.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  console.log("--- Booking Status Counts in DB ---");
  stats.forEach(s => {
    console.log(`${s._id}: ${s.count}`);
  });
  
  // Also check sample bookings for specific statuses to see if they are consistent
  if (stats.length > 0) {
      const sample = await Booking.findOne().lean();
      console.log("\nSample Booking Status Case Check:");
      console.log(`Original Status in DB: "${sample.status}"`);
  }

  process.exit(0);
}

run();
