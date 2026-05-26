/**
 * One-time script to reactivate user push devices that were incorrectly deactivated.
 * 
 * Run: node reactivate_user_devices.cjs
 * 
 * This fixes the issue where user push notifications stopped working because
 * devices were deactivated due to race conditions in the frontend.
 */
const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const PushDevice = mongoose.model("PushDevice", new mongoose.Schema({}, { strict: false }), "pushdevices");

  // Count current state
  const totalUser = await PushDevice.countDocuments({ recipientRole: "user" });
  const activeUser = await PushDevice.countDocuments({ recipientRole: "user", isActive: true });
  const inactiveUser = await PushDevice.countDocuments({ recipientRole: "user", isActive: false });

  const totalProvider = await PushDevice.countDocuments({ recipientRole: "provider" });
  const activeProvider = await PushDevice.countDocuments({ recipientRole: "provider", isActive: true });

  console.log("\n📊 Current State:");
  console.log(`   Users:     ${totalUser} total, ${activeUser} active, ${inactiveUser} inactive`);
  console.log(`   Providers: ${totalProvider} total, ${activeProvider} active`);

  // Reactivate user devices that were deactivated by client logout or token transfer
  // Only reactivate devices that have a valid fcmToken and were deactivated recently
  const result = await PushDevice.updateMany(
    {
      recipientRole: "user",
      isActive: false,
      fcmToken: { $exists: true, $ne: "" },
      // Only reactivate devices deactivated by known race condition errors
      $or: [
        { lastError: "Unregistered by client logout" },
        { lastError: "Token transferred to another session/user" },
        { lastError: "" },
        { lastError: { $exists: false } },
      ]
    },
    {
      $set: {
        isActive: true,
        lastError: "",
        lastSeenAt: new Date(),
      }
    }
  );

  console.log(`\n✅ Reactivated ${result.modifiedCount} user push devices`);

  // Final state
  const finalActive = await PushDevice.countDocuments({ recipientRole: "user", isActive: true });
  console.log(`   Users now active: ${finalActive}`);

  await mongoose.disconnect();
  console.log("\n🏁 Done!");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
