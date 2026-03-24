import mongoose from "mongoose";

const LeaveRequestSchema = new mongoose.Schema(
  {
    providerId: { type: String, required: true },
    phone: { type: String, required: true },
    type: { type: String, enum: ["Full Day", "Half Day"], default: "Full Day" },
    startAt: { type: Date, required: true },
    // Computed inclusive end datetime (end-of-day local) for overlap queries.
    endAt: { type: Date, default: null },
    endDate: { type: String, default: "" },
    reason: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

export default mongoose.models.LeaveRequest || mongoose.model("LeaveRequest", LeaveRequestSchema);
