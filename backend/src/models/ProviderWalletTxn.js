import mongoose from "mongoose";

const ProviderWalletTxnSchema = new mongoose.Schema(
  {
    providerId: { type: String, required: true },
    bookingId: { type: String, default: "" },
    type: { type: String, default: "" }, // credit | debit | commission_hold | commission_refund
    amount: { type: Number, default: 0 },
    balanceAfter: { type: Number, default: 0 },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

ProviderWalletTxnSchema.index({ providerId: 1, createdAt: -1 });

export default mongoose.models.ProviderWalletTxn || mongoose.model("ProviderWalletTxn", ProviderWalletTxnSchema);
