import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    // Legacy fields used by server quote
    type: { type: String, enum: ["FIXED", "PERCENT"], default: "PERCENT" },
    value: { type: Number, default: 0 },
    usagePerUser: { type: Number, default: 1 },
    totalUsageLimit: { type: Number, default: 100 },
    // UI-friendly fields used by admin/user pages
    discountType: { type: String, enum: ["percentage", "flat"], default: "percentage" },
    discountValue: { type: Number, default: 0 },
    minOrder: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    totalLimit: { type: Number, default: 100 },
    expiryDate: { type: String, default: "" },
    category: { type: String, default: "All" },
    zone: { type: String, default: "" },
    firstTimeOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
