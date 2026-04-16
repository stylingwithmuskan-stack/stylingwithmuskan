import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        
        const parent = await db.collection('servicetypes').findOne({label: 'Gold Bleach'});
        console.log('--- Parent (Gold Bleach) ---');
        console.log(parent);
        
        if (parent) {
            const cats = await db.collection('categories').find({}).toArray();
            console.log('--- Sample Categories ---');
            console.log(cats.slice(0, 5).map(c => ({ name: c.name, serviceType: c.serviceType })));
            
            const matches = cats.filter(c => c.serviceType === parent.id || c.serviceType === String(parent._id));
            console.log('--- Matching Categories for Gold Bleach ---');
            console.log(matches.map(m => ({ name: m.name, serviceType: m.serviceType })));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
check();
