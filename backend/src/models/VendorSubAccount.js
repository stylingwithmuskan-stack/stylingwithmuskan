import mongoose from "mongoose";

const VendorSubAccountSchema = new mongoose.Schema(
  {
    vendorId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["operations", "support", "finance"], default: "operations" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

VendorSubAccountSchema.index({ vendorId: 1, email: 1 });

export default mongoose.models.VendorSubAccount || mongoose.model("VendorSubAccount", VendorSubAccountSchema);
