import mongoose from "mongoose";

const AdminAccountSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, index: true },
    fcmTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: "web" },
        lastSeenAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.AdminAccount || mongoose.model("AdminAccount", AdminAccountSchema);
