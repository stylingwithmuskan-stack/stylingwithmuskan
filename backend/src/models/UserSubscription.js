
import mongoose from "mongoose";

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userType: { type: String, enum: ["customer", "provider", "vendor"], required: true },
    planId: { type: String, required: true },
    planName: { type: String, default: "" },
    subscriptionId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending_payment", "active", "expired", "cancelled", "paused", "inactive"],
      default: "pending_payment",
    },
    renewalStatus: {
      type: String,
      enum: ["auto", "manual", "cancel_at_period_end", "expired"],
      default: "manual",
    },
    currentPeriodStart: { type: Date, required: true, default: Date.now },
    currentPeriodEnd: { type: Date, required: true, default: Date.now },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    lastPaymentAt: { type: Date, default: null },
    nextBillingAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endedReason: { type: String, default: "" },
    paymentDetails: {
      gateway: String, // e.g., "razorpay", "stripe"
      paymentId: String,
      orderId: String,
      signature: String,
      amountPaid: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
  },
  { timestamps: true }
);

UserSubscriptionSchema.index({ userId: 1, userType: 1 });
UserSubscriptionSchema.index({ status: 1, endDate: 1 });
UserSubscriptionSchema.index({ "paymentDetails.orderId": 1 });

UserSubscriptionSchema.pre("validate", function keepPeriodsAligned(next) {
  if (!this.currentPeriodStart && this.startDate) this.currentPeriodStart = this.startDate;
  if (!this.currentPeriodEnd && this.endDate) this.currentPeriodEnd = this.endDate;
  if (!this.startDate && this.currentPeriodStart) this.startDate = this.currentPeriodStart;
  if (!this.endDate && this.currentPeriodEnd) this.endDate = this.currentPeriodEnd;
  if (!this.subscriptionId) this.subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  next();
});

export default mongoose.models.UserSubscription || mongoose.model("UserSubscription", UserSubscriptionSchema);
