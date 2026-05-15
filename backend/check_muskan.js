import mongoose from 'mongoose';
import ProviderAccount from './src/models/ProviderAccount.js';
import Booking from './src/models/Booking.js';
import { BookingSettings } from './src/models/Settings.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stylingwithmuskan');
  console.log('Connected to DB');

  const p = await ProviderAccount.findOne({ name: /muskan/i }).lean();
  if (!p) {
    console.log('Muskan not found');
    process.exit(0);
  }

  console.log('PROVIDER:', {
    id: p._id,
    name: p.name,
    status: p.approvalStatus,
    registration: p.registrationComplete,
    city: p.city,
    isOnline: p.isOnline,
    specialties: p.documents?.specializations
  });

  const DayAvail = mongoose.model('ProviderDayAvailability', new mongoose.Schema({}, { strict: false }), 'providerdayavailabilities');
  const da = await DayAvail.findOne({ providerId: String(p._id) }).lean();
  console.log('AVAILABILITY:', da ? 'Record found' : 'No record (using defaults)');
  if (da) {
    console.log('Available Slots Count:', da.availableSlots?.length);
  }

  const activeBookings = await Booking.find({
    assignedProvider: String(p._id),
    status: { $nin: ['cancelled', 'rejected'] }
  }).lean();
  console.log('ACTIVE BOOKINGS:', activeBookings.length);

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
