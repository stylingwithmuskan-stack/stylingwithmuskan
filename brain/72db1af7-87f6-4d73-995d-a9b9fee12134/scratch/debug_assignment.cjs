
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://muskan:muskan@cluster0.v5w09.mongodb.net/muskan?retryWrites=true&w=majority";

async function check() {
  try {
    await mongoose.connect(MONGO_URI);
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }));
    const bookingId = "6a0310422008908c85f11714";
    
    const b = await Booking.findById(bookingId);
    if (!b) {
      console.log("Booking not found!");
      return;
    }
    console.log("--- Booking Data ---");
    console.log("ID:", b._id);
    console.log("Status:", b.status);
    console.log("Assigned Provider:", b.assignedProvider);
    console.log("Rejected Providers:", b.rejectedProviders);
    console.log("Candidate Providers:", b.candidateProviders);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
