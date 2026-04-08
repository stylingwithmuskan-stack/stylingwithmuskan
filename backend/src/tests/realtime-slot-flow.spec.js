import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { canAssignProviderToBooking } from "../lib/assignment.js";

function futureDate(days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loginUser() {
  const phone = process.env.DEFAULT_USER_OTP_PHONE || process.env.DEMO_DEFAULT_PHONE || "9990000001";
  const otp = process.env.DEFAULT_USER_OTP || "123456";
  const res = await request(app).post("/auth/verify-otp").send({ phone, otp });
  return res.body.token;
}

describe("Realtime slot and nearest-provider flow", () => {
  beforeEach(async () => {
    await Booking.deleteMany({});
    await ProviderAccount.deleteMany({ phone: { $regex: /^91999/ } });
    await ProviderDayAvailability.deleteMany({});
    await BookingSettings.deleteMany({});
    await OfficeSettings.deleteMany({});
  });

  it("assigns Any Professional bookings to the nearest provider and stores only top 5 candidates", async () => {
    const date = futureDate(1);
    const slot = { date, time: "10:00 AM" };
    const zone = "ZoneA";
    const city = "Indore";

    const providers = [];
    for (let idx = 0; idx < 6; idx++) {
      const provider = await ProviderAccount.create({
        phone: `919990000${idx}`,
        name: `Provider ${idx + 1}`,
        approvalStatus: "approved",
        registrationComplete: true,
        isOnline: true,
        city,
        zones: [zone],
        currentLocation: { lat: 22.72 + (idx * 0.001), lng: 75.86 + (idx * 0.001) },
      });
      providers.push(provider);
      await ProviderDayAvailability.create({ providerId: provider._id.toString(), date, availableSlots: ["10:00 AM"] });
    }

    const token = await loginUser();
    const res = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ name: "Service A", price: 500, quantity: 1, duration: "1h", category: "facial", serviceType: "skin" }],
        slot,
        address: { houseNo: "1", area: zone, city, zone, lat: 22.72, lng: 75.86 },
        bookingType: "instant",
      });

    expect(res.status).toBe(201);
    expect(res.body.booking.assignedProvider).toBe(providers[0]._id.toString());
    expect(res.body.booking.candidateProviders).toHaveLength(5);
    expect(res.body.booking.candidateProviders[0]).toBe(providers[0]._id.toString());
    expect(res.body.booking.candidateProviders).not.toContain(providers[5]._id.toString());
  });

  it("blocks assigning a provider who is already busy in an overlapping interval", async () => {
    const provider = await ProviderAccount.create({
      phone: "9199900010",
      name: "Busy Provider",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city: "Indore",
      zones: ["ZoneA"],
      currentLocation: { lat: 22.72, lng: 75.86 },
    });
    const date = futureDate(1);
    await ProviderDayAvailability.create({ providerId: provider._id.toString(), date, availableSlots: ["10:00 AM", "10:30 AM"] });
    await Booking.create({
      customerId: "C1",
      customerName: "Customer 1",
      services: [{ name: "Long Service", price: 500, duration: "1h", category: "facial", serviceType: "skin" }],
      totalAmount: 500,
      balanceAmount: 500,
      address: { houseNo: "1", area: "ZoneA", city: "Indore", zone: "ZoneA" },
      slot: { date, time: "10:00 AM" },
      bookingType: "instant",
      status: "accepted",
      assignedProvider: provider._id.toString(),
    });

    const allowed = await canAssignProviderToBooking(provider._id.toString(), {
      services: [{ name: "Follow Up", price: 300, duration: "30m", category: "facial", serviceType: "skin" }],
      slot: { date, time: "10:30 AM" },
      _id: "candidate-booking",
    });

    expect(allowed).toBe(false);
  });

  it("moves booking to the next nearest provider when the first provider rejects", async () => {
    const date = futureDate(1);
    const slot = { date, time: "10:00 AM" };
    const city = "Indore";
    const zone = "ZoneA";

    const p1 = await ProviderAccount.create({
      phone: "9100000011",
      name: "Nearest P1",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city,
      zones: [zone],
      currentLocation: { lat: 22.72, lng: 75.86 },
    });
    const p2 = await ProviderAccount.create({
      phone: "9100000012",
      name: "Next P2",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city,
      zones: [zone],
      currentLocation: { lat: 22.721, lng: 75.861 },
    });

    for (const provider of [p1, p2]) {
      await ProviderDayAvailability.create({
        providerId: provider._id.toString(),
        date,
        availableSlots: ["10:00 AM"],
      });
    }

    const token = await loginUser();
    const createRes = await request(app)
      .post("/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ name: "Service A", price: 500, quantity: 1, duration: "1h", category: "facial", serviceType: "skin" }],
        slot,
        address: { houseNo: "1", area: zone, city, zone, lat: 22.72, lng: 75.86 },
        bookingType: "instant",
      });

    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.booking?._id || createRes.body.booking?.id;
    expect(createRes.body.booking.assignedProvider).toBe(p1._id.toString());

    const p1Agent = request.agent(app);
    const otpRequestRes = await p1Agent
      .post("/provider/request-otp")
      .send({ phone: p1.phone });
    expect(otpRequestRes.status).toBe(200);
    const providerOtp = otpRequestRes.body.otpPreview || process.env.DEFAULT_PROVIDER_OTP || "123456";
    const loginRes = await p1Agent
      .post("/provider/verify-otp")
      .send({ phone: p1.phone, otp: providerOtp });
    expect(loginRes.status).toBe(200);

    const rejectRes = await p1Agent
      .patch(`/provider/bookings/${bookingId}/status`)
      .send({ status: "rejected" });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.booking.assignedProvider).toBe(p2._id.toString());
    expect(rejectRes.body.booking.rejectedProviders).toContain(p1._id.toString());
    expect(rejectRes.body.booking.assignmentIndex).toBe(1);
  });

  it("returns only future slots for today in merged availability", async () => {
    const date = futureDate(0);
    const provider = await ProviderAccount.create({
      phone: "9199900020",
      name: "Today Provider",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city: "Indore",
      zones: ["ZoneA"],
      currentLocation: { lat: 22.72, lng: 75.86 },
    });
    await ProviderDayAvailability.create({
      providerId: provider._id.toString(),
      date,
      availableSlots: ["09:00 AM", "10:00 AM", "11:00 AM", "04:00 PM", "06:00 PM"],
    });

    const token = await loginUser();
    const res = await request(app)
      .get(`/providers/available-slots-by-date?date=${date}&city=Indore&zone=ZoneA`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    for (const s of (res.body.slots || [])) {
      const [time, period] = s.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;
      const slotMinutes = hours * 60 + minutes;
      expect(slotMinutes).toBeGreaterThan(currentMinutes);
    }
  });
});
