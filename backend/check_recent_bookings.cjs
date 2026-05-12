const mongoose = require('mongoose');
const Booking = require('./src/models/Booking');

async function check() {
    try {
        const uri = "mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/swm";
        await mongoose.connect(uri);
        
        // Find recent customized bookings
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentBookings = await Booking.find({ 
            bookingType: "customized",
            createdAt: { $gte: fiveMinsAgo }
        }).sort({ createdAt: -1 });

        console.log(`Found ${recentBookings.length} recent customized bookings.`);
        recentBookings.forEach(b => {
            console.log(`ID: ${b._id}, Customer: ${b.customerName}, Status: ${b.status}, CreatedAt: ${b.createdAt}`);
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

check();
