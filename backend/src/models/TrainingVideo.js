import mongoose from "mongoose";

const TrainingVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    duration: { type: String, default: "00:00" },
    status: { type: String, default: "New" }, // "Mandatory", "New", "Ongoing", "Completed"
    thumbnail: { type: String, default: "" },
    provider: { type: String, default: "StylingwithMuskan Academy" }, // Who created the course
    description: { type: String, default: "" },
    views: { type: String, default: "0" },
    difficulty: { type: String, default: "Beginner" }, // "Beginner", "Intermediate", "Advanced"
    videoUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.TrainingVideo || mongoose.model("TrainingVideo", TrainingVideoSchema);
