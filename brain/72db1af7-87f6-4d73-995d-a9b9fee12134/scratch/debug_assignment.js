
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://muskan:muskan@cluster0.v5w09.mongodb.net/muskan?retryWrites=true&w=majority";

async function check() {
  await mongoose.connect(MONGO_URI);
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
  const bookingId = "6a0310422008908c85f11714";
  
  const b = await Booking.findById(bookingId);
  console.log("--- Booking Data ---");
  console.log("ID:", b._id);
  console.log("Status:", b.status);
  console.log("Assigned Provider:", b.assignedProvider);
  console.log("Rejected Providers:", b.rejectedProviders);
  console.log("Candidate Providers:", b.candidateProviders);
  
  await mongoose.disconnect();
}

check();
