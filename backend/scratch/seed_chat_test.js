import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../src/models/User.js";
import ProviderAccount from "../src/models/ProviderAccount.js";
import Booking from "../src/models/Booking.js";
import { Zone } from "../src/models/CityZone.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function seed() {
    const uri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB || "swm";

    if (!uri) {
        console.error("MONGO_URI not found in .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, { dbName });
        console.log("Connected to MongoDB");

        // 1. Create/Update User
        const userPhone = "9990000001";
        let user = await User.findOne({ phone: userPhone });
        if (!user) {
            user = await User.create({
                phone: userPhone,
                name: "Test Customer",
                isVerified: true,
                addresses: [{
                    houseNo: "123",
                    area: "Test Area",
                    city: "Test City",
                    zone: "Test Zone",
                    type: "home"
                }]
            });
            console.log("Created test user:", userPhone);
        } else {
            console.log("Test user already exists:", userPhone);
        }

        // 2. Create/Update Provider
        const providerPhone = "9000001002";
        let provider = await ProviderAccount.findOne({ phone: providerPhone });
        if (!provider) {
            provider = await ProviderAccount.create({
                phone: providerPhone,
                name: "Test Provider",
                approvalStatus: "approved",
                registrationComplete: true,
                isOnline: true,
                gender: "female",
                city: "Test City",
                zones: ["Test Zone"],
                currentLocation: { lat: 28.6139, lng: 77.2090 } // Delhi coordinates
            });
            console.log("Created test provider:", providerPhone);
        } else {
            provider.approvalStatus = "approved";
            provider.registrationComplete = true;
            provider.isOnline = true;
            await provider.save();
            console.log("Updated test provider status:", providerPhone);
        }

        // 3. Create Booking
        // Status 'incoming' so provider can accept it
        const booking = await Booking.create({
            customerId: user._id.toString(),
            customerName: user.name,
            customerPhone: user.phone,
            services: [{
                name: "Test Service",
                price: 500,
                duration: "60 mins",
                category: "Test Category",
                quantity: 1
            }],
            totalAmount: 500,
            address: user.addresses[0],
            slot: { date: "2026-04-21", time: "10:00 AM" },
            status: "incoming",
            assignedProvider: providerPhone,
            bookingType: "pre-book"
        });
        console.log("Created test booking:", booking._id);

        console.log("\n--- SEEDING COMPLETE ---");
        console.log("Provider Phone:", providerPhone, "(OTP: 123456)");
        console.log("User Phone:", userPhone, "(OTP: 123456)");
        console.log("Booking ID:", booking._id);
        console.log("------------------------");

    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
