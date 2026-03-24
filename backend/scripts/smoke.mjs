import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

async function run() {
  // Ensure env is set BEFORE loading app/config modules.
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.REDIS_URL = process.env.REDIS_URL || "memory";
  if (process.env.MONGO_URI_SMOKE && !process.env.MONGO_URI) process.env.MONGO_URI = process.env.MONGO_URI_SMOKE;
  if (!process.env.MONGO_URI || process.env.MONGO_URI === "memory") {
    throw new Error("Set MONGO_URI (or MONGO_URI_SMOKE) to run smoke tests against a real Mongo database");
  }
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "smoke_secret";

  const { default: app } = await import("../src/app.js");
  const { connectMongo } = await import("../src/startup/mongo.js");
  const { connectRedis } = await import("../src/startup/redis.js");
  const { default: ProviderAccount } = await import("../src/models/ProviderAccount.js");
  const { default: Booking } = await import("../src/models/Booking.js");

  await connectMongo();
  await connectRedis();

  // Health
  let res = await request(app).get("/healthz");
  assert(res.status === 200, "healthz failed");

  // User auth (dev OTP)
  const phone = process.env.DEMO_DEFAULT_PHONE || "1234567890";
  const otp = process.env.DEMO_DEFAULT_OTP || "1234";
  res = await request(app).post("/auth/verify-otp").send({ phone, otp });
  assert(res.status === 200, "user verify-otp failed");
  const token = res.body.token;
  assert(typeof token === "string" && token.length > 10, "missing token");

  // Provider availability + scoping
  const seed = String(Date.now()).slice(-6);
  const p1Phone = `9000${seed}01`.slice(0, 10);
  const p2Phone = `9000${seed}02`.slice(0, 10);
  const p1 = await ProviderAccount.create({ phone: p1Phone, name: "P1", approvalStatus: "approved", registrationComplete: true });
  const p2 = await ProviderAccount.create({ phone: p2Phone, name: "P2", approvalStatus: "approved", registrationComplete: true });

  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const tomorrow = iso(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const agent = request.agent(app);
  res = await agent.post("/provider/verify-otp").send({ phone: p1.phone, otp: process.env.DEMO_DEFAULT_OTP6 || "123456" });
  assert(res.status === 200, "provider verify-otp failed");

  res = await agent.get(`/provider/availability/${tomorrow}`);
  assert(res.status === 200, "availability get failed");

  const nextSlots = { ...res.body.slots, "09:00 AM": true, "10:00 AM": false };
  res = await agent.put(`/provider/availability/${tomorrow}`).send({ slots: nextSlots });
  assert(res.status === 200, "availability set failed");

  const b = await Booking.create({
    customerId: "C1",
    customerName: "Cust",
    services: [{ name: "Svc", price: 100, duration: "30m", category: "hair", serviceType: "hair" }],
    totalAmount: 100,
    balanceAmount: 100,
    address: { houseNo: "1", area: "Area", landmark: "" },
    slot: { date: tomorrow, time: "09:00 AM" },
    bookingType: "instant",
    status: "pending",
    assignedProvider: p2._id.toString(),
    otp: "1234",
  });

  res = await agent.get(`/provider/bookings/${p2._id.toString()}`);
  assert(res.status === 403, "provider scoping list should be forbidden");
  res = await agent.patch(`/provider/bookings/${b._id.toString()}/status`).send({ status: "accepted" });
  assert(res.status === 403, "provider scoping mutate should be forbidden");

  console.log("[smoke] OK");

  // Cleanup (best-effort)
  try { await Booking.deleteOne({ _id: b._id }); } catch {}
  try { await ProviderAccount.deleteOne({ _id: p1._id }); } catch {}
  try { await ProviderAccount.deleteOne({ _id: p2._id }); } catch {}
}

run()
  .catch((e) => {
    console.error("[smoke] FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await mongoose.disconnect(); } catch {}
  });

