import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ProviderAccountSchema = new mongoose.Schema({
    phone: String,
    name: String,
    city: String,
    cityId: String,
    approvalStatus: String,
    registrationComplete: Boolean,
    isOnline: Boolean,
});

const ProviderAccount = mongoose.models.ProviderAccount || mongoose.model("ProviderAccount", ProviderAccountSchema);

async function checkProviders() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
        console.log("Connected to MongoDB");

        const allProviders = await ProviderAccount.find({}).lean();
        console.log(`Total Providers: ${allProviders.length}`);

        allProviders.forEach(p => {
            console.log(`- Name: ${p.name}, City: ${p.city}, CityId: ${p.cityId}, Status: ${p.approvalStatus}, Reg: ${p.registrationComplete}, Online: ${p.isOnline}`);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkProviders();
