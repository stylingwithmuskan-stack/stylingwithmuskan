import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB;
    await mongoose.connect(uri, { dbName });
    const db = mongoose.connection.db;
    
    const targetLabels = ['hair service', 'nails', 'skin care'];
    const parents = await db.collection('servicetypes').find({ label: { $in: targetLabels } }).toArray();
    console.log('--- Parents Found ---');
    console.log(parents.map(p => ({ label: p.label, id: p.id, _id: String(p._id) })));

    for(const p of parents) {
      const cats = await db.collection('categories').find({ $or: [{serviceType: p.id}, {serviceType: String(p._id)}] }).toArray();
      console.log(`\n--- Categories for ${p.label} ---`);
      console.log(cats.map(c => ({ name: c.name, serviceType: c.serviceType, gender: c.gender, id: c.id })));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
