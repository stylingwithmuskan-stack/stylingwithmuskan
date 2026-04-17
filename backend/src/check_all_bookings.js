
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'swm';

async function research() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('Connected to DB');

    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
    const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }));

    const date = '2026-04-17';

    // 1. Get all bookings for today in Indore providers
    const providers = await ProviderAccount.find({ city: /indore/i }).select('_id name').lean();
    const pIds = providers.map(p => p._id);

    const bookings = await Booking.find({
        assignedProvider: { $in: pIds },
        'slot.date': date,
        status: { $nin: ['cancelled', 'rejected'] }
    }).lean();

    console.log(`\n--- ALL ACTIVE BOOKINGS IN INDORE FOR ${date} ---`);
    if (bookings.length > 0) {
        bookings.forEach(b => {
            const p = providers.find(pr => String(pr._id) === String(b.assignedProvider));
            console.log(`- Provider: ${p?.name || 'Unknown'}`);
            console.log(`  Booking ID: ${b._id}`);
            console.log(`  Time: ${b.slot?.time}`);
            console.log(`  Status: ${b.status}`);
            console.log(`  CreatedAt: ${b.createdAt}`);
        });
    } else {
        console.log('No active bookings found for any Indore provider today.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

research();
