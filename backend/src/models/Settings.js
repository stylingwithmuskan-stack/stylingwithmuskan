import mongoose from "mongoose";

const ReferralSettingsSchema = new mongoose.Schema(
  {
    referrerBonus: { type: Number, default: 100 },
    refereeBonus: { type: Number, default: 50 },
    maxReferrals: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
    adminManagedCodes: { type: [String], default: [] },
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
    minLeadTimeMinutes: { type: Number, default: 30 },
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

const PerformanceSettingsSchema = new mongoose.Schema(
  {
    minWeeklyHours: { type: Number, default: 20 },
    minRatingThreshold: { type: Number, default: 4.5 },
    maxCancellationsThreshold: { type: Number, default: 5 },
  },
  { timestamps: true }
);

const SystemSettingsSchema = new mongoose.Schema(
  {
    menSectionEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SubscriptionSettingsSchema = new mongoose.Schema(
  {
    userQuarterlyDiscountDefault: { type: Number, default: 10 },
    userAnnualDiscountDefault: { type: Number, default: 15 },
    defaultDiscountFundedBy: {
      type: String,
      enum: ["platform", "provider", "vendor"],
      default: "platform",
    },
    eliteAccessRule: {
      type: String,
      enum: ["Pro + High Rated"],
      default: "Pro + High Rated",
    },
    eliteMinRating: { type: Number, default: 4.7 },
    eliteMinJobs: { type: Number, default: 25 },
    providerDefaultCommissionRate: { type: Number, default: 15 },
    providerLeadPriorityWindowMinutes: { type: Number, default: 5 },
    vendorMonthlyFee: { type: Number, default: 4999 },
    vendorPerformanceCommissionType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "percentage",
    },
    vendorPerformanceCommissionValue: { type: Number, default: 2 },
    vendorMarketingCreditsMonthly: { type: Number, default: 1000 },
  },
  { timestamps: true }
);

export const ReferralSettings = mongoose.models.ReferralSettings || mongoose.model("ReferralSettings", ReferralSettingsSchema);
export const CommissionSettings = mongoose.models.CommissionSettings || mongoose.model("CommissionSettings", CommissionSettingsSchema);
export const BookingSettings = mongoose.models.BookingSettings || mongoose.model("BookingSettings", BookingSettingsSchema);
export const PerformanceSettings = mongoose.models.PerformanceSettings || mongoose.model("PerformanceSettings", PerformanceSettingsSchema);
export const SystemSettings = mongoose.models.SystemSettings || mongoose.model("SystemSettings", SystemSettingsSchema);
export const SubscriptionSettings = mongoose.models.SubscriptionSettings || mongoose.model("SubscriptionSettings", SubscriptionSettingsSchema);
