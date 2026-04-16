import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const ProviderAccount = mongoose.connection.collection("provideraccounts");

const zoneGuess = "bhaverkuaa";
const regex = new RegExp(`^bhaverkuaa$`, "i");

const baseQ = {
  approvalStatus: { $in: ["approved", "pending", "pending_vendor", "pending_admin"] },
  registrationComplete: true,
  isOnline: true,
};

const q = {
  ...baseQ,
  cityId: "69d8d3d87bc783bd79187d55",
  $or: [
    { zones: { $in: [regex] } },
    { pendingZones: { $in: [regex] } },
  ]
};

const providers = await ProviderAccount.find(q).toArray();
console.log("Providers length for cityId + bhaverkuaa:", providers.length);

mongoose.disconnect();
