import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { seedContentIfNeeded } from "../startup/seed.js";
import mongoose from "mongoose";
import ProviderAccount from "../models/ProviderAccount.js";
import Booking from "../models/Booking.js";

describe("SWM API", () => {
  it("healthz", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("seed content", async () => {
    await seedContentIfNeeded();
    const res = await request(app).get("/content/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("auth request-otp and verify", async () => {
    const phone = process.env.DEMO_DEFAULT_PHONE || "1234567890";
    const otp = process.env.DEMO_DEFAULT_OTP || "1234";
    let res = await request(app).post("/auth/request-otp").send({ phone });
    expect(res.status).toBe(200);
    res = await request(app).post("/auth/verify-otp").send({ phone, otp });
    expect(res.status).toBe(200);
    expect(res.body.user?.phone).toBe(phone);
    const token = res.body.token;
    expect(token).toBeTypeOf("string");
  });

  it("bookings quote and create", async () => {
    const phone = process.env.DEMO_DEFAULT_PHONE || "1234567890";
    const otp = process.env.DEMO_DEFAULT_OTP || "1234";
    let res = await request(app).post("/auth/verify-otp").send({ phone, otp });
    const token = res.body.token;
    const agent = request.agent(app);
    const items = [{ name: "Service A", price: 500, quantity: 2, duration: "1h", category: "facial", serviceType: "skin" }];
    res = await agent.post("/bookings/quote").set("Authorization", `Bearer ${token}`).send({ items });
    expect(res.status).toBe(200);
    expect(res.body.finalTotal).toBeGreaterThan(0);
    const address = { houseNo: "1", area: "Area", landmark: "", lat: 22.72, lng: 75.86 };
    const slot = { date: "2026-03-07", time: "10:00" };
    res = await agent.post("/bookings").set("Authorization", `Bearer ${token}`).send({ items, slot, address, bookingType: "scheduled" });
    expect(res.status).toBe(201);
    expect(res.body.booking?._id).toBeDefined();
    expect(res.body.advanceAmount).toBeGreaterThan(0);
    expect(res.body.order?.id).toBeDefined();
    const id = res.body.booking._id;
    res = await agent.get(`/bookings/${id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.booking._id).toBe(id);
  });

  it("provider scope enforcement", async () => {
    // Create two providers
    const p1 = await ProviderAccount.create({ phone: "9000000001", name: "P1", approvalStatus: "approved", registrationComplete: true });
    const p2 = await ProviderAccount.create({ phone: "9000000002", name: "P2", approvalStatus: "approved", registrationComplete: true });

    // Login as p1 (dev default otp)
    const agent = request.agent(app);
    let res = await agent.post("/provider/verify-otp").send({ phone: p1.phone, otp: process.env.DEMO_DEFAULT_OTP6 || "123456" });
    expect(res.status).toBe(200);

    // Create a booking assigned to p2
    const b = await Booking.create({
      customerId: "C1",
      customerName: "Cust",
      services: [{ name: "Svc", price: 100, duration: "30m", category: "hair", serviceType: "hair" }],
      totalAmount: 100,
      balanceAmount: 100,
      address: { houseNo: "1", area: "Area", landmark: "" },
      slot: { date: "2026-03-07", time: "09:00 AM" },
      bookingType: "instant",
      status: "pending",
      assignedProvider: p2._id.toString(),
      otp: "1234",
    });

    // p1 cannot list p2 bookings
    res = await agent.get(`/provider/bookings/${p2._id.toString()}`);
    expect(res.status).toBe(403);

    // p1 cannot update p2 booking status
    res = await agent.patch(`/provider/bookings/${b._id.toString()}/status`).send({ status: "accepted" });
    expect(res.status).toBe(403);
  });

  it("provider availability get/set", async () => {
    const p = await ProviderAccount.create({ phone: "9000000010", name: "P10", approvalStatus: "approved", registrationComplete: true });
    const agent = request.agent(app);
    let res = await agent.post("/provider/verify-otp").send({ phone: p.phone, otp: process.env.DEMO_DEFAULT_OTP6 || "123456" });
    expect(res.status).toBe(200);

    res = await agent.get("/provider/availability/2026-03-07");
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-03-07");
    expect(res.body.slots).toBeTypeOf("object");

    const nextSlots = { ...res.body.slots, "09:00 AM": true, "10:00 AM": false };
    res = await agent.put("/provider/availability/2026-03-07").send({ slots: nextSlots });
    expect(res.status).toBe(200);
    expect(res.body.slots["09:00 AM"]).toBe(true);
    expect(res.body.slots["10:00 AM"]).toBe(false);
  });
});
