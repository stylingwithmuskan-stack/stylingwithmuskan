
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { buildAssignmentCandidates } from './backend/src/lib/assignmentCandidates.js';

// Load env
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'swm';

async function research() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('Connected to DB');

    // Simulate the booking object from the log
    const booking = {
        _id: new mongoose.Types.ObjectId(),
        categoryIds: ['1775214977463'],
        address: {
            city: 'Indore',
            zone: 'Current Location',
            lat: 22.7010913,
            lng: 75.8615916
        },
        slot: {
            date: '2026-04-17',
            time: '05:30 PM'
        },
        preferredProviderId: '69de96d039906ab7bd9547d8'
    };

    console.log('\n--- Running buildAssignmentCandidates simulation ---');
    const candidates = await buildAssignmentCandidates(booking);
    
    console.log('\n--- Final Candidates ---');
    console.log(candidates);

    if (candidates.includes(booking.preferredProviderId)) {
        console.log('\n✅ SIMULATION SUCCESS: Hritik was found!');
    } else {
        console.log('\n❌ SIMULATION FAILURE: Hritik was NOT found.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

research();
