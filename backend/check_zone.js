import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Zone } from './src/models/CityZone.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'swm' });
  const zones = await Zone.find().limit(10).lean();
  console.log('Zones found:', zones.length);
  zones.forEach(z => console.log(`- ${z.name} (${z._id})`));
  await mongoose.disconnect();
}

check().catch(console.error);
