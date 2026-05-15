import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function run() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB || "swm";
  if (!uri) throw new Error("MONGO_URI not found in .env");
  
  await mongoose.connect(uri, { dbName });
  const ProviderAccount = mongoose.model("ProviderAccount", new mongoose.Schema({}, { strict: false }), "providers");
  const Service = mongoose.model("Service", new mongoose.Schema({}, { strict: false }), "services");
  const Category = mongoose.model("Category", new mongoose.Schema({}, { strict: false }), "categories");

  const muskanId = "6a0757b58e520435ef3d0148";
  const omId = "69fc5a00ce10242dbce45b1f";

  const muskan = await ProviderAccount.findById(muskanId).lean();
  const om = await ProviderAccount.findById(omId).lean();

  console.log("--- MUSKAN ---");
  console.log("ID:", muskan?._id);
  console.log("Categories:", muskan?.categories);
  console.log("Documents Specialties:", muskan?.documents?.specializations);
  console.log("Service Types:", muskan?.serviceTypes);
  console.log("Documents Primary Category:", muskan?.documents?.primaryCategory);
  console.log("Services:", muskan?.services);
  console.log("Pending Category Requests:", muskan?.pendingCategoryRequests);

  console.log("\n--- OM ---");
  console.log("ID:", om?._id);
  console.log("Categories:", om?.categories);
  console.log("Documents Specialties:", om?.documents?.specializations);
  console.log("Service Types:", om?.serviceTypes);
  console.log("Documents Primary Category:", om?.documents?.primaryCategory);
  console.log("Services:", om?.services);
  console.log("Pending Category Requests:", om?.pendingCategoryRequests);

  // Check Mehndi category ID
  const mehndiCat = await Category.findOne({ name: /mehndi/i }).lean();
  console.log("\n--- MEHNDI CATEGORY ---");
  console.log("ID:", mehndiCat?.id || mehndiCat?._id);
  console.log("Name:", mehndiCat?.name);

  // Check Hair Studio category ID
  const hairCat = await Category.findOne({ name: /hair/i }).lean();
  console.log("\n--- HAIR CATEGORY ---");
  console.log("ID:", hairCat?.id || hairCat?._id);
  console.log("Name:", hairCat?.name);

  await mongoose.disconnect();
}

run().catch(console.error);
