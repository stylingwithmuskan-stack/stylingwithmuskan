import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const OfficeSettings = (await import("./src/models/Content.js")).OfficeSettings;
const settings = await OfficeSettings.findOne().lean();
console.log("Office settings:", settings);

mongoose.disconnect();
