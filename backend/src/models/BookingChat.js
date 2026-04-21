import mongoose from "mongoose";

const BookingChatSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ["customer", "provider"], required: true },
    message: { type: String, required: true },
    readBy: [{ type: String }], // Array of IDs who have read the message
  },
  { timestamps: true }
);

// Indexes for fast message retrieval per booking
BookingChatSchema.index({ bookingId: 1, createdAt: 1 });

export default mongoose.models.BookingChat || mongoose.model("BookingChat", BookingChatSchema);
