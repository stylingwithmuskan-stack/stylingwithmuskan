import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      required: true,
      enum: ["user", "provider", "vendor", "admin"],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      required: true,
      // Common types for all modules
    },
    meta: { type: Object, default: {} },
    sound: { type: String, default: null },
    link: { type: String, default: "/notifications" },
    delivery: {
      push: {
        status: {
          type: String,
          enum: ["pending", "queued", "sent", "failed", "disabled"],
          default: "pending",
        },
        failureCount: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: null },
        sentAt: { type: Date, default: null },
        lastError: { type: String, default: "" },
      },
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ "meta.dedupeKey": 1 }, { sparse: true });

export default mongoose.model("Notification", NotificationSchema);
