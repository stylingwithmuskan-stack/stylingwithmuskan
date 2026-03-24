
import mongoose from "mongoose";

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    planId: { type: String, unique: true, required: true }, // e.g., "swm_plus_quarterly", "swm_pro_monthly"
    name: { type: String, required: true }, // e.g., "SWM Plus Quarterly", "SWM Pro Partner"
    userType: { type: String, enum: ["customer", "provider", "vendor"], required: true },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true }, // e.g., 30 for monthly, 90 for quarterly, 365 for annually
    benefits: { type: [String], default: [] }, // e.g., ["FLAT_10_PERCENT_OFF", "ZERO_CONVENIENCE_FEES"]
    isActive: { type: Boolean, default: true },
    // Metadata for different plans
    meta: {
      // For SWM Plus
      discountPercentage: { type: Number, default: 0 },
      minCartValueForDiscount: { type: Number, default: 0 },
      // For SWM Pro Partner
      commissionRate: { type: Number, default: null }, // Null means default rate applies
      // For SWM City Manager
      marketingCredits: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.models.SubscriptionPlan || mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);
