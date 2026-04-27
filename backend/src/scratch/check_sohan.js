import mongoose from 'mongoose';
import ProviderDayAvailability from '../models/ProviderDayAvailability.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        
        const avail = await ProviderDayAvailability.findOne({ 
            providerId: "69e86c25704af507ca295f4c", 
            date: "2026-04-25" 
        }).lean();
        console.log("Sohan availability doc:", JSON.stringify(avail, null, 2));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
