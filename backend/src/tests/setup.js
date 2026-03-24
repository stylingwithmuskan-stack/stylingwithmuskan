import { beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

beforeAll(async () => {
  dotenv.config();
  process.env.NODE_ENV = "test";
  process.env.REDIS_URL = "memory";
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test_secret";
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: "swm_test" });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});
