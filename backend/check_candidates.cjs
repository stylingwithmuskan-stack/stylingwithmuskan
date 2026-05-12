/**
 * This script:
 * 1. Finds the latest pending/unassigned booking
 * 2. Finds all approved providers in the same city
 * 3. Rebuilds candidateProviders to include them
 * 4. Saves the booking
 */

const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  await mongoose.connect("mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm?appName=Cluster0");
  console.log("Connected to DB");

  const db = mongoose.connection.db;

  // Get latest booking that has an assignedProvider
  const bookings = await db.collection("bookings")
    .find({ status: { $in: ["pending", "incoming", "unassigned", "vendorEscalated"] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  if (!bookings.length) {
    console.log("No pending/unassigned bookings found.");
    await mongoose.disconnect();
    return;
  }

  for (const b of bookings) {
    const city = b.address?.city || "";
    const zone = b.address?.zone || b.address?.area || "";
    console.log(`\n=== Booking ${b._id} ===`);
    console.log(`  Status: ${b.status}`);
    console.log(`  City: ${city}, Zone: ${zone}`);
    console.log(`  Assigned: ${b.assignedProvider}`);
    console.log(`  Candidates: ${JSON.stringify(b.candidateProviders)}`);
    console.log(`  Rejected: ${JSON.stringify(b.rejectedProviders)}`);
    console.log(`  VendorEscalated: ${b.vendorEscalated}`);

    // Find all approved providers in same city
    const query = { approvalStatus: "approved" };
    if (city) {
      query.$or = [
        { city: { $regex: new RegExp(`^${city}$`, "i") } },
        { cityId: b.address?.cityId }
      ].filter(Boolean);
    }

    const providers = await db.collection("provideraccounts").find(query).toArray();
    console.log(`  Providers in city '${city}': ${providers.length}`);
    for (const p of providers) {
      console.log(`    - ${p.name} (${p._id}) | approved: ${p.approvalStatus} | regComplete: ${p.registrationComplete}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
