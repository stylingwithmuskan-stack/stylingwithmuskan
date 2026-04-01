import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/swm';

async function dropGeoIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const zonesCollection = db.collection('zones');

    // Get all indexes
    const indexes = await zonesCollection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // Drop any geospatial index on coordinates
    for (const index of indexes) {
      if (index.key && index.key.coordinates) {
        console.log(`Dropping index: ${index.name}`);
        await zonesCollection.dropIndex(index.name);
        console.log(`✓ Dropped index: ${index.name}`);
      }
    }

    console.log('✓ Migration complete');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

dropGeoIndex();
