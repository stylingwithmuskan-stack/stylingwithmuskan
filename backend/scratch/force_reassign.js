import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import Booking from '../src/models/Booking.js';
import ProviderAccount from '../src/models/ProviderAccount.js';
import { buildAssignmentCandidates } from '../src/lib/assignmentCandidates.js';

async function run() {
  try {
    console.log("Connecting to DB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");

    const bookingId = "69fc8396cfa2a358ab616ed2";
    const booking = await Booking.findById(bookingId).lean();
    
    if (!booking) {
      console.error("Booking not found!");
      process.exit(1);
    }

    console.log(`Analyzing Booking ${bookingId}...`);
    console.log(`Slot: ${booking.slot.date} ${booking.slot.time}`);
    console.log(`City: ${booking.address.city}, Zone: ${booking.address.zone}`);

    // Re-run candidate matching
    console.log("Running buildAssignmentCandidates...");
    const { candidateProviders } = await buildAssignmentCandidates({
        address: booking.address,
        slot: booking.slot,
        services: booking.services,
    });
    
    console.log(`Found ${candidateProviders.length} candidates:`, candidateProviders);

    if (candidateProviders.length > 0) {
        await Booking.updateOne({ _id: bookingId }, { $set: { candidateProviders } });
        console.log("Successfully updated candidates in DB.");
    } else {
        console.log("Still NO candidates found. Checking Om's profile manually...");
        const om = await ProviderAccount.findOne({ name: /om/i });
        if (om) {
            console.log("Found Om:", {
                id: om._id,
                city: om.city,
                zones: om.zones,
                specialties: om.documents?.specializations
            });
            // Check why Om didn't match
            const cityMatch = String(om.city).toLowerCase() === String(booking.address.city).toLowerCase();
            console.log(`City Match: ${cityMatch}`);
        } else {
            console.log("Om not found in ProviderAccount!");
        }
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
