import mongoose from "mongoose";

const PushDeviceSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      required: true,
      enum: ["user", "provider", "vendor", "admin"],
      index: true,
    },
    fcmToken: { type: String, required: true },
    platform: { type: String, default: "web" },
    deviceKey: { type: String, required: true, index: true },
    permission: { type: String, default: "default" },
    preferences: {
      enabled: { type: Boolean, default: true },
    },
    isActive: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
    lastSuccessAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

PushDeviceSchema.index({ recipientId: 1, recipientRole: 1, deviceKey: 1 }, { unique: true });
PushDeviceSchema.index({ fcmToken: 1 });

export default mongoose.models.PushDevice || mongoose.model("PushDevice", PushDeviceSchema);
