import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

// Minimal schemas for reading
const CommissionSettingsSchema = new mongoose.Schema({ rate: Number, minPayout: Number }, { timestamps: true });
const SubscriptionSettingsSchema = new mongoose.Schema({ providerDefaultCommissionRate: Number, vendorPerformanceCommissionValue: Number }, { timestamps: true });

const CommissionSettings = mongoose.model("CommissionSettings", CommissionSettingsSchema, "commissionsettings");
const SubscriptionSettings = mongoose.model("SubscriptionSettings", SubscriptionSettingsSchema, "subscriptionsettings");

async function checkCommission() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error("MONGO_URI not found in .env");
        
        await mongoose.connect(uri, { dbName: process.env.MONGO_DB || "swm" });
        console.log("Connected to MongoDB");

        const commission = await CommissionSettings.findOne().lean();
        const subscription = await SubscriptionSettings.findOne().lean();

        console.log("--- Commission Settings ---");
        console.log(JSON.stringify(commission, null, 2));
        
        console.log("\n--- Subscription Settings ---");
        console.log(JSON.stringify(subscription, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
}

checkCommission();
