
import mongoose from "mongoose";

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    planId: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    userType: { type: String, enum: ["customer", "provider", "vendor"], required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "annual", "custom"],
      default: "custom",
    },
    tagline: { type: String, default: "" },
    benefits: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    meta: {
      discountPercentage: { type: Number, default: 0 },
      minCartValueForDiscount: { type: Number, default: 0 },
      discountFundedBy: {
        type: String,
        enum: ["platform", "provider", "vendor"],
        default: "platform",
      },
      freeCancellationWindowHours: { type: Number, default: 0 },
      zeroConvenienceFee: { type: Boolean, default: false },
      zeroTravelFee: { type: Boolean, default: false },
      priorityBookingEnabled: { type: Boolean, default: false },
      eliteAccessEnabled: { type: Boolean, default: false },
      eliteMinRating: { type: Number, default: 0 },
      eliteMinJobs: { type: Number, default: 0 },
      providerCommissionRate: { type: Number, default: null },
      commissionRate: { type: Number, default: null },
      leadPriorityWindowMinutes: { type: Number, default: 0 },
      premiumTrainingAccess: { type: Boolean, default: false },
      proBadgeEnabled: { type: Boolean, default: false },
      boostedVisibilityEnabled: { type: Boolean, default: false },
      marketingCreditsMonthly: { type: Number, default: 0 },
      marketingCredits: { type: Number, default: 0 },
      prioritySupport: { type: Boolean, default: false },
      subAccountsEnabled: { type: Boolean, default: false },
      vendorPerformanceCommissionType: {
        type: String,
        enum: ["fixed", "percentage"],
        default: "percentage",
      },
      vendorPerformanceCommissionValue: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.pre("save", function normalizePlanMeta(next) {
  if (this.meta) {
    if (this.meta.providerCommissionRate === null || this.meta.providerCommissionRate === undefined) {
      this.meta.providerCommissionRate = this.meta.commissionRate ?? null;
    }
    if (this.meta.commissionRate === null || this.meta.commissionRate === undefined) {
      this.meta.commissionRate = this.meta.providerCommissionRate ?? null;
    }
    if (!this.meta.marketingCreditsMonthly && this.meta.marketingCredits) {
      this.meta.marketingCreditsMonthly = this.meta.marketingCredits;
    }
    if (!this.meta.marketingCredits && this.meta.marketingCreditsMonthly) {
      this.meta.marketingCredits = this.meta.marketingCreditsMonthly;
    }
  }
  next();
});

export default mongoose.models.SubscriptionPlan || mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);
