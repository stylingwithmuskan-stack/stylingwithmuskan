import mongoose from 'mongoose';
import { OfficeSettings } from '../models/Content.js';
import ProviderDayAvailability from '../models/ProviderDayAvailability.js';
import { computeAvailableSlots } from '../lib/availability.js';
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

        const providerId = "69e86c25704af507ca295f4c"; // sohan test proveider
        const date = "2026-04-25";

        // Check if he has availability doc
        const avail = await ProviderDayAvailability.findOne({ providerId, date }).lean();
        console.log(`Provider ${providerId} availability doc exists: ${!!avail}`);

        const result = await computeAvailableSlots(providerId, date, settings, { ignoreLeadTime: true, useCache: false });
        
        console.log(`Testing Overnight (9 PM - 1 AM). Found ${result.slots.length} slots.`);
        console.log("Slots:", result.slots);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
