import mongoose from 'mongoose';
import { computeAvailableSlots } from '../lib/availability.js';
import { DEFAULT_TIME_SLOTS } from '../lib/slots.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        
        // Mocking Office Settings for Overnight Test
        const settings = {
            startTime: "21:00", // 9 PM
            endTime: "01:00",   // 1 AM
            bufferMinutes: 30
        };

        // Use a random ObjectId for a non-existent provider to force fallback behavior
        const dummyProviderId = new mongoose.Types.ObjectId().toString();
        const date = "2026-04-25";

        console.log(`--- Testing with Dummy Provider (Fallback Mode) ---`);
        const result = await computeAvailableSlots(dummyProviderId, date, settings, { ignoreLeadTime: true, useCache: false });
        
        console.log(`Testing Overnight (9 PM - 1 AM). Found ${result.slots.length} slots.`);
        console.log("Slots:", result.slots);

        // Verification
        const expected = ["09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM", "12:00 AM", "12:30 AM", "01:00 AM"];
        const missing = expected.filter(s => !result.slots.includes(s));
        
        if (missing.length === 0) {
            console.log("SUCCESS: All expected overnight slots are present!");
        } else {
            console.error("FAILURE: Missing slots:", missing);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
