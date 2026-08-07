import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

async function checkCats() {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/swm';
        await mongoose.connect(uri);
        const db = mongoose.connection.useDb('swm');
        const Category = db.model('Category', new mongoose.Schema({}, { strict: false }));
        const Service = db.model('Service', new mongoose.Schema({}, { strict: false }));
        
        const categories = await Category.find({}).lean();
        console.log('--- Categories and their genders ---');
        categories.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}, Gender: ${c.gender}`);
        });

        // Let's also look at a service to see what its category is
        const oneService = await Service.findOne({}).lean();
        console.log('\n--- One service ---');
        console.log(oneService);

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}

checkCats();
