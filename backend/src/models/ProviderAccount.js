import mongoose from "mongoose";

const DocumentsSchema = new mongoose.Schema(
  {
    aadharFront: String,
    aadharBack: String,
    panCard: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    upiId: String,
    primaryCategory: [String],
    specializations: [String],
    certifications: [String],
  },
  { _id: false }
);

const ProviderAccountSchema = new mongoose.Schema(
  {
    phone: { type: String, unique: true, required: true },
    name: String,
    email: String,
    city: { type: String, default: "" },
    address: { type: String, default: "" },
    gender: String,
    dob: String,
    experience: String,
    profilePhoto: String,
    documents: DocumentsSchema,
    vendorApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminApprovalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvalStatus: { type: String, enum: ["pending_vendor", "pending_admin", "approved", "rejected", "blocked", "pending", null], default: "pending_vendor" },
    registrationComplete: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    totalJobs: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    currentLocation: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
    insuranceActive: { type: Boolean, default: false },
    trainingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Common admin dashboard filters
ProviderAccountSchema.index({ city: 1, approvalStatus: 1, registrationComplete: 1 });

export default mongoose.models.ProviderAccount || mongoose.model("ProviderAccount", ProviderAccountSchema);
