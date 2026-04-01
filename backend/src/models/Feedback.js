import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, default: "" },
    providerId: { type: String, index: true },
    providerName: { type: String, default: "" },
    serviceName: { type: String, default: "" },
    serviceCategory: { type: String, default: "" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    tags: { type: [String], default: [] },
    type: {
      type: String,
      enum: ["customer_to_provider", "provider_to_customer"],
      default: "customer_to_provider",
    },
    status: {
      type: String,
      enum: ["active", "hidden", "flagged"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
FeedbackSchema.index({ createdAt: -1 });
FeedbackSchema.index({ rating: 1 });
FeedbackSchema.index({ type: 1 });
FeedbackSchema.index({ status: 1 });
FeedbackSchema.index({ providerId: 1, createdAt: -1 });

export default mongoose.models.Feedback || mongoose.model("Feedback", FeedbackSchema);
