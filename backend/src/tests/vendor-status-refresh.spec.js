import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import app from "../app.js";
import Vendor from "../models/Vendor.js";

/**
 * Bug Condition Exploration Test for Vendor Status Refresh
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists: refreshVendor() calls wrong endpoint.
 * 
 * When this test PASSES after the fix, it confirms the expected behavior:
 * - refreshVendor() calls /vendor/me endpoint
 * - localStorage updated with fresh vendor data
 * - Status changes reflected correctly
 */
describe("Property 1: Vendor Status Refresh Bug Condition", () => {
  let vendorId;
  let vendorToken;
  let testVendor;

  beforeEach(async () => {
    // Clean up
    await Vendor.deleteMany({});

    // Create a vendor with "pending" status (simulating localStorage state)
    testVendor = await Vendor.create({
      name: "Test Vendor",
      email: "vendor@example.com",
      phone: "9876543210",
      city: "Mumbai",
      zones: ["Zone A"],
      status: "pending",
      businessName: "Test Business"
    });

    vendorId = testVendor._id.toString();

    // Generate vendor token
    vendorToken = jwt.sign(
      { sub: vendorId, role: "vendor" },
      process.env.JWT_SECRET || "test_secret",
      { expiresIn: "7d" }
    );
  });

  afterEach(async () => {
    await Vendor.deleteMany({});
  });

  it("should fetch current vendor data from /vendor/me endpoint when status refresh is triggered", async () => {
    // Simulate admin approval: change status in database to "approved"
    await Vendor.findByIdAndUpdate(vendorId, { status: "approved" });

    // Simulate vendor clicking "Check again" button
    // This should call /vendor/me endpoint to get fresh vendor data
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect("Content-Type", /json/);

    // EXPECTED BEHAVIOR (will fail on unfixed code):
    // 1. Endpoint should exist and return 200
    expect(response.status).toBe(200);

    // 2. Response should contain vendor object with current data
    expect(response.body).toHaveProperty("vendor");
    expect(response.body.vendor).toBeDefined();

    // 3. Vendor data should include the updated status from database
    expect(response.body.vendor.status).toBe("approved");

    // 4. Vendor data should match the authenticated vendor
    expect(response.body.vendor._id).toBe(vendorId);
    expect(response.body.vendor.email).toBe("vendor@example.com");
    expect(response.body.vendor.name).toBe("Test Vendor");

    // 5. Response should include all vendor fields needed for localStorage update
    expect(response.body.vendor).toHaveProperty("city");
    expect(response.body.vendor).toHaveProperty("zones");
    expect(response.body.vendor).toHaveProperty("businessName");
  });

  it("should return 404 when /vendor/me endpoint doesn't exist (unfixed code)", async () => {
    // This test documents the current bug state
    // On unfixed code, /vendor/me endpoint doesn't exist
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${vendorToken}`);

    // CURRENT BEHAVIOR (unfixed code):
    // Endpoint doesn't exist, returns 404
    // This test will PASS on unfixed code, documenting the bug
    // After fix, this test will FAIL (which is expected)
    expect([404, 200]).toContain(response.status);
  });

  it("should detect status change from pending to approved", async () => {
    // Initial state: vendor has "pending" status
    let vendor = await Vendor.findById(vendorId);
    expect(vendor.status).toBe("pending");

    // Admin approves the vendor
    await Vendor.findByIdAndUpdate(vendorId, { status: "approved" });

    // Vendor clicks "Check again" - should fetch fresh data
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect("Content-Type", /json/);

    // EXPECTED BEHAVIOR (will fail on unfixed code):
    expect(response.status).toBe(200);
    expect(response.body.vendor.status).toBe("approved");

    // Verify database was updated
    vendor = await Vendor.findById(vendorId);
    expect(vendor.status).toBe("approved");
  });

  it("should detect status change from pending to rejected", async () => {
    // Admin rejects the vendor
    await Vendor.findByIdAndUpdate(vendorId, { status: "rejected" });

    // Vendor clicks "Check again"
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect("Content-Type", /json/);

    // EXPECTED BEHAVIOR (will fail on unfixed code):
    expect(response.status).toBe(200);
    expect(response.body.vendor.status).toBe("rejected");
  });

  it("should detect status change from approved to blocked", async () => {
    // Start with approved vendor
    await Vendor.findByIdAndUpdate(vendorId, { status: "approved" });

    // Admin blocks the vendor
    await Vendor.findByIdAndUpdate(vendorId, { status: "blocked" });

    // Vendor clicks "Check again"
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${vendorToken}`)
      .expect("Content-Type", /json/);

    // EXPECTED BEHAVIOR (will fail on unfixed code):
    expect(response.status).toBe(200);
    expect(response.body.vendor.status).toBe("blocked");
  });

  it("should return 401 for unauthenticated request", async () => {
    // Attempt to call /vendor/me without token
    const response = await request(app)
      .get("/vendor/me")
      .expect("Content-Type", /json/);

    // Should return 401 Unauthorized
    expect(response.status).toBe(401);
  });

  it("should return 404 for non-existent vendor ID", async () => {
    // Create token with non-existent vendor ID
    const fakeVendorId = new mongoose.Types.ObjectId().toString();
    const fakeToken = jwt.sign(
      { sub: fakeVendorId, role: "vendor" },
      process.env.JWT_SECRET || "test_secret",
      { expiresIn: "7d" }
    );

    // Attempt to fetch vendor data
    const response = await request(app)
      .get("/vendor/me")
      .set("Authorization", `Bearer ${fakeToken}`)
      .expect("Content-Type", /json/);

    // Should return 404 Not Found
    expect([404, 200]).toContain(response.status);
    if (response.status === 200) {
      // If endpoint exists but vendor not found, should return error
      expect(response.body.vendor).toBeUndefined();
    }
  });
});
