import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { computeAvailableSlots } from "./src/lib/availability.js";
import { BookingSettings } from "./src/models/Settings.js";
import { OfficeSettings } from "./src/models/Content.js";

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const bookingSettings = await BookingSettings.findOne().lean();
const officeSettings = await OfficeSettings.findOne().lean();
const settings = { ...bookingSettings, ...officeSettings };

const providerId = "69dced285fc4da918aec2597";
const date = "2026-04-14";

const result = await computeAvailableSlots(providerId, date, settings, { requestedDurationMinutes: 0 });
console.log("Result slots length:", result.slots?.length);
console.log("Result:", result);

mongoose.disconnect();
