import mongoose from "mongoose";
import ProviderAccount from "./src/models/ProviderAccount.js";
import { MONGO_URI, MONGO_DB } from "./src/config.js";

async function check() {
  const uri = MONGO_URI.includes('?') ? MONGO_URI.replace('?', `${MONGO_DB || 'swm'}?`) : `${MONGO_URI}/${MONGO_DB || 'swm'}`;
  await mongoose.connect(uri);
  const providers = await ProviderAccount.find({ approvalStatus: 'approved' }, 'name phone approvalStatus isOnline registrationComplete').lean();
  console.log("APPROVED_PROVIDERS:", JSON.stringify(providers, null, 2));
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
