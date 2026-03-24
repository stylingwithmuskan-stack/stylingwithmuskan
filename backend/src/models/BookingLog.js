import mongoose from "mongoose";

const BookingLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    userId: { type: String, default: "" },
    bookingId: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.BookingLog || mongoose.model("BookingLog", BookingLogSchema);
