import mongoose from 'mongoose';
import { OfficeSettings } from './src/models/Content.js';
import { BookingSettings } from './src/models/Settings.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkSettings() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
  const office = await OfficeSettings.findOne().lean();
  const booking = await BookingSettings.findOne().lean();
  
  console.log('Office Settings:', office);
  console.log('Booking Settings:', booking);
  
  await mongoose.disconnect();
}

checkSettings();
