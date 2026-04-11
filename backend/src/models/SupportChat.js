import mongoose from "mongoose";

const SupportChatSchema = new mongoose.Schema(
  {
    participantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    participantName: { type: String, default: "" },
    participantPhone: { type: String, default: "" },
    participantRole: { type: String, enum: ["provider", "vendor"], required: true },
    sender: { type: String, enum: ["provider", "vendor", "admin"], required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast conversation loading by participant + time
SupportChatSchema.index({ participantId: 1, createdAt: 1 });

// Admin listing: find latest messages grouped by participant
SupportChatSchema.index({ participantId: 1, createdAt: -1 });

// Unread count queries
SupportChatSchema.index({ participantId: 1, sender: 1, read: 1 });

export default mongoose.models.SupportChat || mongoose.model("SupportChat", SupportChatSchema);
