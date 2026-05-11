import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "./backend/.env") });

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB;

async function checkUser() {
    try {
        await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
        console.log("Connected to MongoDB");

        const UserSchema = new mongoose.Schema({}, { strict: false });
        const User = mongoose.model("User", UserSchema, "users");

        const phone = "7610416911";
        const user = await User.findOne({ phone });

        if (user) {
            console.log("User FOUND in DB:", JSON.stringify(user, null, 2));
        } else {
            console.log("User NOT FOUND in DB for phone:", phone);
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error("Error:", err);
    }
}

checkUser();
