import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Category, ServiceType } from "./src/models/Content.js";
import { providerMatchesRequestedSpecialties, resolveRequestedSpecialtySets } from "./src/lib/serviceMatching.js";

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const ProviderAccount = (await import("./src/models/ProviderAccount.js")).default;

const provider = await ProviderAccount.findById("69dced285fc4da918aec2597").lean();

// Assuming frontend passed one of these:
const serviceTypes = ["1776..."]; // I can't see the exact ID from user image but let's try some
const categories = ["hair care"]; 

const requestedSpecialties = await resolveRequestedSpecialtySets({
  categoryValues: categories,
  serviceTypeValues: serviceTypes,
});

console.log("provider primaryCategory:", provider.documents.primaryCategory);
console.log("provider specializations:", provider.documents.specializations);
console.log("provider services:", provider.documents.services);
console.log("Requested specialties:", requestedSpecialties);

const matched = providerMatchesRequestedSpecialties(provider, requestedSpecialties);
console.log("Matched?", matched);

mongoose.disconnect();
