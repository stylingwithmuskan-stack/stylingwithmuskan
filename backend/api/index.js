import app from "../src/app.js";
import { connectMongo } from "../src/startup/mongo.js";
import { connectRedis } from "../src/startup/redis.js";
import { configureCloudinary } from "../src/startup/cloudinary.js";

let isInitialized = false;

export default async function handler(req, res) {
  if (!isInitialized) {
    await connectMongo();
    await connectRedis();
    configureCloudinary();
    isInitialized = true;
  }
  return app(req, res);
}
