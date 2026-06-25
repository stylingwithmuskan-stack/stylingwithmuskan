import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function checkServices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.useDb('test');
        const Service = db.model('Service', new mongoose.Schema({}, { strict: false }));
        
        const hairM = await Service.find({ category: 'Hair', gender: 'M' }).lean();
        console.log(`Total Hair M services: ${hairM.length}`);
        
        const keratin = await Service.findOne({ name: 'Keratin Hair Spa' }).lean();
        console.log('Keratin Hair Spa:', keratin);
        
        const loreal = await Service.findOne({ name: 'Loreal Hair Spa' }).lean();
        console.log('Loreal Hair Spa:', loreal);

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

checkServices();
