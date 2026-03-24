import mongoose from "mongoose";

const ProviderDayAvailabilitySchema = new mongoose.Schema(
  {
    providerId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (provider-local)
    // Store only available slots in "hh:mm A" format used by the UI (e.g. "09:00 AM").
    // If a date has no record, backend will fall back to default schedule.
    availableSlots: { type: [String], default: [] },
  },
  { timestamps: true }
);

ProviderDayAvailabilitySchema.index({ providerId: 1, date: 1 }, { unique: true });

export default mongoose.models.ProviderDayAvailability ||
  mongoose.model("ProviderDayAvailability", ProviderDayAvailabilitySchema);

