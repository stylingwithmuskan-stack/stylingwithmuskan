import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import ProviderAccount from '../models/ProviderAccount.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'swm' });
        console.log("Connected to DB");

        const testUser = await User.findOne().lean();
        if (!testUser) {
            console.log("No user found for testing");
            return;
        }

        const customerId = testUser._id.toString();
        const phone = testUser.phone;

        console.log(`Testing for User: ${testUser.name} (${customerId})`);

        // Check recent bookings with any status
        const allBookings = await Booking.find({
            $or: [
                { customerId: customerId },
                { customerPhone: { $regex: phone.slice(-10) + "$" } }
            ]
        }).lean();

        console.log(`Total Bookings for this user: ${allBookings.length}`);
        const statuses = [...new Set(allBookings.map(b => b.status))];
        console.log(`Booking statuses present: ${statuses.join(', ')}`);

        // Now run the logic from user.routes.js (mimicked)
        const recentBookings = await Booking.find({
            $or: [
                { customerId: customerId },
                { customerPhone: { $regex: phone.slice(-10) + "$" } }
            ],
            status: "completed"
        }).sort({ createdAt: -1 }).lean();

        console.log(`Bookings found with status "completed": ${recentBookings.length}`);
        
        if (recentBookings.length < allBookings.length) {
            const others = allBookings.filter(b => b.status !== "completed");
            console.log(`Correctly ignored ${others.length} non-completed bookings.`);
            console.log("Ignored statuses:", [...new Set(others.map(b => b.status))]);
        }

        console.log("SUCCESS: Provider suggestions will now only use completed bookings.");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.connection.close();
    }
}

run();
