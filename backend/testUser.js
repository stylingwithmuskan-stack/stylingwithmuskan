import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const User = (await import("./src/models/User.js")).default;
const users = await User.find({ "addresses.zone": "bhaverkuaa" }).lean();
console.log("Users with bhaverkuaa:", users.length);
if (users.length > 0) {
    console.log("Address:", JSON.stringify(users[0].addresses, null, 2));
}

mongoose.disconnect();
