import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderDayAvailability from "../models/ProviderDayAvailability.js";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";
import { BookingSettings } from "../models/Settings.js";
import { Category, OfficeSettings, ServiceType } from "../models/Content.js";
import { canAssignProviderToBooking, getExhaustedAssignmentDisposition } from "../lib/assignment.js";
import { runAssignmentSchedulerOnce } from "../startup/assignmentScheduler.js";

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

function slotLabelFromNow(minutesFromNow) {
  const d = new Date(Date.now() + (minutesFromNow * 60 * 1000));
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    time: `${String(hours).padStart(2, "0")}:${minutes} ${period}`,
  };
}

describe("Realtime slot and nearest-provider flow", () => {
  beforeEach(async () => {
    await Booking.deleteMany({});
    await ProviderAccount.deleteMany({ phone: { $regex: /^91999/ } });
    await ProviderDayAvailability.deleteMany({});
    await User.deleteMany({ phone: { $regex: /^919980/ } });
    await Vendor.deleteMany({ phone: { $regex: /^919970/ } });
    await BookingSettings.deleteMany({});
    await OfficeSettings.deleteMany({});
    await Category.deleteMany({ id: { $regex: /^test-/ } });
    await ServiceType.deleteMany({ id: { $regex: /^test-/ } });
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

  it("keeps same-zone slots visible when a category still uses a legacy serviceType token", async () => {
    const date = futureDate(1);
    const provider = await ProviderAccount.create({
      phone: "9199900030",
      name: "Hair Specialist",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city: "Ujjain",
      zones: ["Ujjain Hub"],
      currentLocation: { lat: 23.1764, lng: 75.7885 },
      documents: {
        primaryCategory: ["hair service"],
        specializations: ["Hair spa"],
      },
    });
    await ProviderDayAvailability.create({
      providerId: provider._id.toString(),
      date,
      availableSlots: ["10:00 AM", "10:30 AM"],
    });
    await ServiceType.create({ id: "test-parent-hair", label: "hair service" });
    await Category.create({
      id: "test-hair-spa",
      name: "Hair spa",
      gender: "women",
      serviceType: "skin",
      bookingType: "instant",
    });

    const token = await loginUser();
    const res = await request(app)
      .get(`/providers/available-slots-by-date?date=${date}&city=Ujjain&zone=Ujjain%20Hub&serviceTypes=skin&categories=test-hair-spa`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toContain("10:00 AM");
  });

  it("does not return expired pending assignments in the old provider booking list", async () => {
    const provider = await ProviderAccount.create({
      phone: "9199900040",
      name: "Expired Assignee",
      approvalStatus: "approved",
      registrationComplete: true,
      isOnline: true,
      city: "Ujjain",
      zones: ["Ujjain Hub"],
      currentLocation: { lat: 23.1764, lng: 75.7885 },
    });

    const expiredBooking = await Booking.create({
      customerId: "C-expired",
      customerName: "Customer",
      services: [{ name: "Skin Glow", price: 900, duration: "1h", category: "facial", serviceType: "skin" }],
      totalAmount: 900,
      balanceAmount: 900,
      address: { houseNo: "1", area: "Ujjain Hub", city: "Ujjain", zone: "Ujjain Hub" },
      slot: { date: futureDate(1), time: "09:30 AM" },
      bookingType: "scheduled",
      status: "pending",
      assignedProvider: provider._id.toString(),
      expiresAt: new Date(Date.now() - 5 * 1000),
      lastAssignedAt: new Date(Date.now() - 11 * 60 * 1000),
    });

    const providerAgent = request.agent(app);
    const otpRequestRes = await providerAgent.post("/provider/request-otp").send({ phone: provider.phone });
    expect(otpRequestRes.status).toBe(200);
    const providerOtp = otpRequestRes.body.otpPreview || process.env.DEFAULT_PROVIDER_OTP || "123456";
    const loginRes = await providerAgent.post("/provider/verify-otp").send({ phone: provider.phone, otp: providerOtp });
    expect(loginRes.status).toBe(200);

    const res = await providerAgent.get(`/provider/bookings/${provider._id.toString()}`);

    expect(res.status).toBe(200);
    const bookingIds = (res.body.bookings || []).map((b) => b._id || b.id);
    expect(bookingIds).not.toContain(expiredBooking._id.toString());
  });

  it("escalates to vendor when the fifth provider rejects and at least 60 minutes remain", async () => {
    const city = "Ujjain";
    const zone = "Ujjain Hub";
    const slot = { date: futureDate(1), time: "10:00 AM" };
    const providers = [];
    for (let idx = 0; idx < 5; idx++) {
      providers.push(await ProviderAccount.create({
        phone: `91999001${idx}1`,
        name: `Reject Provider ${idx + 1}`,
        approvalStatus: "approved",
        registrationComplete: true,
        isOnline: true,
        city,
        zones: [zone],
        currentLocation: { lat: 23.1764 + (idx * 0.001), lng: 75.7885 + (idx * 0.001) },
      }));
    }
    await Vendor.create({
      phone: "9199700001",
      name: "Ujjain Vendor",
      city,
      status: "approved",
      zones: [zone],
    });
    const booking = await Booking.create({
      customerId: "user-vendor-escalation",
      customerName: "Customer",
      services: [{ name: "Skin Glow", price: 900, duration: "1h", category: "facial", serviceType: "skin" }],
      totalAmount: 900,
      balanceAmount: 900,
      address: { houseNo: "1", area: zone, city, zone },
      slot,
      bookingType: "scheduled",
      status: "pending",
      assignedProvider: providers[4]._id.toString(),
      candidateProviders: providers.map((p) => p._id.toString()),
      rejectedProviders: providers.slice(0, 4).map((p) => p._id.toString()),
      assignmentIndex: 4,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const providerAgent = request.agent(app);
    const otpRequestRes = await providerAgent.post("/provider/request-otp").send({ phone: providers[4].phone });
    expect(otpRequestRes.status).toBe(200);
    const providerOtp = otpRequestRes.body.otpPreview || process.env.DEFAULT_PROVIDER_OTP || "123456";
    const loginRes = await providerAgent.post("/provider/verify-otp").send({ phone: providers[4].phone, otp: providerOtp });
    expect(loginRes.status).toBe(200);

    const res = await providerAgent.patch(`/provider/bookings/${booking._id.toString()}/status`).send({ status: "rejected" });

    expect(res.status).toBe(200);
    expect(res.body.booking.assignedProvider).toBe("");
    expect(res.body.booking.vendorEscalated).toBe(true);
    expect(res.body.booking.adminEscalated).toBe(false);
    expect(res.body.booking.status).toBe("pending");
    expect(res.body.booking.expiresAt).toBeNull();
  });

  it("auto-cancels and refunds when the fifth provider rejects with less than 60 minutes remaining", async () => {
    const city = "Ujjain";
    const zone = "Ujjain Hub";
    const slot = slotLabelFromNow(30);
    const customer = await User.create({
      phone: "9199800001",
      name: "Refund User",
      wallet: { balance: 0, transactions: [] },
    });
    const providers = [];
    for (let idx = 0; idx < 5; idx++) {
      providers.push(await ProviderAccount.create({
        phone: `91999002${idx}2`,
        name: `Cancel Provider ${idx + 1}`,
        approvalStatus: "approved",
        registrationComplete: true,
        isOnline: true,
        city,
        zones: [zone],
        currentLocation: { lat: 23.1864 + (idx * 0.001), lng: 75.7985 + (idx * 0.001) },
        credits: idx === 4 ? 0 : undefined,
      }));
    }
    const booking = await Booking.create({
      customerId: customer._id.toString(),
      customerName: customer.name,
      services: [{ name: "Skin Glow", price: 900, duration: "1h", category: "facial", serviceType: "skin" }],
      totalAmount: 900,
      prepaidAmount: 500,
      balanceAmount: 400,
      paymentSources: [{ source: "wallet", amount: 500, paidAt: new Date() }],
      address: { houseNo: "1", area: zone, city, zone },
      slot,
      bookingType: "scheduled",
      status: "pending",
      assignedProvider: providers[4]._id.toString(),
      candidateProviders: providers.map((p) => p._id.toString()),
      rejectedProviders: providers.slice(0, 4).map((p) => p._id.toString()),
      assignmentIndex: 4,
      commissionAmount: 50,
      commissionChargedAt: new Date(Date.now() - 5 * 60 * 1000),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const providerAgent = request.agent(app);
    const otpRequestRes = await providerAgent.post("/provider/request-otp").send({ phone: providers[4].phone });
    expect(otpRequestRes.status).toBe(200);
    const providerOtp = otpRequestRes.body.otpPreview || process.env.DEFAULT_PROVIDER_OTP || "123456";
    const loginRes = await providerAgent.post("/provider/verify-otp").send({ phone: providers[4].phone, otp: providerOtp });
    expect(loginRes.status).toBe(200);

    const res = await providerAgent.patch(`/provider/bookings/${booking._id.toString()}/status`).send({ status: "rejected" });

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe("cancelled");
    expect(res.body.booking.cancelledBy).toBe("system");
    expect(res.body.booking.assignedProvider).toBe("");
    expect(res.body.booking.refundAmount).toBe(500);
    expect(res.body.booking.refundStatus).toBe("processed");
    expect(res.body.booking.commissionRefundedAt).toBeTruthy();

    const refreshedProvider = await ProviderAccount.findById(providers[4]._id).lean();
    expect(Number(refreshedProvider?.credits || 0)).toBe(50);
  });

  it("chooses vendor escalation when exactly 60 minutes remain", () => {
    const slot = slotLabelFromNow(60);
    const outcome = getExhaustedAssignmentDisposition({ slot }, new Date());
    expect(outcome.kind).toBe("vendor_escalation");
  });

  it("uses the same exhausted-chain rule for scheduler timeout handling", async () => {
    const city = "Ujjain";
    const zone = "Ujjain Hub";
    const slot = { date: futureDate(1), time: "11:00 AM" };
    const providers = [];
    for (let idx = 0; idx < 5; idx++) {
      providers.push(await ProviderAccount.create({
        phone: `91999003${idx}3`,
        name: `Timeout Provider ${idx + 1}`,
        approvalStatus: "approved",
        registrationComplete: true,
        isOnline: true,
        city,
        zones: [zone],
        currentLocation: { lat: 23.1964 + (idx * 0.001), lng: 75.8085 + (idx * 0.001) },
      }));
    }
    await Vendor.create({
      phone: "9199700002",
      name: "Timeout Vendor",
      city,
      status: "approved",
      zones: [zone],
    });
    const booking = await Booking.create({
      customerId: "timeout-user",
      customerName: "Timeout Customer",
      services: [{ name: "Skin Glow", price: 900, duration: "1h", category: "facial", serviceType: "skin" }],
      totalAmount: 900,
      balanceAmount: 900,
      address: { houseNo: "1", area: zone, city, zone },
      slot,
      bookingType: "scheduled",
      status: "pending",
      assignedProvider: providers[4]._id.toString(),
      candidateProviders: providers.map((p) => p._id.toString()),
      rejectedProviders: providers.slice(0, 4).map((p) => p._id.toString()),
      assignmentIndex: 4,
      expiresAt: new Date(Date.now() - 10 * 1000),
      lastAssignedAt: new Date(Date.now() - 11 * 60 * 1000),
    });

    await runAssignmentSchedulerOnce(new Date());

    const refreshed = await Booking.findById(booking._id).lean();
    expect(refreshed?.assignedProvider).toBe("");
    expect(refreshed?.vendorEscalated).toBe(true);
    expect(refreshed?.adminEscalated).toBe(false);
    expect(refreshed?.status).toBe("pending");
  });
});
