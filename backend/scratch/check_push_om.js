import mongoose from "mongoose";
import PushDevice from "../src/models/PushDevice.js";
import ProviderAccount from "../src/models/ProviderAccount.js";
import { MONGO_URI } from "../src/config.js";

async function check() {
  await mongoose.connect(MONGO_URI);
  const p = await ProviderAccount.findOne({ phone: "7223077890" }).lean();
  if (!p) {
    console.log("Provider Om not found");
    process.exit(0);
  }
  console.log("Provider Om ID:", p._id);
  const devices = await PushDevice.find({ recipientId: p._id.toString() }).lean();
  console.log("Devices found for Om:", devices.length);
  devices.forEach(d => {
    console.log(`- Token: ${d.fcmToken.slice(-6)}, Active: ${d.isActive}, Platform: ${d.platform}`);
  });
  process.exit(0);
}

check();
