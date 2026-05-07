import mongoose from "mongoose";

const SOSAlertSchema = new mongoose.Schema(
  {
    userType: String,
    userId: String,
    userName: String,
    userPhone: String,
    city: String,
    source: String,
    message: String,
    location: {
      lat: Number,
      lng: Number,
    },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

export default mongoose.models.SOSAlert || mongoose.model("SOSAlert", SOSAlertSchema);
