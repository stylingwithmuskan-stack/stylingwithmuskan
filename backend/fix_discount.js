import mongoose from "mongoose";
import Booking from "./src/models/Booking.js";
import { connectDB } from "./src/config.js";

async function fixBooking() {
  try {
    await connectDB();
    
    // Find the booking with ID ending in 438E61 (it's an ObjectId but they display the last 6 chars)
    // Or we can just find it by customer name Mahima Sharma and totalAmount 5648
    const bookings = await Booking.find({ 
        customerName: "Mahima Sharma",
        totalAmount: 5648,
        bookingType: "customized"
    }).sort({ createdAt: -1 }).limit(1);

    if (bookings.length > 0) {
        const booking = bookings[0];
        console.log("Found booking:", booking._id.toString());
        
        booking.discount = 448;
        booking.discountFundedBy = "admin";
        
        await booking.save();
        console.log("Successfully updated booking with discount.");
    } else {
        console.log("Booking not found.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fixBooking();
