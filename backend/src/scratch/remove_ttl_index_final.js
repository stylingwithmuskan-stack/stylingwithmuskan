import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/?appName=Cluster0";
const MONGO_DB = "swm";

async function run() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
    console.log("Connected to DB");

    const Booking = mongoose.connection.db.collection("bookings");
    
    console.log("Checking for 'payment_pending_timeout' index...");
    const indexes = await Booking.indexes();
    console.log("Current indexes:", indexes.map(i => i.name));
    
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
