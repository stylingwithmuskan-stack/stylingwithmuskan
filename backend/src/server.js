import dotenv from "dotenv";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.REDIS_URL) process.env.REDIS_URL = "memory";

import { createServer } from "http";
import app from "./app.js";
import { connectMongo } from "./startup/mongo.js";
import { connectRedis } from "./startup/redis.js";
import { configureCloudinary } from "./startup/cloudinary.js";
import { initSocket } from "./startup/socket.js";
import { startCron } from "./startup/cron.js";
import { startAssignmentScheduler } from "./startup/assignmentScheduler.js";

const PORT = process.env.PORT || 3001;

async function boot() {
  try {
    await connectMongo();
    console.log('[Server] ✅ MongoDB connected successfully');
  } catch (err) {
    console.error('[Server] ❌ MongoDB connection failed:', err.message);
    console.error('[Server] ⚠️  Server will NOT start without database connection');
    console.error('\n[Server] 💡 Quick fixes:');
    console.error('   1. Check MongoDB Atlas IP whitelist');
    console.error('   2. Verify internet connection');
    console.error('   3. Check .env MONGO_URI credentials\n');
    process.exit(1);
  }

  try {
    await connectRedis();
    console.log('[Server] ✅ Redis connected successfully');
  } catch (err) {
    console.warn('[Server] ⚠️  Redis connection failed, using in-memory fallback');
  }

  configureCloudinary();

  const server = createServer(app);
  initSocket(server);
  const port = Number(PORT);
  
  server.listen(port, () => {
    console.log(`\n[Server] 🚀 API listening on http://localhost:${port}`);
    console.log(`[Server] 📝 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[Server] 🗄️  Database: ${process.env.MONGO_DB || "swm"}`);
    console.log(`[Server] ✨ Server ready to accept requests\n`);
    
    startCron();
    startAssignmentScheduler();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] ❌ Port ${port} is already in use`);
      console.error('[Server] 💡 Try: kill the process using this port or use a different port\n');
    } else {
      console.error('[Server] ❌ Server error:', err);
    }
    process.exit(1);
  });
}

boot().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
