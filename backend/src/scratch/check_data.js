import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI;

const ServiceTypeSchema = new mongoose.Schema({
  id: String,
  label: String,
});

const CategorySchema = new mongoose.Schema({
  id: String,
  name: String,
  serviceType: String,
  gender: String,
});

const ServiceSchema = new mongoose.Schema({
  id: String,
  name: String,
  category: String,
  gender: String,
});

const ServiceType = mongoose.model("ServiceType", ServiceTypeSchema);
const Category = mongoose.model("Category", CategorySchema);
const Service = mongoose.model("Service", ServiceSchema);

async function checkData() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, { dbName: process.env.MONGO_DB || "swm" });
    console.log("Connected to DB:", mongoose.connection.name);

    const serviceCounts = await Service.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);
    const serviceCountsMap = new Map(serviceCounts.map(s => [s._id, s.count]));

    const allCategories = await Category.find().lean();
    console.log(`\n--- All Categories (${allCategories.length}) with Service Counts ---`);
    allCategories.forEach(c => {
      const count = serviceCountsMap.get(c.id) || 0;
      console.log(`${c.name} (${c.id}) - ST: ${c.serviceType}, Gender: ${c.gender}, Services: ${count}`);
    });

    const orphanServices = await Service.find({ category: { $nin: allCategories.map(c => c.id) } }).lean();
    console.log(`\n--- Orphan Services (Category not in Category collection) (${orphanServices.length}) ---`);
    orphanServices.slice(0, 5).forEach(s => console.log(`${s.name} (${s.id}) - Category: ${s.category}`));


    const types = await ServiceType.find().lean();
    console.log("\n--- All Service Types ---");
    types.forEach(t => console.log(`${t.label} (${t.id})`));

    const totalCategories = await Category.countDocuments();
    const totalServices = await Service.countDocuments();
    console.log(`\nTotal Categories in DB: ${totalCategories}`);
    console.log(`Total Services in DB: ${totalServices}`);

    // Check for any services that might be missing categories
    const services = await Service.find().limit(10).lean();
    console.log("\n--- Sample Services ---");
    console.log(services.map(s => `${s.name} (${s.id}) - Category: ${s.category}`));

    await mongoose.disconnect();
    console.log("\nDisconnected.");
  } catch (err) {
    console.error("Error:", err);
  }
}

checkData();
