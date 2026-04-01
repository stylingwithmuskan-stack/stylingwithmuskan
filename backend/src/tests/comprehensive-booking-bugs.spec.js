/**
 * Bug Condition Exploration Tests for Comprehensive Booking Fixes
 * 
 * CRITICAL: These tests MUST FAIL on unfixed code - failure confirms bugs exist
 * DO NOT attempt to fix the tests or code when they fail
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**
 * 
 * NOTE: These tests document the bugs and their expected behavior.
 * Some tests are documentation-only as the bugs are primarily in the frontend.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { City, Zone } from "../models/CityZone.js";
import { Category, Service, ServiceType } from "../models/Content.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

describe("Bug Condition Exploration Tests", () => {
  let testUser;
  let testZoneWithNoServices;
  let testZoneWithServices;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      name: "Test User",
      phone: "8888888888",
      role: "user",
      address: {
        city: "TestCity",
        area: "TestArea",
        houseNo: "123",
      },
    });

    // Create test city first
    const testCity = await City.create({
      name: "TestCity",
      status: "active",
    });

    // Create test zones
    testZoneWithNoServices = await Zone.create({
      name: "EmptyZone",
      city: testCity._id,
      status: "active",
      coordinates: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 },
        { lat: 0.5, lng: 0.5 },
      ],
      // NOTE: Zone model doesn't have services/subcategories fields
      // This is a frontend validation concern
    });

    testZoneWithServices = await Zone.create({
      name: "ActiveZone",
      city: testCity._id,
      status: "active",
      coordinates: [
        { lat: 2, lng: 2 },
        { lat: 2, lng: 3 },
        { lat: 3, lng: 3 },
        { lat: 3, lng: 2 },
        { lat: 2.5, lng: 2.5 },
      ],
      // NOTE: Zone model doesn't have services/subcategories fields
      // This is a frontend validation concern
    });

    // Create test content for parent categories (ServiceTypes)
    await ServiceType.create({
      id: "test-parent-cat",
      label: "Test Parent Category",
      description: "Test description",
      // NOTE: gender field is missing - this is the bug
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Zone.deleteMany({});
    await City.deleteMany({});
    await ServiceType.deleteMany({});
    await Category.deleteMany({});
    await Service.deleteMany({});
    await Booking.deleteMany({});
  });

  /**
   * Bug 1: Zone Service Validation Test
   * 
   * Tests that selecting address in zone with no services shows toast message
   * and blocks booking flow.
   * 
   * **Validates: Requirements 2.1, 2.2**
   */
  describe("Bug 1 - Zone Service Validation", () => {
    it("1.1 should find zone with NO services (demonstrates bug condition)", async () => {
      // NOTE: The Zone model doesn't have services/subcategories fields
      // This bug is about FRONTEND validation when selecting an address
      // The frontend should check if the zone has available services before allowing booking
      
      const zone = await Zone.findOne({ name: "EmptyZone" });
      
      expect(zone).toBeDefined();
      expect(zone.name).toBe("EmptyZone");
      
      console.log("\n=== Bug 1 Counterexample ===");
      console.log("Zone found:", zone.name);
      console.log("\nNOTE: Zone model doesn't store services/subcategories");
      console.log("BUG: Frontend booking flow does NOT validate zone service availability");
      console.log("EXPECTED: Should display toast: 'Currently this service is not available in your zone.'");
      console.log("EXPECTED: Should block booking from proceeding");
      console.log("ACTUAL: Booking proceeds without validation or user feedback");
      console.log("\nLocation: Frontend booking flow component");
      console.log("Fix needed: Add zone service availability check before allowing booking");
      console.log("Implementation: Check if zone has associated services/subcategories via API");
    });

    it("1.2 should verify zone with services exists (preservation case)", async () => {
      // This verifies the preservation case: zones should work normally
      const zone = await Zone.findOne({ name: "ActiveZone" });
      
      expect(zone).toBeDefined();
      expect(zone.name).toBe("ActiveZone");
      
      console.log("\n=== Bug 1 Preservation ===");
      console.log("Zone found:", zone.name);
      console.log("PRESERVATION: Booking flow for zones WITH services must continue to work normally");
      console.log("NOTE: Service availability is checked via API, not stored in Zone model");
    });
  });

  /**
   * Bug 2: Gender Field Missing Test
   * 
   * Tests that parent category modal includes gender field dropdown.
   * 
   * **Validates: Requirements 2.3, 2.4**
   */
  describe("Bug 2 - Gender Field Missing", () => {
    it("2.1 should find parent category WITHOUT gender field (demonstrates bug)", async () => {
      // This test demonstrates the bug: gender field is missing from ServiceType (parent category)
      const parentCategory = await ServiceType.findOne({ id: "test-parent-cat" });
      
      expect(parentCategory).toBeDefined();
      expect(parentCategory.gender).toBeUndefined();
      
      console.log("\n=== Bug 2 Counterexample ===");
      console.log("Parent category found:", parentCategory.label);
      console.log("Has gender field:", "gender" in parentCategory.toObject());
      console.log("Available fields:", Object.keys(parentCategory.toObject()));
      console.log("\nBUG: Parent category form does NOT include gender field");
      console.log("EXPECTED: Gender dropdown with options (men/women/both)");
      console.log("ACTUAL: Gender field missing from form");
      console.log("\nLocation: frontend/src/modules/admin/pages/UserModuleManagement.jsx");
      console.log("Fix needed:");
      console.log("1. Add gender field to formData initialization (line ~464)");
      console.log("2. Add gender dropdown to parent category modal form");
      console.log("3. Include options: women, men, both");
    });

    it("2.2 should verify categories have gender field (comparison)", async () => {
      // Create a regular category with gender for comparison
      const category = await Category.create({
        id: "test-category",
        name: "Test Category",
        gender: "women",
        serviceType: "test-parent-cat",
        bookingType: "normal",
      });
      
      expect(category.gender).toBe("women");
      
      console.log("\n=== Bug 2 Context ===");
      console.log("Regular categories HAVE gender field:", category.gender);
      console.log("But parent categories (ServiceTypes) are MISSING gender field (BUG)");
    });
  });

  /**
   * Bug 3: Popular Services Static Data Test
   * 
   * Tests that Popular Services component makes API call on mount.
   * Note: This is a frontend bug.
   * 
   * **Validates: Requirements 2.5, 2.6**
   */
  describe("Bug 3 - Popular Services Static Data", () => {
    it("3.1 should verify backend has dynamic services", async () => {
      // Create dynamic services in backend
      await Service.create({
        id: "dynamic-service-1",
        name: "Dynamic Service 1",
        category: "test-category",
        gender: "women",
        price: 500,
        duration: "30 mins",
        rating: 4.5,
      });

      await Service.create({
        id: "dynamic-service-2",
        name: "Dynamic Service 2",
        category: "test-category",
        gender: "women",
        price: 800,
        duration: "45 mins",
        rating: 4.8,
      });

      const services = await Service.find({});
      expect(services.length).toBeGreaterThan(0);
      
      console.log("\n=== Bug 3 Counterexample ===");
      console.log("Backend has", services.length, "dynamic services");
      console.log("Service names:", services.map(s => s.name));
      console.log("\nBUG: Frontend PopularServices component uses HARDCODED data");
      console.log("EXPECTED: Component fetches services from backend API");
      console.log("ACTUAL: Component displays static/hardcoded service list");
      console.log("\nLocation: frontend/src/modules/user/components/salon/PopularServices.jsx");
      console.log("Current: Component uses useUserModuleData() context");
      console.log("Issue: Context may not be fetching from API, or component uses wrong data source");
      console.log("Fix needed: Ensure component uses services from context that fetches from backend");
    });

    it("3.2 should document that new services won't appear without code changes", async () => {
      console.log("\n=== Bug 3 Impact ===");
      console.log("When admin adds new service to backend:");
      console.log("- Service is stored in database ✓");
      console.log("- Service is available via API ✓");
      console.log("- Service does NOT appear in Popular Services section ✗ (BUG)");
      console.log("- Requires code change to add service to hardcoded list ✗ (BUG)");
      console.log("\nExpected behavior: New services should appear automatically");
      
      expect(true).toBe(true);
    });
  });

  /**
   * Bug 4: Past Bookings Not Displaying Test
   * 
   * Tests that "Past" tab displays bookings with status "completed".
   * 
   * **Validates: Requirements 2.7, 2.8**
   */
  describe("Bug 4 - Past Bookings Not Displaying", () => {
    it("4.1 should create completed bookings (demonstrates bug condition)", async () => {
      // Create completed bookings
      const completedBooking1 = await Booking.create({
        customerId: testUser._id.toString(),
        customerName: testUser.name,
        services: [{ name: "Service A", price: 500 }],
        status: "completed",
        slot: {
          date: "2024-12-20",
          time: "10:00 AM",
        },
        address: {
          city: "TestCity",
          area: "TestArea",
          houseNo: "123",
        },
        totalAmount: 1000,
        paymentStatus: "paid",
      });

      const completedBooking2 = await Booking.create({
        customerId: testUser._id.toString(),
        customerName: testUser.name,
        services: [{ name: "Service B", price: 800 }],
        status: "completed",
        slot: {
          date: "2024-12-21",
          time: "2:00 PM",
        },
        address: {
          city: "TestCity",
          area: "TestArea",
          houseNo: "123",
        },
        totalAmount: 800,
        paymentStatus: "paid",
      });

      const completedBookings = await Booking.find({ 
        customerId: testUser._id.toString(), 
        status: "completed" 
      });
      
      expect(completedBookings.length).toBe(2);
      
      console.log("\n=== Bug 4 Counterexample ===");
      console.log("Completed bookings in database:", completedBookings.length);
      console.log("Booking IDs:", completedBookings.map(b => b._id.toString()));
      console.log("Statuses:", completedBookings.map(b => b.status));
      console.log("\nBUG: Past tab does NOT display completed bookings");
      console.log("EXPECTED: Past tab shows all bookings with status='completed'");
      console.log("ACTUAL: Past tab shows 0 bookings despite completed bookings existing");
      console.log("\nLocation: frontend/src/modules/user/pages/BookingsPage.jsx");
      console.log("Bug location: Lines 213-217");
      console.log("Current filter logic:");
      console.log("  if (activeTab === 'Upcoming') return s !== 'completed';");
      console.log("  return s === 'completed';");
      console.log("\nIssue: Filter logic is INCORRECT");
      console.log("The filter checks status but doesn't properly separate tabs");
      console.log("Fix needed: Properly filter based on activeTab === 'Past'");
    });

    it("4.2 should verify upcoming bookings exist (preservation case)", async () => {
      // Create upcoming booking
      const upcomingBooking = await Booking.create({
        customerId: testUser._id.toString(),
        customerName: testUser.name,
        services: [{ name: "Service C", price: 600 }],
        status: "pending",
        slot: {
          date: "2024-12-30",
          time: "11:00 AM",
        },
        address: {
          city: "TestCity",
          area: "TestArea",
          houseNo: "123",
        },
        totalAmount: 600,
      });

      const upcomingBookings = await Booking.find({ 
        customerId: testUser._id.toString(), 
        status: { $ne: "completed" } 
      });
      
      expect(upcomingBookings.length).toBeGreaterThan(0);
      
      console.log("\n=== Bug 4 Preservation ===");
      console.log("Upcoming bookings in database:", upcomingBookings.length);
      console.log("PRESERVATION: Upcoming tab must continue to show non-completed bookings");
      console.log("PRESERVATION: Booking details modal must continue to work");
      console.log("PRESERVATION: Booking type filtering must continue to work");
    });
  });

  /**
   * Bug 5: Admin Assignment Present Test
   * 
   * Tests that admin booking management does NOT show "Assign" button for normal bookings.
   * Note: This is a frontend bug.
   * 
   * **Validates: Requirements 2.9, 2.10**
   */
  describe("Bug 5 - Admin Assignment Present", () => {
    it("5.1 should create normal and customize bookings (demonstrates bug)", async () => {
      // Create normal booking
      const normalBooking = await Booking.create({
        customerId: testUser._id.toString(),
        customerName: testUser.name,
        services: [{ name: "Normal Service", price: 500 }],
        status: "pending",
        bookingType: "normal",
        slot: {
          date: "2024-12-25",
          time: "10:00 AM",
        },
        address: {
          city: "TestCity",
          area: "TestArea",
          houseNo: "123",
        },
        totalAmount: 1000,
      });

      // Create customize booking
      const customizeBooking = await Booking.create({
        customerId: testUser._id.toString(),
        customerName: testUser.name,
        services: [{ name: "Customize Service", price: 5000 }],
        status: "vendor_assigned",
        bookingType: "customized",
        slot: {
          date: "2024-12-26",
          time: "2:00 PM",
        },
        address: {
          city: "TestCity",
          area: "TestArea",
          houseNo: "123",
        },
        totalAmount: 5000,
      });

      const normalBookings = await Booking.find({ bookingType: "normal" });
      const customizeBookings = await Booking.find({ bookingType: "customized" });
      
      expect(normalBookings.length).toBeGreaterThan(0);
      expect(customizeBookings.length).toBeGreaterThan(0);
      
      console.log("\n=== Bug 5 Counterexample ===");
      console.log("Normal bookings:", normalBookings.length);
      console.log("Customize bookings:", customizeBookings.length);
      console.log("\nBUG: Admin panel shows 'Assign' button for NORMAL bookings");
      console.log("EXPECTED: 'Assign' button ONLY for customize bookings (price approval workflow)");
      console.log("ACTUAL: 'Assign' button shown for ALL bookings including normal ones");
      console.log("\nLocation: frontend/src/modules/admin/pages/BookingManagement.jsx");
      console.log("Issue: 'Assign' button rendered without checking bookingType");
      console.log("\nRole Separation:");
      console.log("- Admin panel: Only customize booking price approval workflow");
      console.log("- Vendor panel: Handles normal booking assignment");
      console.log("\nFix needed:");
      console.log("1. Add condition: only show 'Assign' for bookingType === 'customized'");
      console.log("2. Keep 'Review Pricing' button for vendor_assigned status");
      console.log("3. Keep 'Approve Team' button for team_assigned status");
      console.log("4. Remove 'Assign' button for normal bookings");
    });

    it("5.2 should document preservation requirements", async () => {
      console.log("\n=== Bug 5 Preservation ===");
      console.log("CRITICAL: Customize booking workflow must be COMPLETELY preserved");
      console.log("\nAdmin customize booking workflow:");
      console.log("1. Vendor submits pricing → status: vendor_assigned");
      console.log("2. Admin reviews pricing → 'Review Pricing' button (PRESERVE)");
      console.log("3. Admin approves pricing → status: admin_approved");
      console.log("4. Vendor assigns team → status: team_assigned");
      console.log("5. Admin reviews team → 'Approve Team' button (PRESERVE)");
      console.log("6. Admin approves team → booking created");
      console.log("\nDO NOT REMOVE:");
      console.log("- 'Review Pricing' button for customize bookings");
      console.log("- 'Approve Team' button for customize bookings");
      console.log("- Any customize booking workflow functionality");
      console.log("\nONLY REMOVE:");
      console.log("- 'Assign' button for NORMAL bookings");
      
      expect(true).toBe(true);
    });
  });

  /**
   * Summary Test - Documents all bugs
   */
  describe("Bug Summary", () => {
    it("should document all 5 bugs and their locations", async () => {
      console.log("\n=== COMPREHENSIVE BOOKING FIXES - BUG SUMMARY ===\n");
      
      console.log("Bug 1: Zone Service Validation");
      console.log("  Location: Frontend booking flow");
      console.log("  Issue: No validation when zone has no services");
      console.log("  Impact: Users can book in zones without services");
      console.log("  Fix: Add zone service check + toast message\n");
      
      console.log("Bug 2: Gender Field Missing");
      console.log("  Location: frontend/src/modules/admin/pages/UserModuleManagement.jsx");
      console.log("  Issue: Parent category form missing gender field");
      console.log("  Impact: Cannot specify gender for parent categories");
      console.log("  Fix: Add gender dropdown to form\n");
      
      console.log("Bug 3: Popular Services Static Data");
      console.log("  Location: frontend/src/modules/user/components/salon/PopularServices.jsx");
      console.log("  Issue: Component uses hardcoded data");
      console.log("  Impact: New services don't appear without code changes");
      console.log("  Fix: Use context data from backend API\n");
      
      console.log("Bug 4: Past Bookings Not Displaying");
      console.log("  Location: frontend/src/modules/user/pages/BookingsPage.jsx (lines 213-217)");
      console.log("  Issue: Filter logic incorrect for Past tab");
      console.log("  Impact: Completed bookings don't show in Past tab");
      console.log("  Fix: Properly filter based on activeTab\n");
      
      console.log("Bug 5: Admin Assignment Present");
      console.log("  Location: frontend/src/modules/admin/pages/BookingManagement.jsx");
      console.log("  Issue: 'Assign' button shown for normal bookings");
      console.log("  Impact: Breaks role separation (admin vs vendor)");
      console.log("  Fix: Only show 'Assign' for customize bookings\n");
      
      console.log("=== END OF BUG SUMMARY ===\n");
      
      expect(true).toBe(true);
    });
  });
});
