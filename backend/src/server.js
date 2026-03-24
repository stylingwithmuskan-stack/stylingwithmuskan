import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
if (!process.env.REDIS_URL) process.env.REDIS_URL = "memory";
if (!process.env.MONGO_URI) process.env.MONGO_URI = "memory";
// leave MONGO_URI as provided by .env; if set to 'memory', we degrade gracefully
import { createServer } from "http";
import app from "./app.js";
import { connectMongo } from "./startup/mongo.js";
import { connectRedis } from "./startup/redis.js";
import { seedContentIfNeeded, seedDemoDataIfNeeded } from "./startup/seed.js";
import { configureCloudinary } from "./startup/cloudinary.js";
import { initSocket } from "./startup/socket.js";
import { startCron } from "./startup/cron.js";
import { startAssignmentScheduler } from "./startup/assignmentScheduler.js";

const PORT = 3001;

async function boot() {
  await connectMongo();
  await connectRedis();
  configureCloudinary();
  await seedContentIfNeeded();
  await seedDemoDataIfNeeded();

  const server = createServer(app);
  initSocket(server);
  const port = Number(PORT) || 3001;
  server.listen(port, () => {
    console.log(`[Server] API listening on http://localhost:${port} env=${process.env.NODE_ENV || "development"}`);
    startCron();
    startAssignmentScheduler();
  });
}

boot().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
