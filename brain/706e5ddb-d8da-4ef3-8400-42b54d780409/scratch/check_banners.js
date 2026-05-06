import mongoose from "mongoose";
import { Banner } from "../backend/src/models/Content.js";
import dotenv from "dotenv";

dotenv.config({ path: "../backend/.env" });

async function checkBanners() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const banners = await Banner.find().lean();
    console.log("Total Banners:", banners.length);
    banners.forEach(b => {
      console.log(`- ID: ${b.id}, Gender: ${b.gender}, Title: ${b.title}, Start: ${b.startAt}, End: ${b.endAt}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkBanners();
