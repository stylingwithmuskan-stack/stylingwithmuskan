import mongoose from "mongoose";

const SubscriptionLedgerSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userType: { type: String, enum: ["customer", "provider", "vendor"], required: true },
    subscriptionId: { type: String, default: "", index: true },
    planId: { type: String, default: "" },
    entryType: {
      type: String,
      enum: [
        "purchase",
        "renewal",
        "marketing_credit_issue",
        "marketing_credit_usage",
        "performance_commission",
        "discount_adjustment",
        "provider_settlement_adjustment",
        "vendor_billing_adjustment",
      ],
      required: true,
    },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "INR" },
    balanceAfter: { type: Number, default: null },
    occurredAt: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

SubscriptionLedgerSchema.index({ userId: 1, userType: 1, createdAt: -1 });

export default mongoose.models.SubscriptionLedger || mongoose.model("SubscriptionLedger", SubscriptionLedgerSchema);
