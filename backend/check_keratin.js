import mongoose from 'mongoose';
import { Category, Service } from './src/models/Content.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/swm');
  const services = await Service.find({ name: /Keratin/i }).lean();
  console.log('--- SERVICES ---');
  services.forEach(s => console.log(`Name: ${s.name}, CategoryID: ${s.category}`));
  
  const catIds = services.map(s => s.category).filter(Boolean);
  const cats = await Category.find({ id: { $in: catIds } }).lean();
  console.log('\n--- CATEGORIES ---');
  cats.forEach(c => {
    console.log(`ID: ${c.id}, Name: ${c.name}, Advance: ${c.advancePercentage}%, BookingType: ${c.bookingType}`);
  });
  
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
