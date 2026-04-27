import mongoose from 'mongoose';
import { OfficeSettings } from '../models/Content.js';
import ProviderDayAvailability from '../models/ProviderDayAvailability.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        
        const office = await OfficeSettings.findOne().lean();
        console.log("Office Settings in DB:", JSON.stringify(office, null, 2));

        const avail = await ProviderDayAvailability.findOne({ 
            providerId: "69e874c8704af507ca295f94", 
            date: "2026-04-25" 
        }).lean();
        console.log("Ram dangi availability doc:", JSON.stringify(avail, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
