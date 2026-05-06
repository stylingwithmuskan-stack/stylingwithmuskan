import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "./.env") });

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'swm' });
        console.log("Connected to DB:", process.env.MONGO_DB);

        const ProviderAccount = mongoose.model("ProviderAccount", new mongoose.Schema({}, { strict: false }));
        const City = mongoose.model("City", new mongoose.Schema({}, { strict: false }), "cities");
        const Zone = mongoose.model("Zone", new mongoose.Schema({}, { strict: false }), "zones");

        const provider = await ProviderAccount.findOne({ phone: "9100000004" }).lean();
        if (!provider) {
            console.log("Provider not found");
            return;
        }

        console.log("Provider Info:");
        console.log(" - Name:", provider.name);
        console.log(" - City:", provider.city);
        console.log(" - CityId:", provider.cityId);
        console.log(" - Current Zones:", provider.zones);

        let cityDoc = null;
        if (provider.cityId) {
            cityDoc = await City.findById(provider.cityId).lean();
        } else if (provider.city) {
            cityDoc = await City.findOne({ name: new RegExp(`^${provider.city}$`, "i") }).lean();
        }

        if (!cityDoc) {
            console.log("City not found for provider");
        } else {
            console.log("City Found:", cityDoc.name, "(ID:", cityDoc._id, ")");
            const activeZones = await Zone.find({ city: cityDoc._id, status: "active" }).lean();
            console.log("Active Zones in this city:", activeZones.map(z => z.name));
            console.log("Raw Active Zones:", JSON.stringify(activeZones, null, 2));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
