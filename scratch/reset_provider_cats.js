import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../backend/.env") });

const providerSchema = new mongoose.Schema({
    email: String,
    documents: {
        primaryCategory: [String]
    }
}, { strict: false });

const ProviderAccount = mongoose.model("ProviderAccount", providerSchema, "provideraccounts");

async function resetCategories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const email = "testnew@gmail.com";
        const result = await ProviderAccount.findOneAndUpdate(
            { email: email },
            { $set: { "documents.primaryCategory": ["Mendhi"] } },
            { new: true }
        );

        if (result) {
            console.log("Successfully reset categories for:", email);
            console.log("New Categories:", result.documents.primaryCategory);
        } else {
            console.log("Provider not found with email:", email);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
}

resetCategories();
