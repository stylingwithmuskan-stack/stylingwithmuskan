import mongoose from 'mongoose';
import '../src/models/Booking.js';

async function check() {
  const MONGO_URI = 'mongodb+srv://nikhilbhatia917_db_user:ishika123456@cluster0.cscffgc.mongodb.net/?appName=Cluster0';
  const MONGO_DB = 'swm';

  try {
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
    const Booking = mongoose.model('Booking');
    const count = await Booking.countDocuments();
    console.log('Total bookings in DB:', count);

    const sample = await Booking.findOne();
    console.log('Sample booking provider:', sample?.assignedProvider);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
