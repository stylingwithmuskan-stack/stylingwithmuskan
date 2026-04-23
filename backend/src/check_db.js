import mongoose from "mongoose";
import Booking from "./models/Booking.js";
import User from "./models/User.js";
import ProviderAccount from "./models/ProviderAccount.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const phones = ["6261387233", "8349464023", "9999999999", "6268204871"];
  
  for (const phone of phones) {
    const user = await User.findOne({ phone });
    if (!user) {
        console.log(`User not found for phone: ${phone}`);
        continue;
    }
    const customerId = user._id.toString();
    console.log(`\nChecking User: ${user.name} (ID: ${customerId}, Phone: ${phone})`);

    const bookings = await Booking.find({
        $or: [
            { customerId },
            { customerPhone: { $regex: phone.slice(-10) + "$" } }
        ]
    }).lean();

    console.log(`  Found ${bookings.length} bookings`);
    
    for (const b of bookings) {
        console.log(`    - Booking ID: ${b._id}, Status: ${b.status}, Provider: ${b.assignedProvider}`);
        if (b.assignedProvider) {
            const provider = await ProviderAccount.findOne({
                $or: [
                    { _id: mongoose.isValidObjectId(b.assignedProvider) ? b.assignedProvider : null },
                    { phone: b.assignedProvider }
                ].filter(x => x !== null)
            }).lean();
            if (provider) {
                console.log(`      - Provider Found: ${provider.name} (Status: ${provider.approvalStatus})`);
            } else {
                console.log(`      - Provider NOT FOUND for ID/Phone: ${b.assignedProvider}`);
            }
        }
    }
  }

  process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
