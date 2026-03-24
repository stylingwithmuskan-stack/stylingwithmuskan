import mongoose from "mongoose";

const VendorSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, index: true },
    phone: String,
    city: String,
    status: { type: String, enum: ["approved", "pending", "rejected", "blocked"], default: "approved" },
    businessName: String,
  },
  { timestamps: true }
);

// Analytics/admin filters often query by city
VendorSchema.index({ city: 1 });

export default mongoose.models.Vendor || mongoose.model("Vendor", VendorSchema);
