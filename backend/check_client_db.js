import mongoose from "mongoose";
import { ServiceType, Category } from "./src/models/Content.js";

const CLIENT_MONGO_URI = "mongodb+srv://stylingwithmuskan_db_user:stylewithmuskan6118@cluster0.ls0uuhc.mongodb.net/?appName=Cluster0";
const MONGO_DB = "swm";

async function run() {
  try {
    await mongoose.connect(CLIENT_MONGO_URI, { dbName: MONGO_DB });
    
    const typeCount = await ServiceType.countDocuments();
    const catCount = await Category.countDocuments();
    
    console.log(`CLIENT DB Counts - ServiceTypes: ${typeCount}, Categories: ${catCount}`);
    
    const types = await ServiceType.find().lean();
    console.log("\nService Types:");
    types.forEach(t => console.log(`- ${t.label} (${t.id})`));
    
    const cats = await Category.find().lean();
    console.log("\nCategories:");
    cats.forEach(c => console.log(`- ${c.name} (ID: ${c.id}, ServiceTypeRef: ${c.serviceType}, Gender: ${c.gender})`));

  } catch (err) {
    console.error("Failed to connect to Client DB:", err.message);
  }
  process.exit(0);
}

run();
