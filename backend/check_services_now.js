import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkServices() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.useDb(process.env.MONGO_DB || 'swm');
        const Service = db.model('Service', new mongoose.Schema({}, { strict: false }));
        
        const hairM = await Service.find({ category: 'hair-m' }).lean(); // wait, what is the actual category ID for Hair M?
        // Let's just find "Keratin Hair Spa" first to see its category and gender
        const keratin = await Service.findOne({ name: 'Keratin Hair Spa' }).lean();
        console.log('Keratin Hair Spa Details:', JSON.stringify(keratin, null, 2));
        
        const loreal = await Service.findOne({ name: 'Loreal Hair Spa' }).lean();
        console.log('Loreal Hair Spa Details:', JSON.stringify(loreal, null, 2));
        
        // Find category = Hair and gender = M?
        // Let's see what keratin's category is, then query based on that.

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

checkServices();
