const mongoose = require('mongoose');
const Booking = require('./src/models/Booking.js').default || require('./src/models/Booking.js');
const { City, Zone } = require('./src/models/CityZone.js');
const { pointInPolygon } = require('./src/lib/locationResolution.js');

async function backfillZones() {
  try {
    // Try to find MongoDB URI in .env
    const fs = require('fs');
    let mongoUri = 'mongodb://localhost:27017/stylingwithmuskan';
    if (fs.existsSync('.env')) {
      const env = fs.readFileSync('.env', 'utf8');
      const match = env.match(/MONGO_URI=(.*)/);
      const dbMatch = env.match(/MONGO_DB=(.*)/);
      if (match && match[1]) {
        mongoUri = match[1].trim().replace(/^['"]|['"]$/g, '');
        const db = dbMatch && dbMatch[1] ? dbMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
        if (db && !mongoUri.includes('/' + db)) {
          const url = new URL(mongoUri);
          url.pathname = '/' + db;
          mongoUri = url.toString();
        }
      }
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB:', mongoUri);

    const bookings = await Booking.find({
      $or: [
        { 'address.zone': { $in: [null, ''] } },
        { 'address.zone': { $exists: false } }
      ],
      'address.lat': { $ne: null },
      'address.lng': { $ne: null }
    });

    console.log(`Found ${bookings.length} bookings to check for zone resolution`);

    const zones = await Zone.find({ status: 'active' }).lean();
    console.log(`Checking against ${zones.length} active zones`);

    let updatedCount = 0;
    for (const b of bookings) {
      const lat = b.address.lat;
      const lng = b.address.lng;
      
      // Filter out invalid coords
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const matchedZone = zones.find(z => pointInPolygon(lat, lng, z.coordinates || []));
      
      if (matchedZone) {
        console.log(`Updating booking ${b._id} with zone: ${matchedZone.name}`);
        b.address.zone = matchedZone.name;
        b.address.zoneId = matchedZone._id.toString();
        await b.save();
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} bookings with proper zone names`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

backfillZones();
