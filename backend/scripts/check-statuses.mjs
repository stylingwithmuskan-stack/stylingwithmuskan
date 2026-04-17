import mongoose from 'mongoose';
import Booking from '../src/models/Booking.js';

async function main() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stylingwithmuskan');
    const statuses = await Booking.distinct('status');
    console.log('Booking statuses:', statuses);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
