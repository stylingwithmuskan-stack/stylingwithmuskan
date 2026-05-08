import mongoose from "mongoose";
import PushDevice from "../src/models/PushDevice.js";
import ProviderAccount from "../src/models/ProviderAccount.js";
import User from "../src/models/User.js";
import { MONGO_URI } from "../src/config.js";

async function check() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    // Find Om as Provider
    const p = await ProviderAccount.findOne({ phone: "7223077890" }).lean();
    if (p) {
      console.log("Provider Om found (ID: " + p._id + ")");
      const pDevices = await PushDevice.find({ recipientId: p._id.toString() }).lean();
      console.log("Provider Devices found:", pDevices.length);
      pDevices.forEach(d => console.log(`  - [${d.platform}] Token: ...${d.fcmToken.slice(-6)} (Active: ${d.isActive})`));
    } else {
      console.log("Provider Om not found.");
    }

    // Find Om as User
    const u = await User.findOne({ phone: "7223077890" }).lean();
    if (u) {
      console.log("User Om found (ID: " + u._id + ")");
      const uDevices = await PushDevice.find({ recipientId: u._id.toString() }).lean();
      console.log("User Devices found:", uDevices.length);
      uDevices.forEach(d => console.log(`  - [${d.platform}] Token: ...${d.fcmToken.slice(-6)} (Active: ${d.isActive})`));
    } else {
      console.log("User Om not found.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  }
}

check();
