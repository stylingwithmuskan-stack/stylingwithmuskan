import mongoose from "mongoose";
import ProviderAccount from "./models/ProviderAccount.js";
import { Service, Category, ServiceType } from "./models/Content.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB\n");

  // 1. Find Om provider
  const om = await ProviderAccount.findOne({ name: /om/i }).lean();
  if (om) {
    console.log("=== OM PROVIDER ===");
    console.log("Name:", om.name);
    console.log("Status:", om.approvalStatus);
    console.log("categories:", JSON.stringify(om.categories));
    console.log("serviceTypes:", JSON.stringify(om.serviceTypes));
    console.log("services:", JSON.stringify(om.services));
    console.log("documents.primaryCategory:", JSON.stringify(om.documents?.primaryCategory));
    console.log("documents.specializations:", JSON.stringify(om.documents?.specializations));
    console.log("documents.services:", JSON.stringify(om.documents?.services));
  } else {
    console.log("Om provider NOT FOUND!");
  }

  // 2. Find all Mehndi-related services
  console.log("\n=== MEHNDI SERVICES (in Service collection) ===");
  const mehndiServices = await Service.find({ name: /meh/i }).lean();
  if (mehndiServices.length === 0) {
    console.log("No Mehndi services found!");
  }
  for (const s of mehndiServices) {
    console.log(`  ID: ${s.id}, Name: ${s.name}, Category: ${s.category}, ServiceType: ${s.serviceType}`);
  }

  // 3. Find Mehndi categories
  console.log("\n=== MEHNDI CATEGORIES (in Category collection) ===");
  const mehndiCats = await Category.find({ name: /meh/i }).lean();
  if (mehndiCats.length === 0) {
    console.log("No Mehndi categories found!");
  }
  for (const c of mehndiCats) {
    console.log(`  ID: ${c.id}, Name: ${c.name}`);
  }

  // 4. Find Mehndi service types
  console.log("\n=== MEHNDI SERVICE TYPES (in ServiceType collection) ===");
  const mehndiTypes = await ServiceType.find({ label: /meh/i }).lean();
  if (mehndiTypes.length === 0) {
    console.log("No Mehndi service types found!");
  }
  for (const t of mehndiTypes) {
    console.log(`  ID: ${t.id}, Label: ${t.label}`);
  }

  // 5. List ALL categories to show what exists
  console.log("\n=== ALL CATEGORIES ===");
  const allCats = await Category.find({}).lean();
  for (const c of allCats) {
    console.log(`  ID: ${c.id}, Name: ${c.name}`);
  }

  // 6. List ALL service types
  console.log("\n=== ALL SERVICE TYPES ===");
  const allTypes = await ServiceType.find({}).lean();
  for (const t of allTypes) {
    console.log(`  ID: ${t.id}, Label: ${t.label}`);
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
