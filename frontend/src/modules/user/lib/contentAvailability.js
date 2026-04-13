export function resolveLocationKeys(location) {
  if (!location) return [];

  if (typeof location === "string") {
    const value = String(location || "").trim();
    return value ? [value] : [];
  }

  const keys = [
    location.zone,
    location.zoneName,
    location.city,
    location.cityName,
    location.area,
    location.locality,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(keys));
}

export function getAvailabilityHierarchy(item, { categories = [], serviceTypes = [] } = {}) {
  if (!item || typeof item !== "object") {
    return { item, category: null, parent: null };
  }

  const category = item.category
    ? (categories || []).find((entry) => entry?.id === item.category) || null
    : item.serviceType
    ? (categories || []).find((entry) => entry?.id === item.id) || null
    : null;

  const parentServiceTypeId = item.serviceType || category?.serviceType || "";
  const parent = parentServiceTypeId
    ? (serviceTypes || []).find((entry) => entry?.id === parentServiceTypeId) || null
    : null;

  return { item, category, parent };
}

export function getEffectiveAvailabilityZones(item, ctx = {}) {
  const { item: self, category, parent } = getAvailabilityHierarchy(item, ctx);
  const candidates = [self?.zones, category?.zones, parent?.zones];

  for (const zones of candidates) {
    if (Array.isArray(zones) && zones.length > 0) {
      return zones.map((zone) => String(zone || "").trim()).filter(Boolean);
    }
  }

  return [];
}

export function isContentAvailable(item, location, selectedDate = null, selectedTime = null, ctx = {}) {
  if (!item) return true;

  const effectiveZones = getEffectiveAvailabilityZones(item, ctx);
  const locationKeys = resolveLocationKeys(location);

  if (effectiveZones.length > 0 && locationKeys.length > 0) {
    const matches = effectiveZones.some((zone) => locationKeys.includes(zone));
    if (!matches) return false;
  }

  if (item.disabledDates && item.disabledDates.length > 0) {
    const checkDate = selectedDate || new Date().toISOString().split("T")[0];
    const checkTime =
      selectedTime ||
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    const isBlocked = item.disabledDates.some((block) => {
      if (block.date !== checkDate) return false;
      if (block.fullDay) return true;
      return checkTime >= block.startTime && checkTime <= block.endTime;
    });

    if (isBlocked) return false;
  }

  return true;
}
