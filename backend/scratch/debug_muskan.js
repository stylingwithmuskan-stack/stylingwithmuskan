import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  let uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'swm';
  
  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }

  // Ensure DB name is in the URI if not already there
  if (uri.includes('?')) {
    uri = uri.replace('?', `${dbName}?`);
  } else {
    uri = `${uri}/${dbName}`;
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to DB:', dbName);
  
  const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }));
  const muskan = await ProviderAccount.findOne({ name: /Muskan/i });
  console.log('Muskan Provider:', JSON.stringify(muskan, null, 2));
  
  if (muskan) {
    const ProviderDayAvailability = mongoose.model('ProviderDayAvailability', new mongoose.Schema({}, { strict: false }));
    const availability = await ProviderDayAvailability.find({ providerId: muskan._id });
    console.log('Muskan Availability Count:', availability.length);
    if (availability.length > 0) {
        // Show first 3 availability docs
        console.log('Sample Availability:', JSON.stringify(availability.slice(0, 3), null, 2));
    }
    
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
    const bookings = await Booking.find({ assignedProvider: muskan._id, status: { $ne: 'cancelled' } });
    console.log('Muskan Active Bookings Count:', bookings.length);

    const LeaveRequest = mongoose.model('LeaveRequest', new mongoose.Schema({}, { strict: false }));
    const leaves = await LeaveRequest.find({ providerId: muskan._id });
    console.log('Muskan Leaves:', JSON.stringify(leaves, null, 2));
  } else {
    console.log('Muskan not found!');
  }
  
  const BookingSettings = mongoose.model('BookingSettings', new mongoose.Schema({}, { strict: false }));
  const settings = await BookingSettings.findOne();
  console.log('Booking Settings:', JSON.stringify(settings, null, 2));

  const OfficeSettings = mongoose.model('OfficeSettings', new mongoose.Schema({}, { strict: false }));
  const office = await OfficeSettings.findOne();
  console.log('Office Settings:', JSON.stringify(office, null, 2));

  process.exit();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
