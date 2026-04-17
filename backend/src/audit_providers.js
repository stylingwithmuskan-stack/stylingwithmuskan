
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'swm';

async function research() {
  try {
    if (!MONGO_URI) throw new Error('MONGO_URI is undefined. cwd: ' + process.cwd());
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('Connected to DB');

    const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }));
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
    const City = mongoose.model('City', new mongoose.Schema({}, { strict: false }));
    const Zone = mongoose.model('Zone', new mongoose.Schema({}, { strict: false }));

    const date = '2026-04-17';
    const targetSlot = '05:30 PM';

    // 1. Get Indore City
    const city = await City.findOne({ name: /indore/i }).lean();
    console.log(`\nCity: ${city?.name} (ID: ${city?._id})`);

    // 2. Get All active zones in this city
    const zones = await Zone.find({ city: city?._id }).lean();
    console.log(`\n--- Zones in ${city?.name} ---`);
    zones.forEach(z => console.log(`- ${z.name}`));

    // 3. Get All Approved Providers in this city
    const providers = await ProviderAccount.find({
        city: /indore/i,
        approvalStatus: 'approved'
    }).lean();

    console.log(`\n--- Provider Audit for ${date} at ${targetSlot} ---`);
    console.log(`${'Name'.padEnd(25)} | ${'Online'.padEnd(7)} | ${'RegCom'.padEnd(7)} | ${'Zones'.padEnd(40)}`);
    console.log('-'.repeat(100));

    for (const p of providers) {
        const pZones = Array.isArray(p.zones) ? p.zones.join(', ') : 'none';
        console.log(`${String(p.name).substring(0, 25).padEnd(25)} | ${String(p.isOnline).padEnd(7)} | ${String(p.registrationComplete).padEnd(7)} | ${pZones.substring(0, 40)}`);
        
        // Find bookings
        const pBookings = await Booking.find({
            assignedProvider: p._id,
            'slot.date': date,
            status: { $nin: ['cancelled', 'rejected'] }
        }).lean();

        if (pBookings.length > 0) {
            console.log(`  -> Bookings: ${pBookings.map(b => `${b.slot?.time} (${b.status})`).join(', ')}`);
        }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

research();
