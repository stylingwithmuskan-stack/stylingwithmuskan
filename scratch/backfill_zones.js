const mongoose = require('mongoose');
const Booking = require('./backend/src/models/Booking.js').default || require('./backend/src/models/Booking.js');
const { City, Zone } = require('./backend/src/models/CityZone.js');
const { pointInPolygon } = require('./backend/src/lib/locationResolution.js');

async function backfillZones() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stylingwithmuskan');
    console.log('Connected to MongoDB');

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

    let updatedCount = 0;
    for (const b of bookings) {
      const lat = b.address.lat;
      const lng = b.address.lng;
      const matchedZone = zones.find(z => pointInPolygon(lat, lng, z.coordinates || []));
      
      if (matchedZone) {
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
