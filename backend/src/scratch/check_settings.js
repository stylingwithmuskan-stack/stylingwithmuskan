import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkSettings() {
    // Use the exact key from .env
    const uri = process.env.MONGO_URI; 
    const dbName = process.env.MONGO_DB || 'swm';
    
    if (!uri) {
        console.error('MONGO_URI not found in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, { dbName });
        console.log('Connected to DB:', dbName);

        const BookingSettings = mongoose.model('BookingSettings', new mongoose.Schema({}, { strict: false }), 'bookingsettings');
        const OfficeSettings = mongoose.model('OfficeSettings', new mongoose.Schema({}, { strict: false }), 'officesettings');

        const b = await BookingSettings.findOne().lean();
        const o = await OfficeSettings.findOne().lean();

        console.log('--- Booking Settings ---');
        console.log(JSON.stringify(b, null, 2));
        console.log('--- Office Settings ---');
        console.log(JSON.stringify(o, null, 2));

        // Also check if any providers are online
        const ProviderAccount = mongoose.model('ProviderAccount', new mongoose.Schema({}, { strict: false }), 'provideraccounts');
        const onlineCount = await ProviderAccount.countDocuments({ isOnline: true });
        console.log('Online Providers Count:', onlineCount);

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkSettings();
