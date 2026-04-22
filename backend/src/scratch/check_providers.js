import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const ProviderAccountSchema = new mongoose.Schema({}, { strict: false });
const ProviderAccount = mongoose.model('ProviderAccount', ProviderAccountSchema, 'provideraccounts');

async function checkProviders() {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await ProviderAccount.countDocuments({});
    const online = await ProviderAccount.countDocuments({ isOnline: true });
    const registrationComplete = await ProviderAccount.countDocuments({ registrationComplete: true });
    const approved = await ProviderAccount.countDocuments({ approvalStatus: 'approved' });
    const allCriteria = await ProviderAccount.countDocuments({
        isOnline: true,
        registrationComplete: true,
        approvalStatus: 'approved'
    });

    console.log('Total Providers:', count);
    console.log('Online Providers:', online);
    console.log('Registration Complete:', registrationComplete);
    console.log('Approved:', approved);
    console.log('Matching All Criteria:', allCriteria);

    if (allCriteria > 0) {
        const sample = await ProviderAccount.findOne({
            isOnline: true,
            registrationComplete: true,
            approvalStatus: 'approved'
        }).lean();
        console.log('Sample Provider Zones:', sample.zones);
        console.log('Sample Provider City:', sample.city);
    }

    await mongoose.disconnect();
}

checkProviders();
