import mongoose from "mongoose";
import ProviderAccount from "./src/models/ProviderAccount.js";

async function check() {
  await mongoose.connect("mongodb://127.0.0.1:27017/stylingwithmuskan");
  const p = await ProviderAccount.findOne({ name: /sangeeta/i }).lean();
  console.log(p ? p.name : "Not found");
  if (p) {
    console.log("Specializations:", p.documents?.specializations);
    console.log("Primary Category:", p.documents?.primaryCategory);
    console.log("Service Types:", p.serviceTypes);
    console.log("Categories:", p.categories);
  }
  process.exit(0);
}
check();
