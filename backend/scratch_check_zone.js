import mongoose from 'mongoose';
import { Zone } from './src/models/CityZone.js';
import { pointInPolygon } from './src/lib/locationResolution.js';

const MONGO_URI = "mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm?appName=Cluster0";

async function checkZone() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const zones = await Zone.find({ name: /indore/i }).lean();
    console.log(`Found ${zones.length} matching zones`);

    const lat = 22.6340525;
    const lng = 75.80842930000001;

    for (const zone of zones) {
      console.log(`\nZone: ${zone.name}`);
      console.log(`Status: ${zone.status}`);
      console.log(`Coordinates length: ${zone.coordinates ? zone.coordinates.length : 0}`);
      
      if (zone.coordinates && zone.coordinates.length > 0) {
        console.log(`Coordinates:`, zone.coordinates);
        const inside = pointInPolygon(lat, lng, zone.coordinates);
        console.log(`Point (${lat}, ${lng}) is inside ${zone.name}? -> ${inside}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

checkZone();
