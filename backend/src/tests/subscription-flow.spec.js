import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";
import SubscriptionLedger from "../models/SubscriptionLedger.js";
import User from "../models/User.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Vendor from "../models/Vendor.js";
import {
  activateSubscription,
  getActiveSubscription,
  getSubscriptionSnapshot,
  calculateCustomerSubscriptionBenefits,
  getProviderCommissionRate,
  getMarketingCreditsBalance,
  expireStaleSubscriptions,
} from "../lib/subscriptions.js";

describe("Subscription & Commission Flow", () => {
  let testCustomer;
  let testProvider;
  let testVendor;
  let customerToken;
  let providerToken;
  let vendorToken;
  let testPlanCustomer;
  let testPlanProvider;
  let testPlanVendor;

  beforeAll(async () => {
    // Clean up test data
    await SubscriptionPlan.deleteMany({ planId: /^test_/ });
    await UserSubscription.deleteMany({});
    await SubscriptionLedger.deleteMany({});

    // Create test plans
    testPlanCustomer = await SubscriptionPlan.create({
      planId: "test_customer_plan",
      name: "Test Customer Plan",
      userType: "customer",
      price: 299,
      durationDays: 30,
      billingCycle: "monthly",
      tagline: "Test plan for customers",
      benefits: ["10% discount", "Zero fees"],
      isActive: true,
      meta: {
        discountPercentage: 10,
        minCartValueForDiscount: 500,
        discountFundedBy: "platform",
        zeroConvenienceFee: true,
        zeroTravelFee: true,
        priorityBookingEnabled: true,
      },
    });

    testPlanProvider = await SubscriptionPlan.create({
      planId: "test_provider_plan",
      name: "Test Provider Plan",
      userType: "provider",
      price: 999,
      durationDays: 30,
      billingCycle: "monthly",
      tagline: "Test plan for providers",
      benefits: ["5% commission", "Pro badge"],
      isActive: true,
      meta: {
        providerCommissionRate: 5,
        commissionRate: 5,
        proBadgeEnabled: true,
      },
    });

    testPlanVendor = await SubscriptionPlan.create({
      planId: "test_vendor_plan",
      name: "Test Vendor Plan",
      userType: "vendor",
      price: 4999,
      durationDays: 30,
      billingCycle: "monthly",
      tagline: "Test plan for vendors",
      benefits: ["Marketing credits", "Performance commission"],
      isActive: true,
      meta: {
        marketingCreditsMonthly: 1000,
        marketingCredits: 1000,
        vendorPerformanceCommissionType: "percentage",
        vendorPerformanceCommissionValue: 2,
      },
    });

    // Create test users
    const phone = process.env.DEFAULT_USER_OTP_PHONE || "9990000001";
    const otp = process.env.DEFAULT_USER_OTP || "123456";
    
    let res = await request(app).post("/auth/verify-otp").send({ phone, otp });
    testCustomer = res.body.user;
    customerToken = res.body.token;

    // Create test provider
    testProvider = await ProviderAccount.create({
      phone: "9990000002",
      name: "Test Provider",
      email: "provider@test.com",
      gender: "male",
      status: "active",
      rating: 4.8,
      totalJobs: 50,
    });

    // Create test vendor
    testVendor = await Vendor.create({
      phone: "9990000003",
      name: "Test Vendor",
      email: "vendor@test.com",
      status: "active",
    });
  });

  describe("1. Admin Creates Subscription Plans", () => {
    it("should have created test plans successfully", async () => {
      expect(testPlanCustomer).toBeDefined();
      expect(testPlanCustomer.planId).toBe("test_customer_plan");
      expect(testPlanCustomer.userType).toBe("customer");
      expect(testPlanCustomer.price).toBe(299);

      expect(testPlanProvider).toBeDefined();
      expect(testPlanProvider.meta.providerCommissionRate).toBe(5);

      expect(testPlanVendor).toBeDefined();
      expect(testPlanVendor.meta.marketingCreditsMonthly).toBe(1000);
    });

    it("should fetch subscription plans via API", async () => {
      const res = await request(app).get("/subscriptions/plans?userType=customer");
      expect(res.status).toBe(200);
      expect(res.body.plans).toBeDefined();
      expect(Array.isArray(res.body.plans)).toBe(true);
      
      const testPlan = res.body.plans.find(p => p.planId === "test_customer_plan");
      expect(testPlan).toBeDefined();
      expect(testPlan.price).toBe(299);
    });
  });

  describe("2. Customer Subscription Purchase Flow", () => {
    it("should activate customer subscription directly (simulating payment)", async () => {
      const result = await activateSubscription({
        userId: testCustomer._id.toString(),
        userType: "customer",
        plan: testPlanCustomer,
        orderId: "test_order_customer_123",
        paymentId: "test_payment_customer_123",
        signature: "test_signature",
        amountPaid: 299,
        currency: "INR",
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.status).toBe("active");
      expect(result.subscription.planId).toBe("test_customer_plan");
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.isActive).toBe(true);
      expect(result.snapshot.isPlusMember).toBe(true);
    });

    it("should have created ledger entry for purchase", async () => {
      const ledger = await SubscriptionLedger.findOne({
        userId: testCustomer._id.toString(),
        entryType: "purchase",
      });

      expect(ledger).toBeDefined();
      expect(ledger.amount).toBe(299);
      expect(ledger.direction).toBe("debit");
      expect(ledger.planId).toBe("test_customer_plan");
    });

    it("should retrieve active subscription", async () => {
      const active = await getActiveSubscription(testCustomer._id.toString(), "customer");
      
      expect(active).toBeDefined();
      expect(active.subscription).toBeDefined();
      expect(active.plan).toBeDefined();
      expect(active.subscription.status).toBe("active");
      expect(active.plan.planId).toBe("test_customer_plan");
    });

    it("should get subscription snapshot", async () => {
      const snapshot = await getSubscriptionSnapshot(testCustomer._id.toString(), "customer");
      
      expect(snapshot.isActive).toBe(true);
      expect(snapshot.isPlusMember).toBe(true);
      expect(snapshot.discountPercentage).toBe(10);
      expect(snapshot.minCartValueForDiscount).toBe(500);
      expect(snapshot.zeroConvenienceFee).toBe(true);
      expect(snapshot.zeroTravelFee).toBe(true);
      expect(snapshot.daysLeft).toBeGreaterThan(0);
    });
  });

  describe("3. Customer Subscription Benefits Application", () => {
    it("should apply discount when cart value meets minimum", async () => {
      const benefits = await calculateCustomerSubscriptionBenefits({
        userId: testCustomer._id.toString(),
        total: 1000,
        subtotalAfterCoupon: 1000,
      });

      expect(benefits.snapshot.isActive).toBe(true);
      expect(benefits.subscriptionDiscount).toBe(100); // 10% of 1000
      expect(benefits.discountFundedBy).toBe("platform");
      expect(benefits.convenienceFee).toBe(0);
      expect(benefits.travelFee).toBe(0);
    });

    it("should NOT apply discount when cart value is below minimum", async () => {
      const benefits = await calculateCustomerSubscriptionBenefits({
        userId: testCustomer._id.toString(),
        total: 400,
        subtotalAfterCoupon: 400,
      });

      expect(benefits.snapshot.isActive).toBe(true);
      expect(benefits.subscriptionDiscount).toBe(0); // Below ₹500 minimum
    });

    it("should NOT apply discount for user without subscription", async () => {
      const benefits = await calculateCustomerSubscriptionBenefits({
        userId: "nonexistent_user_123",
        total: 1000,
        subtotalAfterCoupon: 1000,
      });

      expect(benefits.snapshot.isActive).toBe(false);
      expect(benefits.subscriptionDiscount).toBe(0);
    });
  });

  describe("4. Provider Subscription Purchase Flow", () => {
    it("should activate provider subscription", async () => {
      const result = await activateSubscription({
        userId: testProvider._id.toString(),
        userType: "provider",
        plan: testPlanProvider,
        orderId: "test_order_provider_123",
        paymentId: "test_payment_provider_123",
        signature: "test_signature",
        amountPaid: 999,
        currency: "INR",
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.status).toBe("active");
      expect(result.snapshot.isPro).toBe(true);
      expect(result.snapshot.providerCommissionRate).toBe(5);
    });

    it("should get reduced commission rate for subscribed provider", async () => {
      const rate = await getProviderCommissionRate(testProvider._id.toString());
      
      expect(rate).toBe(5); // Subscription rate
    });

    it("should get default commission rate for non-subscribed provider", async () => {
      const nonSubProvider = await ProviderAccount.create({
        phone: "9990000099",
        name: "Non-Sub Provider",
        email: "nonsub@test.com",
        gender: "male",
        status: "active",
      });

      const rate = await getProviderCommissionRate(nonSubProvider._id.toString());
      
      expect(rate).toBeGreaterThan(5); // Default rate (15%)
    });
  });

  describe("5. Vendor Subscription Purchase Flow", () => {
    it("should activate vendor subscription", async () => {
      const result = await activateSubscription({
        userId: testVendor._id.toString(),
        userType: "vendor",
        plan: testPlanVendor,
        orderId: "test_order_vendor_123",
        paymentId: "test_payment_vendor_123",
        signature: "test_signature",
        amountPaid: 4999,
        currency: "INR",
      });

      expect(result.subscription).toBeDefined();
      expect(result.subscription.status).toBe("active");
      expect(result.snapshot.isEnterprise).toBe(true);
      expect(result.snapshot.monthlyMarketingCredits).toBe(1000);
    });

    it("should have issued marketing credits", async () => {
      const creditEntry = await SubscriptionLedger.findOne({
        userId: testVendor._id.toString(),
        entryType: "marketing_credit_issue",
      });

      expect(creditEntry).toBeDefined();
      expect(creditEntry.direction).toBe("credit");
      expect(creditEntry.amount).toBe(1000);
    });

    it("should get marketing credits balance", async () => {
      const balance = await getMarketingCreditsBalance(testVendor._id.toString());
      
      expect(balance).toBe(1000);
    });

    it("should track marketing credit usage", async () => {
      // Simulate credit usage
      await SubscriptionLedger.create({
        userId: testVendor._id.toString(),
        userType: "vendor",
        subscriptionId: "test_sub_123",
        planId: testPlanVendor.planId,
        entryType: "marketing_credit_usage",
        direction: "debit",
        amount: 200,
        balanceAfter: 800,
        meta: { campaign: "test_campaign" },
      });

      const balance = await getMarketingCreditsBalance(testVendor._id.toString());
      
      expect(balance).toBe(800); // 1000 - 200
    });
  });

  describe("6. Subscription Expiry", () => {
    it("should expire subscriptions past their end date", async () => {
      // Create an expired subscription
      const expiredSub = await UserSubscription.create({
        userId: "expired_user_123",
        userType: "customer",
        planId: testPlanCustomer.planId,
        planName: testPlanCustomer.name,
        subscriptionId: "expired_sub_123",
        status: "active",
        renewalStatus: "manual",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-01-31"), // Past date
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        autoRenew: false,
      });

      await expireStaleSubscriptions(new Date("2026-02-01"));

      const updated = await UserSubscription.findById(expiredSub._id);
      
      expect(updated.status).toBe("expired");
      expect(updated.renewalStatus).toBe("expired");
      expect(updated.endedReason).toBe("period_ended");
    });

    it("should NOT expire active subscriptions", async () => {
      const activeSub = await UserSubscription.findOne({
        userId: testCustomer._id.toString(),
        status: "active",
      });

      expect(activeSub).toBeDefined();
      expect(activeSub.status).toBe("active");
      
      const endDate = new Date(activeSub.currentPeriodEnd);
      const now = new Date();
      expect(endDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("7. Subscription Renewal", () => {
    it("should renew existing subscription and extend period", async () => {
      const beforeRenewal = await UserSubscription.findOne({
        userId: testCustomer._id.toString(),
        status: "active",
      });

      const oldEndDate = new Date(beforeRenewal.currentPeriodEnd);

      const result = await activateSubscription({
        userId: testCustomer._id.toString(),
        userType: "customer",
        plan: testPlanCustomer,
        orderId: "test_order_renewal_123",
        paymentId: "test_payment_renewal_123",
        signature: "test_signature",
        amountPaid: 299,
        currency: "INR",
      });

      expect(result.subscription).toBeDefined();
      
      const newEndDate = new Date(result.subscription.currentPeriodEnd);
      expect(newEndDate.getTime()).toBeGreaterThan(oldEndDate.getTime());
    });

    it("should create renewal ledger entry", async () => {
      const renewalEntry = await SubscriptionLedger.findOne({
        userId: testCustomer._id.toString(),
        entryType: "renewal",
      });

      expect(renewalEntry).toBeDefined();
      expect(renewalEntry.amount).toBe(299);
      expect(renewalEntry.direction).toBe("debit");
    });
  });

  describe("8. Multiple Subscriptions Handling", () => {
    it("should replace old plan when subscribing to different plan", async () => {
      // Create a different plan
      const newPlan = await SubscriptionPlan.create({
        planId: "test_customer_plan_premium",
        name: "Test Premium Plan",
        userType: "customer",
        price: 599,
        durationDays: 90,
        billingCycle: "quarterly",
        isActive: true,
        meta: {
          discountPercentage: 15,
          minCartValueForDiscount: 500,
        },
      });

      const oldSub = await UserSubscription.findOne({
        userId: testCustomer._id.toString(),
        status: "active",
      });

      const result = await activateSubscription({
        userId: testCustomer._id.toString(),
        userType: "customer",
        plan: newPlan,
        orderId: "test_order_upgrade_123",
        paymentId: "test_payment_upgrade_123",
        signature: "test_signature",
        amountPaid: 599,
        currency: "INR",
      });

      expect(result.subscription.planId).toBe("test_customer_plan_premium");

      // Check old subscription was cancelled
      const cancelledSub = await UserSubscription.findById(oldSub._id);
      expect(cancelledSub.status).toBe("cancelled");
      expect(cancelledSub.endedReason).toBe("replaced_by_new_plan");
    });
  });

  describe("9. Edge Cases & Error Handling", () => {
    it("should handle non-existent user gracefully", async () => {
      const snapshot = await getSubscriptionSnapshot("nonexistent_user_999", "customer");
      
      expect(snapshot.isActive).toBe(false);
      expect(snapshot.isPlusMember).toBe(false);
      expect(snapshot.discountPercentage).toBe(0);
    });

    it("should handle inactive plans", async () => {
      const inactivePlan = await SubscriptionPlan.create({
        planId: "test_inactive_plan",
        name: "Inactive Plan",
        userType: "customer",
        price: 199,
        durationDays: 30,
        isActive: false, // Inactive
      });

      const res = await request(app).get("/subscriptions/plans?userType=customer");
      const plans = res.body.plans;
      
      const foundInactive = plans.find(p => p.planId === "test_inactive_plan");
      expect(foundInactive).toBeUndefined(); // Should not be returned
    });

    it("should handle zero marketing credits balance", async () => {
      const balance = await getMarketingCreditsBalance("vendor_with_no_credits");
      
      expect(balance).toBe(0);
    });
  });

  describe("10. Data Integrity Checks", () => {
    it("should have consistent ledger entries", async () => {
      const allEntries = await SubscriptionLedger.find({
        userId: testCustomer._id.toString(),
      }).sort({ createdAt: 1 });

      expect(allEntries.length).toBeGreaterThan(0);
      
      // Check all entries have required fields
      allEntries.forEach(entry => {
        expect(entry.userId).toBeDefined();
        expect(entry.userType).toBeDefined();
        expect(entry.entryType).toBeDefined();
        expect(entry.direction).toBeDefined();
        expect(entry.amount).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have valid subscription periods", async () => {
      const activeSubs = await UserSubscription.find({ status: "active" });

      activeSubs.forEach(sub => {
        const start = new Date(sub.currentPeriodStart);
        const end = new Date(sub.currentPeriodEnd);
        
        expect(end.getTime()).toBeGreaterThan(start.getTime());
        expect(sub.startDate).toBeDefined();
        expect(sub.endDate).toBeDefined();
      });
    });

    it("should have matching plan references", async () => {
      const subs = await UserSubscription.find({});
      
      for (const sub of subs) {
        if (sub.planId.startsWith("test_")) {
          const plan = await SubscriptionPlan.findOne({ planId: sub.planId });
          expect(plan).toBeDefined();
          expect(plan.userType).toBe(sub.userType);
        }
      }
    });
  });
});
