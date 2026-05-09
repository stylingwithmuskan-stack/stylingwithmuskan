import mongoose from "mongoose";
import Booking from "./backend/src/models/Booking.js";
import User from "./backend/src/models/User.js";
import dotenv from "dotenv";

dotenv.config({ path: "./backend/.env" });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to DB");

  const lastBookings = await Booking.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log("Last 5 bookings:");
  lastBookings.forEach(b => {
    console.log(`ID: ${b._id}, Customer: ${b.customerName} (${b.customerId}), Status: ${b.status}, CreatedAt: ${b.createdAt}`);
  });

  const users = await User.find({ name: { $regex: /muskan/i } }).limit(5).lean();
  console.log("\nUsers matching 'muskan':");
  users.forEach(u => {
    console.log(`ID: ${u._id}, Name: ${u.name}, Phone: ${u.phone}`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
