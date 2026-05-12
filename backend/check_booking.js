import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb://localhost:27017/stylingwithmuskan", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection.db;
  const bookings = await db.collection("bookings").find().sort({ createdAt: -1 }).limit(1).toArray();
  const b = bookings[0];

  console.log("Latest Booking ID:", b._id.toString());
  console.log("Candidate Providers:", b.candidateProviders);
  console.log("Rejected Providers:", b.rejectedProviders);
  console.log("Assigned Provider:", b.assignedProvider);
  console.log("Vendor Escalated:", b.vendorEscalated);

  await mongoose.disconnect();
}
run().catch(console.error);
