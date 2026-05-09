import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    
    const indexes = await mongoose.connection.db.collection("bookings").indexes();
    console.log("Indexes on 'bookings' collection:");
    console.log(JSON.stringify(indexes, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkIndexes();
