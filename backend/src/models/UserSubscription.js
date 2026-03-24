
import mongoose from "mongoose";

const UserSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // Can be customer, provider, or vendor ID
    userType: { type: String, enum: ["customer", "provider", "vendor"], required: true },
    planId: { type: String, required: true },
    subscriptionId: { type: String, required: true, index: true }, // From payment gateway
    status: { type: String, enum: ["active", "inactive", "cancelled", "paused"], default: "inactive" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    paymentDetails: {
      gateway: String, // e.g., "razorpay", "stripe"
      paymentId: String,
      orderId: String,
    },
  },
  { timestamps: true }
);

UserSubscriptionSchema.index({ userId: 1, userType: 1 });
UserSubscriptionSchema.index({ status: 1, endDate: 1 });

export default mongoose.models.UserSubscription || mongoose.model("UserSubscription", UserSubscriptionSchema);
