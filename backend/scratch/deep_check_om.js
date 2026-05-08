import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI;
const PHONE = "7223077890"; // Om's phone

async function check() {
  try {
    console.log("Connecting to:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Provider Schema
    const ProviderSchema = new mongoose.Schema({}, { strict: false });
    const ProviderAccount = mongoose.model("ProviderAccount", ProviderSchema, "provideraccounts");

    // PushDevice Schema
    const PushDeviceSchema = new mongoose.Schema({}, { strict: false });
    const PushDevice = mongoose.model("PushDevice", PushDeviceSchema, "pushdevices");

    const p = await ProviderAccount.findOne({ phone: PHONE }).lean();
    if (!p) {
      console.log("❌ Provider Om NOT FOUND with phone:", PHONE);
    } else {
      console.log("✅ Provider Om Found!");
      console.log("ID:", p._id);
      console.log("Name:", p.name);
      console.log("Registration Complete:", p.registrationComplete);
      console.log("Approval Status:", p.approvalStatus);

      const devices = await PushDevice.find({ recipientId: p._id.toString() }).lean();
      console.log("📱 Devices count for Om:", devices.length);
      devices.forEach((d, i) => {
        console.log(`Device ${i+1}:`, {
          platform: d.platform,
          isActive: d.isActive,
          fcmToken: d.fcmToken ? d.fcmToken.substring(0, 10) + "..." : "NONE",
          lastSeenAt: d.lastSeenAt,
          lastError: d.lastError
        });
      });

      if (devices.length === 0) {
          console.log("\n⚠️ No devices registered. Front-end initialization is failing.");
      } else {
          const active = devices.filter(d => d.isActive);
          if (active.length === 0) {
              console.log("\n⚠️ Devices exist but NONE ARE ACTIVE.");
          }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

check();
