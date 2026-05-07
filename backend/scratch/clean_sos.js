import mongoose from 'mongoose';
import SOSAlert from '../src/models/SOSAlert.js';
import dotenv from 'dotenv';
dotenv.config();

async function cleanSOS() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Delete alerts that have "Unknown Source" or missing userName
    const res = await SOSAlert.deleteMany({ 
      $or: [
        { userName: "Unknown Source" },
        { userName: { $exists: false } }
      ]
    });

    console.log(`Deleted ${res.deletedCount} old/invalid SOS alerts.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanSOS();
