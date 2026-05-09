import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
    console.log("Connected to DB");

    const Booking = mongoose.connection.db.collection("bookings");
    
    console.log("Checking for 'payment_pending_timeout' index...");
    const indexes = await Booking.indexes();
    const hasIndex = indexes.some(idx => idx.name === "payment_pending_timeout");

    if (hasIndex) {
      console.log("Dropping index 'payment_pending_timeout'...");
      await Booking.dropIndex("payment_pending_timeout");
      console.log("Index dropped successfully.");
    } else {
      console.log("Index 'payment_pending_timeout' not found.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
