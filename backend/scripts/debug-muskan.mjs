
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import ProviderAccount from '../src/models/ProviderAccount.js';
import Booking from '../src/models/Booking.js';
import { computeAvailableSlots } from '../src/lib/availability.js';
import { resolveBookingSettings } from '../src/lib/settings.js';

async function test() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || 'swm';
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, { dbName });
  console.log("✅ Connected to DB:", dbName);
  
  const muskan = await ProviderAccount.findOne({ name: /Muskan/i });
  if (!muskan) {
    console.log("Muskan not found");
    process.exit(0);
  }
  
  console.log("\nFound Muskan Profile:");
  console.log("ID:", muskan._id);
  console.log("Phone:", muskan.phone);
  console.log("City:", muskan.city);
  console.log("Zones:", muskan.zones);
  
  const settings = await resolveBookingSettings();
  const date = "2026-05-09";
  
  console.log("\n--- Computing Slots for Saturday (9 May 2026) ---");
  const result = await computeAvailableSlots(muskan._id.toString(), date, settings);
  
  console.log("\nSlots available for Muskan on Saturday:", result.slots.length);
  const is1130Available = result.slots.includes("11:30 AM");
  if (is1130Available) {
    console.log("❌ BUG: 11:30 AM is still AVAILABLE for Muskan!");
  } else {
    console.log("✅ SUCCESS: 11:30 AM is BLOCKED for Muskan.");
  }
  
  // Detailed check of why it might be free
  const phoneVariants = [
    muskan.phone,
    muskan.phone.startsWith("+91") ? muskan.phone.slice(3) : `+91${muskan.phone}`
  ];
  
  const bookings = await Booking.find({
    $or: [
      { assignedProvider: String(muskan._id) },
      { assignedProvider: String(muskan.phone) },
      ...phoneVariants.map(ph => ({ assignedProvider: String(ph) }))
    ],
    status: { $nin: ["cancelled", "rejected", "missed"] }
  }).lean();
  
  console.log(`\nFound ${bookings.length} active bookings for Muskan (Total)`);
  
  const satBookings = bookings.filter(b => {
      const bDate = b.slot?.date || "";
      return bDate.includes("2026-05-09") || bDate.includes("9 May");
  });
  
  console.log(`Found ${satBookings.length} bookings for Saturday specifically.`);
  satBookings.forEach(b => {
      console.log(`- Booking ${b._id}: Time=${b.slot.time}, Status=${b.status}, ProviderField=${b.assignedProvider}`);
  });

  process.exit(0);
}

test().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
