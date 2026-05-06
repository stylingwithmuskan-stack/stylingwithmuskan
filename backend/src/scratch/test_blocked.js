import mongoose from 'mongoose';
import ProviderAccount from '../models/ProviderAccount.js';
import { computeAvailableSlots } from '../lib/availability.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        
        const providerId = "69e874c8704af507ca295f94"; // Ram dangi
        const date = "2026-04-25";

        console.log("--- Testing Blocked Provider Check ---");
        
        // 1. Check slots while approved
        await ProviderAccount.findByIdAndUpdate(providerId, { approvalStatus: "approved" });
        const res1 = await computeAvailableSlots(providerId, date, {}, { ignoreLeadTime: true, useCache: false });
        console.log(`Slots while APPROVED: ${res1.slots.length}`);

        // 2. Block the provider
        await ProviderAccount.findByIdAndUpdate(providerId, { approvalStatus: "blocked" });
        const res2 = await computeAvailableSlots(providerId, date, {}, { ignoreLeadTime: true, useCache: false });
        console.log(`Slots while BLOCKED: ${res2.slots.length}`);
        console.log("Result Reason:", res2.reason);

        // 3. Revert to approved
        await ProviderAccount.findByIdAndUpdate(providerId, { approvalStatus: "approved" });

        if (res1.slots.length > 0 && res2.slots.length === 0 && res2.reason === "provider_blocked") {
            console.log("SUCCESS: Blocked provider check works!");
        } else {
            console.error("FAILURE: Blocked provider check failed.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
