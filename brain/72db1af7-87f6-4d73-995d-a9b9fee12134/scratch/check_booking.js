import mongoose from "mongoose";
import Booking from "./backend/src/models/Booking.js";
import { MONGO_URI } from "./backend/src/config.js";

async function check() {
  await mongoose.connect(MONGO_URI || "mongodb://localhost:27017/swm");
  const b = await Booking.findById("6a02e392103aced616b1e53a").lean();
  console.log(JSON.stringify(b, null, 2));
  await mongoose.disconnect();
}
check();
