import mongoose from "mongoose";
import ProviderAccount from "../src/models/ProviderAccount.js";
import { MONGO_URI, MONGO_DB } from "../src/config.js";

async function check() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  await mongoose.connect(uri);
  const p = await ProviderAccount.findOne({ name: /Om/i }).lean();
  console.log("PROVIDER_DATA:", JSON.stringify(p, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
