import ProviderAccount from "../models/ProviderAccount.js";
import UserSubscription from "../models/UserSubscription.js";
import { BookingSettings } from "../models/Settings.js";
import { ServiceType, Category } from "../models/Content.js";
import { DEFAULT_TIME_SLOTS, isIsoDate } from "./slots.js";
import { computeAvailableSlots } from "./availability.js";
import { findZonesContainingPoint, sortProvidersByProximity } from "./geoMatching.js";
import { getSubscriptionSnapshot } from "./subscriptions.js";

const DEFAULT_BOOKING_SETTINGS = {
  minBookingAmount: 500,
  minLeadTimeMinutes: 30,
  providerBufferMinutes: 60,
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

const CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;
let contentCache = {
  loadedAt: 0,
  serviceTypeIdToLabel: new Map(),
  categoryIdToName: new Map(),
};

async function getContentMaps() {
  const now = Date.now();
  if (contentCache.loadedAt && (now - contentCache.loadedAt) < CONTENT_CACHE_TTL_MS) {
    return contentCache;
  }
  const [types, cats] = await Promise.all([
    ServiceType.find().select("id label").lean(),
    Category.find().select("id name").lean(),
  ]);
  contentCache = {
    loadedAt: now,
    serviceTypeIdToLabel: new Map((types || []).map(t => [t.id, t.label])),
    categoryIdToName: new Map((cats || []).map(c => [c.id, c.name])),
  };
  return contentCache;
}

function norm(s) {
  return String(s || "").trim();
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesSpecialty(provider, wantCats, wantTypes, wantCatLabels, wantTypeLabels) {
  const spec = Array.isArray(provider?.documents?.specializations) ? provider.documents.specializations : [];
  const primary = Array.isArray(provider?.documents?.primaryCategory) ? provider.documents.primaryCategory : [];
  if (spec.length === 0 && primary.length === 0) return true;
  const all = [...spec, ...primary];
  return all.some((s) =>
    wantCats.has(s) || wantTypes.has(s) || wantCatLabels.has(s) || wantTypeLabels.has(s)
  );
}

async function resolveSettings(settings) {
  if (settings) return settings;
  const s = await BookingSettings.findOne().lean();
  return s || DEFAULT_BOOKING_SETTINGS;
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
    isOnline: filters.isOnline !== undefined ? filters.isOnline : true,
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
        return ProviderAccount.find({
          ...baseQuery,
          $or: [
            { zones: { $in: zonesContainingPoint } },
            { pendingZones: { $in: zonesContainingPoint } },
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

  // No zone provided: fallback to city-wide search
  return ProviderAccount.find(baseQuery).lean();
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

  const wantCats = new Set((items || []).map((it) => String(it?.category || "")).filter(Boolean));
  const wantTypes = new Set((items || []).map((it) => String(it?.serviceType || "")).filter(Boolean));
  let wantCatLabels = new Set();
  let wantTypeLabels = new Set();
  if (wantCats.size > 0 || wantTypes.size > 0) {
    try {
      const maps = await getContentMaps();
      wantTypeLabels = new Set(
        [...wantTypes].map((id) => maps.serviceTypeIdToLabel.get(id)).filter(Boolean)
      );
      wantCatLabels = new Set(
        [...wantCats].map((id) => maps.categoryIdToName.get(id)).filter(Boolean)
      );
    } catch {}
  }

  let providers = await findProvidersZoneStrict(
    { ...address, city: bookingCity, cityId: bookingCityId, zone: bookingZone, zoneId: bookingZoneId },
    { approvalStatus: "approved", registrationComplete: true, isOnline: true }
  );

  providers = providers.filter((p) => matchesSpecialty(p, wantCats, wantTypes, wantCatLabels, wantTypeLabels));

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
  const limit = configuredLimit > 0 ? Math.min(configuredLimit, 5) : 5;
  const candidateProviders = limit > 0 ? candidates.slice(0, limit) : candidates;

  return {
    candidateProviders,
    meta: { bookingCity, bookingCityId, bookingZone, bookingZoneId },
  };
}
