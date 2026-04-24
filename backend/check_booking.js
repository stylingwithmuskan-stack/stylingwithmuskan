import mongoose from "mongoose";
import Booking from "./src/models/Booking.js";
import CustomEnquiry from "./src/models/CustomEnquiry.js";
import { MONGO_URI, MONGO_DB } from "./src/config.js";

async function check() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);
  const id = "69ea5f53f0b64f5d0e5efbc1";
  const b = await Booking.findById(id).lean();
  const e = await CustomEnquiry.findById(id).lean();
  console.log("BOOKING_DATA:", JSON.stringify(b, null, 2));
  console.log("ENQUIRY_DATA:", JSON.stringify(e, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
