import ProviderAccount from "../models/ProviderAccount.js";
import UserSubscription from "../models/UserSubscription.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { resolveBookingSettings } from "./settings.js";
import { DEFAULT_TIME_SLOTS, isIsoDate } from "./slots.js";
import { computeAvailableSlots } from "./availability.js";
import { findZonesContainingPoint, sortProvidersByProximity } from "./geoMatching.js";
import { getSubscriptionSnapshot } from "./subscriptions.js";
import { providerMatchesRequestedSpecialties, resolveRequestedSpecialtySets } from "./serviceMatching.js";

const DEFAULT_BOOKING_SETTINGS = {
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

function norm(s) {
  return String(s || "").trim();
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveSettings(settings) {
  if (settings) return settings;
  return resolveBookingSettings();
}

async function findProvidersZoneStrict(address, filters = {}) {
  const city = norm(address?.city);
  const cityId = norm(address?.cityId);
  const zone = norm(address?.zone || address?.area);
  const zoneId = norm(address?.zoneId);
  const lat = address?.lat;
  const lng = address?.lng;

  if (!city && !cityId) return [];

  const baseQuery = {
    approvalStatus: filters.approvalStatus || "approved",
    registrationComplete: filters.registrationComplete !== undefined ? filters.registrationComplete : true,
    ...(filters.isOnline !== undefined ? { isOnline: filters.isOnline } : {}),
    ...(cityId ? { cityId } : { city: { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") } }),
  };

  if (zoneId) {
    return ProviderAccount.find({
      ...baseQuery,
      $or: [
        { serviceZoneIds: zoneId },
        { zoneIds: zoneId },
        { baseZoneId: zoneId },
      ],
    }).lean();
  }

  if (zone) {
    if (typeof lat === "number" && typeof lng === "number") {
      const zonesContainingPoint = await findZonesContainingPoint(lat, lng, city);
      if (zonesContainingPoint.length > 0) {
        const zoneRegexes = zonesContainingPoint.map((z) => new RegExp(`^${escapeRegex(z)}$`, "i"));
        return ProviderAccount.find({
          ...baseQuery,
          $or: [
            { zones: { $in: zoneRegexes } },
            { pendingZones: { $in: zoneRegexes } },
          ],
        }).lean();
      }
    }

    return ProviderAccount.find({
      ...baseQuery,
      $or: [
        { zones: { $in: [new RegExp(`^${escapeRegex(zone)}$`, "i")] } },
        { pendingZones: { $in: [new RegExp(`^${escapeRegex(zone)}$`, "i")] } },
      ],
    }).lean();
  }

  // No zone provided or matched: return empty to ensure strict zone enforcement as per user request
  return [];
}

export async function buildAssignmentCandidates({
  address,
  slot,
  items = [],
  settings,
  customerId,
  subscriptionSnapshot,
  requestedDurationMinutes,
  useCache = true,
} = {}) {
  const resolvedSettings = await resolveSettings(settings);
  const bookingCity = norm(address?.city);
  const bookingCityId = norm(address?.cityId);
  const bookingZone = norm(address?.zone || address?.area);
  const bookingZoneId = norm(address?.zoneId);

  const requestedSpecialties = await resolveRequestedSpecialtySets({
    categoryValues: (items || []).map((it) => String(it?.category || "")).filter(Boolean),
    serviceTypeValues: (items || []).map((it) => String(it?.serviceType || "")).filter(Boolean),
  });

  let providers = await findProvidersZoneStrict(
    { ...address, city: bookingCity, cityId: bookingCityId, zone: bookingZone, zoneId: bookingZoneId },
    { approvalStatus: "approved", registrationComplete: true }
  );

  providers = providers.filter((p) => providerMatchesRequestedSpecialties(p, requestedSpecialties));

  const activeProviderSubs = await UserSubscription.find({
    userType: "provider",
    status: "active",
  }).lean();
  const proPartnerIds = activeProviderSubs.map((s) => s.userId);

  const snapshot =
    subscriptionSnapshot ||
    (customerId
      ? await getSubscriptionSnapshot(String(customerId), "customer")
      : { isPlusMember: false, eliteAccessEnabled: false, eliteMinRating: 0, eliteMinJobs: 0 });

  const eliteMinRating = Number(snapshot.eliteMinRating || 0);
  const eliteMinJobs = Number(snapshot.eliteMinJobs || 0);
  const qualifiesAsElite = (provider) =>
    snapshot.isPlusMember &&
    snapshot.eliteAccessEnabled &&
    proPartnerIds.includes(provider._id.toString()) &&
    Number(provider.rating || 0) >= eliteMinRating &&
    Number(provider.totalJobs || 0) >= eliteMinJobs;

  const sorted = await sortProvidersByProximity(
    providers,
    address?.lat,
    address?.lng,
    proPartnerIds,
    qualifiesAsElite
  );

  const requestedDate = norm(slot?.date);
  const requestedTime = norm(slot?.time);
  const wantsKnownDate = isIsoDate(requestedDate);
  const wantsKnownSlot = DEFAULT_TIME_SLOTS.includes(requestedTime);

  const isProviderAvailableAtSlot = async (providerId) => {
    if (!wantsKnownSlot || !wantsKnownDate) return true;
    const avail = await computeAvailableSlots(providerId, requestedDate, resolvedSettings, {
      requestedDurationMinutes,
      useCache,
    });
    return avail?.slotMap?.[requestedTime] === true;
  };

  const candidates = [];
  for (const s of sorted) {
    const providerId = s._id?.toString() || s.id;
    if (!providerId) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isProviderAvailableAtSlot(providerId)) {
      candidates.push(providerId);
    }
  }

  const configuredLimit = Math.max(Number(resolvedSettings?.providerSearchLimit || 0), 0);
  // Hard limit to 5 providers for vendor escalation flow
  const MAX_PROVIDERS_BEFORE_VENDOR_ESCALATION = 5;
  const limit = configuredLimit > 0 
    ? Math.min(configuredLimit, MAX_PROVIDERS_BEFORE_VENDOR_ESCALATION) 
    : MAX_PROVIDERS_BEFORE_VENDOR_ESCALATION;
  const candidateProviders = limit > 0 ? candidates.slice(0, limit) : candidates;

  return {
    candidateProviders,
    meta: { bookingCity, bookingCityId, bookingZone, bookingZoneId },
  };
}
