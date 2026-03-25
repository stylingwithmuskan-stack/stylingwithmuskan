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
      enum: ["booking_cancel", "reassignment", "reminder", "system", "new_booking"],
    },
    meta: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
