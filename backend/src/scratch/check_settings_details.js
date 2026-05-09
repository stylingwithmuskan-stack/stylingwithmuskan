import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "swm";

async function run() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
    console.log("Connected to DB");

    const settings = await mongoose.connection.db.collection("officesettings").findOne({});
    console.log("Office Settings:", JSON.stringify(settings, null, 2));

    const bookingSettings = await mongoose.connection.db.collection("bookingsettings").findOne({});
    console.log("Booking Settings:", JSON.stringify(bookingSettings, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

run();
