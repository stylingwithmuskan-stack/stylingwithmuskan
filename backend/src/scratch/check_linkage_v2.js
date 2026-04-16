import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI not found');
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        
        const parent = await db.collection('servicetypes').findOne({label: 'Gold Bleach'});
        console.log('--- Parent (Gold Bleach) ---');
        console.log(parent);
        
        if (parent) {
            const pid = parent.id;
            const p_id = String(parent._id);
            
            const cats = await db.collection('categories').find({ $or: [{serviceType: pid}, {serviceType: p_id}] }).toArray();
            console.log('--- Matching Categories for Gold Bleach ---');
            console.log(cats.map(m => ({ name: m.name, serviceType: m.serviceType, id: m.id })));
            
            if (cats.length > 0) {
                const cids = cats.map(c => c.id);
                const c_ids = cats.map(c => String(c._id));
                const svcs = await db.collection('services').find({ $or: [{category: { $in: cids }}, {category: { $in: c_ids }}] }).toArray();
                console.log('--- Matching Services ---');
                console.log(svcs.map(s => ({ name: s.name, category: s.category })));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.connection.close();
    }
}
check();
