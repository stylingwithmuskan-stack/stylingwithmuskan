import mongoose from "mongoose";

const PushBroadcastSchema = new mongoose.Schema(
  {
    createdBy: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: "/notifications" },
    icon: { type: String, default: "" },
    filters: {
      roles: { type: [String], default: [] },
      city: { type: String, default: "" },
      subscriptionPlanId: { type: String, default: "" },
      subscriptionStatus: { type: String, default: "" },
    },
    stats: {
      targeted: { type: Number, default: 0 },
      notificationsCreated: { type: Number, default: 0 },
      pushSent: { type: Number, default: 0 },
      pushFailed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.models.PushBroadcast || mongoose.model("PushBroadcast", PushBroadcastSchema);
