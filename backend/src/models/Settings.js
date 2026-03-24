import mongoose from "mongoose";

const ReferralSettingsSchema = new mongoose.Schema(
  {
    referrerBonus: { type: Number, default: 100 },
    refereeBonus: { type: Number, default: 50 },
    maxReferrals: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const CommissionSettingsSchema = new mongoose.Schema(
  {
    rate: { type: Number, default: 15 },
    minPayout: { type: Number, default: 500 },
  },
  { timestamps: true }
);

const BookingSettingsSchema = new mongoose.Schema(
  {
    minBookingAmount: { type: Number, default: 500 },
    minLeadTimeMinutes: { type: Number, default: 60 },
    providerBufferMinutes: { type: Number, default: 60 },
    serviceStartTime: { type: String, default: "08:00" },
    serviceEndTime: { type: String, default: "19:00" },
    slotIntervalMinutes: { type: Number, default: 30 },
    maxBookingDays: { type: Number, default: 6 },
    maxServicesPerBooking: { type: Number, default: 10 },
    providerSearchLimit: { type: Number, default: 5 },
    bookingHoldMinutes: { type: Number, default: 10 },
    maxServiceRadiusKm: { type: Number, default: 5 },
    providerNotificationStartTime: { type: String, default: "07:00" },
    providerNotificationEndTime: { type: String, default: "22:00" },
    allowPayAfterService: { type: Boolean, default: true },
    prebookingRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ReferralSettings = mongoose.models.ReferralSettings || mongoose.model("ReferralSettings", ReferralSettingsSchema);
export const CommissionSettings = mongoose.models.CommissionSettings || mongoose.model("CommissionSettings", CommissionSettingsSchema);
export const BookingSettings = mongoose.models.BookingSettings || mongoose.model("BookingSettings", BookingSettingsSchema);
