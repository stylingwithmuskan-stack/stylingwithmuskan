import mongoose from "mongoose";

const SOSAlertSchema = new mongoose.Schema(
  {
    userType: String,
    userId: String,
    source: String,
    message: String,
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default mongoose.models.SOSAlert || mongoose.model("SOSAlert", SOSAlertSchema);
