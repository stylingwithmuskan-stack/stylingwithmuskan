import mongoose from 'mongoose';
import ProviderAccount from '../models/ProviderAccount.js';
import { resolveBookingSettings } from '../lib/settings.js';
import { computeAvailableSlots } from '../lib/availability.js';
import { getIndiaDate } from '../lib/isoDateTime.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            console.error("MONGO_URI not found in .env");
            return;
        }
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        console.log("Connected to DB");

        const settings = await resolveBookingSettings();
        console.log("Effective Settings:", {
            startTime: settings.startTime || settings.serviceStartTime,
            endTime: settings.endTime || settings.serviceEndTime
        });

        const providers = await ProviderAccount.find({
            approvalStatus: 'approved',
            registrationComplete: true,
            isOnline: true
        }).lean();

        if (providers.length === 0) {
            console.log("No approved/online providers found to test.");
            return;
        }

        const date = getIndiaDate();
        console.log(`Testing slots for ${providers.length} providers on Date: ${date}`);

        for (const provider of providers) {
            console.log(`--- Provider: ${provider.name} (ID: ${provider._id}) ---`);
            const result = await computeAvailableSlots(provider._id.toString(), date, settings, { ignoreLeadTime: true, useCache: false });
            console.log("Result Reason:", result.reason || "N/A");
            console.log(`Found ${result.slots.length} total slots in window.`);
            if (result.slots.length > 0) {
                console.log("First 3 slots:", result.slots.slice(0, 3));
                // Specifically check the problematic 12:00 AM - 01:00 AM range if it's overnight
                const lateSlots = result.slots.filter(s => s.includes("AM") && (s.startsWith("12:") || s.startsWith("01:00")));
                console.log("Late Night Slots (12 AM - 1 AM):", lateSlots);
                break; // Found one with slots
            }
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
