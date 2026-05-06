import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import ProviderAccount from "../src/models/ProviderAccount.js";

async function checkProvider() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'swm' });
    console.log("Connected to MongoDB");

    const id = "69e8856339906ab7bdba6287";
    const provider = await ProviderAccount.findById(id);
    
    if (!provider) {
      console.log("Provider not found");
    } else {
      console.log("Provider found:");
      console.log(JSON.stringify(provider, null, 2));
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkProvider();
