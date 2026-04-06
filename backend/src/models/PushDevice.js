import mongoose from "mongoose";

const PushDeviceSchema = new mongoose.Schema(
  {
    recipientId: { type: String, required: true, index: true },
    recipientRole: {
      type: String,
      required: true,
      enum: ["user", "provider", "vendor", "admin"],
    },
    fcmToken: { type: String, required: true },
    platform: { type: String, default: "web" },
    deviceKey: { type: String, required: true },
    permission: { type: String, default: "default" },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    preferences: {
      enabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

PushDeviceSchema.index({ recipientId: 1, recipientRole: 1, deviceKey: 1 }, { unique: true });

export default mongoose.model("PushDevice", PushDeviceSchema);
