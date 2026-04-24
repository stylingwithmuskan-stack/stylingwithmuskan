import mongoose from "mongoose";
import ProviderAccount from "./backend/src/models/ProviderAccount.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "backend/.env") });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const providers = await ProviderAccount.find({
    name: { $in: ["testnew", "abhisekh"] }
  }).lean();

  console.log(`Found ${providers.length} providers`);
  
  for (const p of providers) {
    console.log(`\nProvider: ${p.name}`);
    console.log(`  profilePhoto: "${p.profilePhoto}"`);
    console.log(`  avatar: "${p.avatar}"`);
  }

  process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
