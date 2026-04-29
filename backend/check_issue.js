import mongoose from "mongoose";
import ProviderAccount from "./src/models/ProviderAccount.js";
import Booking from "./src/models/Booking.js";
import User from "./src/models/User.js";
import { City, Zone } from "./src/models/CityZone.js";
import { MONGO_URI, MONGO_DB } from "./src/config.js";

async function checkIssue() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  console.log("🔌 Connecting to database...\n");
  await mongoose.connect(uri);

  // 1. Check all providers
  console.log("=" .repeat(80));
  console.log("📋 CHECKING ALL PROVIDERS");
  console.log("=".repeat(80));
  const allProviders = await ProviderAccount.find({}).lean();
  console.log(`Total Providers: ${allProviders.length}\n`);

  allProviders.forEach((p, idx) => {
    console.log(`Provider #${idx + 1}:`);
    console.log(`  ID: ${p._id}`);
    console.log(`  Name: ${p.name}`);
    console.log(`  Phone: ${p.phone}`);
    console.log(`  City: ${p.city}`);
    console.log(`  Zones: ${JSON.stringify(p.zones || [])}`);
    console.log(`  Service Zone IDs: ${JSON.stringify(p.serviceZoneIds || [])}`);
    console.log(`  Zone IDs: ${JSON.stringify(p.zoneIds || [])}`);
    console.log(`  Base Zone ID: ${p.baseZoneId || 'N/A'}`);
    console.log(`  City ID: ${p.cityId || 'N/A'}`);
    console.log(`  Approval Status: ${p.approvalStatus}`);
    console.log(`  Registration Complete: ${p.registrationComplete}`);
    console.log(`  Is Online: ${p.isOnline}`);
    console.log(`  Categories: ${JSON.stringify(p.categories || [])}`);
    console.log(`  Service Types: ${JSON.stringify(p.serviceTypes || [])}`);
    console.log("");
  });

  // 2. Check recent bookings
  console.log("=".repeat(80));
  console.log("📋 CHECKING RECENT BOOKINGS");
  console.log("=".repeat(80));
  const recentBookings = await Booking.find({}).sort({ createdAt: -1 }).limit(5).lean();
  console.log(`Recent Bookings: ${recentBookings.length}\n`);

  recentBookings.forEach((b, idx) => {
    console.log(`Booking #${idx + 1}:`);
    console.log(`  ID: ${b._id}`);
    console.log(`  Customer ID: ${b.customerId}`);
    console.log(`  Status: ${b.status}`);
    console.log(`  Booking Type: ${b.bookingType}`);
    console.log(`  Slot Date: ${b.slot?.date}`);
    console.log(`  Slot Time: ${b.slot?.time}`);
    console.log(`  Address City: ${b.address?.city}`);
    console.log(`  Address Zone: ${b.address?.zone}`);
    console.log(`  Address Area: ${b.address?.area}`);
    console.log(`  Services: ${JSON.stringify(b.services?.map(s => s.name) || b.items?.map(i => i.name) || [])}`);
    console.log(`  Assigned Provider: ${b.assignedProvider || 'Not assigned'}`);
    console.log("");
  });

  // 3. Check users with addresses
  console.log("=".repeat(80));
  console.log("📋 CHECKING USERS WITH ADDRESSES");
  console.log("=".repeat(80));
  const usersWithAddresses = await User.find({ addresses: { $exists: true, $ne: [] } }).limit(3).lean();
  console.log(`Users with Addresses: ${usersWithAddresses.length}\n`);

  usersWithAddresses.forEach((u, idx) => {
    console.log(`User #${idx + 1}:`);
    console.log(`  ID: ${u._id}`);
    console.log(`  Name: ${u.name}`);
    console.log(`  Phone: ${u.phone}`);
    if (u.addresses && u.addresses.length > 0) {
      u.addresses.forEach((addr, addrIdx) => {
        console.log(`  Address #${addrIdx + 1}:`);
        console.log(`    House No: ${addr.houseNo}`);
        console.log(`    Area: ${addr.area}`);
        console.log(`    City: ${addr.city}`);
        console.log(`    Zone: ${addr.zone}`);
        console.log(`    City ID: ${addr.cityId || 'N/A'}`);
        console.log(`    Zone ID: ${addr.zoneId || 'N/A'}`);
        console.log(`    Lat/Lng: ${addr.lat}, ${addr.lng}`);
      });
    }
    console.log("");
  });

  // 4. Check cities and zones
  console.log("=".repeat(80));
  console.log("📋 CHECKING CITIES AND ZONES");
  console.log("=".repeat(80));
  const cities = await City.find({}).lean();
  console.log(`Total Cities: ${cities.length}\n`);

  for (const city of cities) {
    console.log(`City: ${city.name} (ID: ${city._id})`);
    const zones = await Zone.find({ city: city._id }).lean();
    console.log(`  Zones: ${zones.length}`);
    zones.forEach(z => {
      console.log(`    - ${z.name} (ID: ${z._id}, Status: ${z.status})`);
    });
    console.log("");
  }

  // 5. Check specific issue: Indore + Rajani Palace Colony
  console.log("=".repeat(80));
  console.log("🔍 SPECIFIC ISSUE CHECK: Indore + Rajani Palace Colony");
  console.log("=".repeat(80));
  
  const indoreCity = await City.findOne({ name: /Indore/i }).lean();
  if (indoreCity) {
    console.log(`✅ Found Indore City: ${indoreCity.name} (ID: ${indoreCity._id})\n`);
    
    const indoreZones = await Zone.find({ city: indoreCity._id }).lean();
    console.log(`Zones in Indore: ${indoreZones.length}`);
    indoreZones.forEach(z => {
      console.log(`  - ${z.name} (ID: ${z._id}, Status: ${z.status})`);
    });
    console.log("");

    // Check providers in Indore
    const indoreProviders = await ProviderAccount.find({
      $or: [
        { city: /Indore/i },
        { cityId: indoreCity._id.toString() }
      ]
    }).lean();
    
    console.log(`Providers in Indore: ${indoreProviders.length}`);
    indoreProviders.forEach(p => {
      console.log(`  - ${p.name} (${p.phone})`);
      console.log(`    City: ${p.city}, City ID: ${p.cityId}`);
      console.log(`    Zones: ${JSON.stringify(p.zones || [])}`);
      console.log(`    Zone IDs: ${JSON.stringify(p.zoneIds || [])}`);
      console.log(`    Service Zone IDs: ${JSON.stringify(p.serviceZoneIds || [])}`);
      console.log(`    Online: ${p.isOnline}, Approved: ${p.approvalStatus}`);
      console.log(`    Categories: ${JSON.stringify(p.categories || [])}`);
    });
  } else {
    console.log(`❌ Indore City NOT FOUND in database`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Database check complete!");
  process.exit(0);
}

checkIssue().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
