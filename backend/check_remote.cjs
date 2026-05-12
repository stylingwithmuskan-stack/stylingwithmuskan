const mongoose = require("mongoose");

async function run() {
  await mongoose.connect("mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm?appName=Cluster0");

  const db = mongoose.connection.db;
  
  const idStr = "69fc5a00ce10242dbce45b1f";
  
  // Is it a provider?
  const prov = await db.collection("provideraccounts").findOne({ _id: new mongoose.Types.ObjectId(idStr) });
  console.log("Is Provider?", !!prov);
  if (prov) console.log("Provider Name:", prov.name);

  // Is it a booking?
  const booking = await db.collection("bookings").findOne({ _id: new mongoose.Types.ObjectId(idStr) });
  console.log("Is Booking?", !!booking);
  if (booking) {
    console.log("Candidate Providers:", booking.candidateProviders);
    console.log("Rejected Providers:", booking.rejectedProviders);
    console.log("Assigned Provider:", booking.assignedProvider);
    console.log("Vendor Escalated:", booking.vendorEscalated);
  }

  // Find latest booking
  const latestBookings = await db.collection("bookings").find().sort({ createdAt: -1 }).limit(1).toArray();
  if (latestBookings.length > 0) {
    const b = latestBookings[0];
    console.log("\n--- LATEST BOOKING ---");
    console.log("ID:", b._id.toString());
    console.log("Candidate Providers:", b.candidateProviders);
    console.log("Rejected Providers:", b.rejectedProviders);
    console.log("Assigned Provider:", b.assignedProvider);
  }

  await mongoose.disconnect();
}
run().catch(console.error);
