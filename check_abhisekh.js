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

  const p = await ProviderAccount.findOne({ name: /abhisekh/i }).lean();
  if (p) {
    console.log(`Provider: ${p.name}`);
    console.log(`  Categories (primaryCategory):`, p.documents?.primaryCategory);
    console.log(`  Specializations:`, p.documents?.specializations);
  } else {
    console.log("Provider not found");
  }

  process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
