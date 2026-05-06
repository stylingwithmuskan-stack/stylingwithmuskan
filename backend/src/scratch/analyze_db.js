import mongoose from 'mongoose';
import ProviderAccount from '../models/ProviderAccount.js';
import { BookingSettings } from '../models/Settings.js';
import { OfficeSettings } from '../models/Content.js';
import { City, Zone } from '../models/CityZone.js';
import dotenv from 'dotenv';

dotenv.config();

function escapeRegex(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            console.error("MONGO_URI not found in .env");
            return;
        }
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        console.log("Connected to DB:", mongoUri, "DB Name:", process.env.MONGO_DB || 'swm');

        const office = await OfficeSettings.findOne().lean();
        console.log("Office Settings:", JSON.stringify(office, null, 2));

        const bookingSettings = await BookingSettings.findOne().lean();
        console.log("Booking Settings:", JSON.stringify(bookingSettings, null, 2));

        const cityGuess = "indore"; // Typical city
        const zoneGuess = "indore"; // Typical zone

        const baseQ = {
            approvalStatus: "approved",
            registrationComplete: true,
            isOnline: true,
        };

        let q = { ...baseQ };
        // Simulating the query logic from providers.routes.js
        q.city = new RegExp(`^${escapeRegex(cityGuess)}$`, "i");
        q.$or = [
            { zones: { $in: [new RegExp(`^${escapeRegex(zoneGuess)}$`, "i")] } },
            { pendingZones: { $in: [new RegExp(`^${escapeRegex(zoneGuess)}$`, "i")] } },
        ];

        console.log("Simulated Query:", JSON.stringify(q, null, 2));
        const providers = await ProviderAccount.find(q).lean();
        console.log(`Found ${providers.length} providers matching query.`);

        if (providers.length > 0) {
            providers.forEach(p => {
                console.log(`Provider: ${p.name}, city: "${p.city}", zones: ${JSON.stringify(p.zones)}`);
            });
        }

        const allZones = await Zone.find().lean();
        console.log("Zones in DB:");
        allZones.forEach(z => {
            console.log(`  - ${z.name} (ID: ${z._id})`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
