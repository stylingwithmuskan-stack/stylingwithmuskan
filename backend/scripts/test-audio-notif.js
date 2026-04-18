import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { notify } from "../src/lib/notify.js";
import { connectMongo } from "../src/startup/mongo.js";
import { initSocket } from "../src/startup/socket.js";
import { createServer } from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  const recipientId = process.argv[2];
  const role = process.argv[3] || "user";
  const sound = process.argv[4] || "ringtone";

  if (!recipientId) {
    console.error("Usage: node scripts/test-audio-notif.js <recipientId> [role] [sound]");
    console.error("Roles: user, provider, vendor, admin");
    console.error("Sounds: ringtone, doorbell, notification, emergency, success, alert");
    process.exit(1);
  }

  try {
    await connectMongo();
    
    // We need the socket server running or at least initialized to get getIO() working
    const server = createServer();
    initSocket(server);

    console.log(`\n🔔 Sending test notification to ${role} (${recipientId})...`);
    console.log(`🎵 Sound: ${sound}`);

    await notify({
      recipientId,
      recipientRole: role,
      type: "booking_assigned",
      title: "Audio Test",
      message: `This is a test of the ${sound} notification.`,
      meta: { sound },
      emit: true
    });

    console.log("✅ Notification sent! Check your browser.");
    
    // Wait a bit for socket emission
    setTimeout(() => process.exit(0), 2000);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

run();
