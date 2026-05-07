import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const ProviderAccountSchema = new mongoose.Schema({
    phone: String,
    name: String,
    city: String,
    cityId: String,
    approvalStatus: String,
    registrationComplete: Boolean,
    isOnline: Boolean,
    zones: [String],
    zoneIds: [String]
});

const ProviderAccount = mongoose.models.ProviderAccount || mongoose.model("ProviderAccount", ProviderAccountSchema);

async function findMuskan() {
    try {
        console.log("Connecting to:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
        console.log("Connected to MongoDB");

        const providers = await ProviderAccount.find({ 
            name: { $regex: /muskan/i } 
        }).lean();

        if (providers.length === 0) {
            console.log("No provider found with name containing 'Muskan'");
            const all = await ProviderAccount.countDocuments({});
            console.log("Total providers in DB:", all);
        } else {
            providers.forEach(p => {
                console.log("--- Provider Found ---");
                console.log(`ID: ${p._id}`);
                console.log(`Name: ${p.name}`);
                console.log(`City: ${p.city} (ID: ${p.cityId})`);
                console.log(`Status: ${p.approvalStatus}`);
                console.log(`Reg Complete: ${p.registrationComplete}`);
                console.log(`Online: ${p.isOnline}`);
                console.log(`Zones: ${JSON.stringify(p.zones)}`);
                console.log(`Zone IDs: ${JSON.stringify(p.zoneIds)}`);
                
                // Why would this provider be excluded?
                const reasons = [];
                if (!p.isOnline) reasons.push("isOnline is false");
                if (!p.registrationComplete) reasons.push("registrationComplete is false");
                const pendingStatuses = ["pending", "pending_vendor", "pending_admin"];
                if (p.approvalStatus !== "approved" && !pendingStatuses.includes(p.approvalStatus)) {
                    reasons.push(`approvalStatus is ${p.approvalStatus}`);
                }
                
                if (reasons.length > 0) {
                    console.log(`EXCLUSION REASONS: ${reasons.join(", ")}`);
                } else {
                    console.log("SHOULD BE VISIBLE (matches filters)");
                }
            });
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

findMuskan();
