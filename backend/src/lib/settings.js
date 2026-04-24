import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";

export const DEFAULT_BOOKING_SETTINGS = {
  minBookingAmount: 500,
  minLeadTimeMinutes: 30,
  providerBufferMinutes: 30,
  serviceStartTime: "08:00",
  serviceEndTime: "19:00",
  slotIntervalMinutes: 30,
  maxBookingDays: 6,
  maxServicesPerBooking: 10,
  providerSearchLimit: 5,
  bookingHoldMinutes: 10,
  maxServiceRadiusKm: 5,
  providerNotificationStartTime: "07:00",
  providerNotificationEndTime: "22:00",
  allowPayAfterService: true,
  prebookingRequired: false,
};

/**
 * Resolves effective booking settings by merging BookingSettings and OfficeSettings.
 * OfficeSettings (Admin) take priority.
 */
export async function resolveBookingSettings() {
  const [s, office] = await Promise.all([
    BookingSettings.findOne().lean(),
    OfficeSettings.findOne().lean(),
  ]);

  const base = s || DEFAULT_BOOKING_SETTINGS;
  const effective = { ...base };

  // Prioritize OfficeSettings (Admin overrides)
  if (office) {
    if (office.startTime) {
      effective.serviceStartTime = office.startTime;
      effective.startTime = office.startTime; // Keep both for safety
    }
    if (office.endTime) {
      effective.serviceEndTime = office.endTime;
      effective.endTime = office.endTime; // Keep both for safety
    }
    if (office.bufferMinutes !== undefined) {
      effective.bufferMinutes = office.bufferMinutes;
    }
    if (office.autoAssign !== undefined) {
      effective.autoAssign = office.autoAssign;
    }
  }

  return effective;
}
