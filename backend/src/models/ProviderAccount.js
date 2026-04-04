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
    services: [String],
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
    zones: { type: [String], default: [] },
    pendingZones: { type: [String], default: [] },
    
    // Enhanced zone request tracking (Phase 4)
    pendingZoneRequests: [{
      zoneName: { type: String, required: true },
      isNewZone: { type: Boolean, default: false },
      requestedAt: { type: Date, default: Date.now },
      providerAddress: { type: String, default: "" },
      providerLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
      },
      vendorStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      vendorReviewedAt: { type: Date, default: null },
      vendorReviewedBy: { type: String, default: "" },
      adminStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
      adminReviewedAt: { type: Date, default: null },
      adminReviewedBy: { type: String, default: "" },
      rejectionReason: { type: String, default: "" }
    }],
    
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
    lastLocationUpdate: { type: Date, default: null },
    insuranceActive: { type: Boolean, default: false },
    trainingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Common admin dashboard filters
ProviderAccountSchema.index({ city: 1, approvalStatus: 1, registrationComplete: 1 });

// Geo-spatial index for location-based queries (Phase 1)
ProviderAccountSchema.index({ currentLocation: '2dsphere' });

export default mongoose.models.ProviderAccount || mongoose.model("ProviderAccount", ProviderAccountSchema);
