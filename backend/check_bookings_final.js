import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://swm:swm123@cluster0.89v8v.mongodb.net/swm');
    console.log("Connected to DB");
    const indexes = await mongoose.connection.db.collection('bookings').indexes();
    console.log("Indexes for 'bookings' collection:");
    console.log(JSON.stringify(indexes, null, 2));
    
    // Also check if any booking actually exists for that user
    const userId = "69fda653b191cae835af07d2";
    const count = await mongoose.connection.db.collection('bookings').countDocuments({ customerId: userId });
    console.log(`\nActual count in DB for User ${userId}: ${count}`);
    
    const allCount = await mongoose.connection.db.collection('bookings').countDocuments({});
    console.log(`Total bookings in DB: ${allCount}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkIndexes();
