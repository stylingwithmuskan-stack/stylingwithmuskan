import mongoose from "mongoose";

const AdminAccountSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.AdminAccount || mongoose.model("AdminAccount", AdminAccountSchema);
