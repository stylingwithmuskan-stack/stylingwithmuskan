import { City, Zone } from "../models/CityZone.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function sameText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function isFiniteCoord(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function pointOnSegment(px, py, x1, y1, x2, y2) {
  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);
  if (Math.abs(cross) > 1e-10) return false;
  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= 0;
}

export function pointInPolygon(lat, lng, coordinates = []) {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng) || !Array.isArray(coordinates) || coordinates.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const xi = Number(coordinates[i]?.lng);
    const yi = Number(coordinates[i]?.lat);
    const xj = Number(coordinates[j]?.lng);
    const yj = Number(coordinates[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    if (pointOnSegment(lng, lat, xi, yi, xj, yj)) return true;
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function centroid(coordinates = []) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;
  const valid = coordinates.filter((c) => isFiniteCoord(c?.lat) && isFiniteCoord(c?.lng));
  if (valid.length === 0) return null;
  const lat = valid.reduce((sum, c) => sum + Number(c.lat), 0) / valid.length;
  const lng = valid.reduce((sum, c) => sum + Number(c.lng), 0) / valid.length;
  return { lat, lng };
}

export async function resolveServiceLocation({ lat, lng, cityId = "", cityName = "" } = {}) {
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) {
    return {
      insideServiceArea: false,
      cityId: "",
      cityName: normalizeText(cityName),
      zoneId: "",
      zoneName: "",
      reason: "invalid_coordinates",
    };
  }

  const cityFilter = cityId
    ? { _id: cityId }
    : cityName
    ? { name: new RegExp(`^${normalizeText(cityName)}$`, "i"), status: "active" }
    : null;

  let cityDoc = null;
  if (cityFilter) {
    cityDoc = await City.findOne(cityFilter).lean();
  }

  const zonesQuery = { status: "active" };
  if (cityDoc?._id) zonesQuery.city = cityDoc._id;
  const zones = await Zone.find(zonesQuery).populate("city").lean();

  let matchedZone = null;
  for (const zone of zones) {
    if (!Array.isArray(zone?.coordinates) || zone.coordinates.length < 3) continue;
    if (pointInPolygon(lat, lng, zone.coordinates)) {
      matchedZone = zone;
      break;
    }
  }

  const matchedCity = matchedZone?.city || cityDoc || null;
  const zoneCentroid = matchedZone ? centroid(matchedZone.coordinates) : null;

  return {
    insideServiceArea: !!matchedZone,
    cityId: matchedCity?._id?.toString?.() || cityDoc?._id?.toString?.() || "",
    cityName: matchedCity?.name || cityDoc?.name || normalizeText(cityName),
    zoneId: matchedZone?._id?.toString?.() || "",
    zoneName: matchedZone?.name || "",
    coordinates: { lat, lng },
    zoneCentroid,
    reason: matchedZone ? "zone_match" : (matchedCity ? "out_of_zone" : "city_not_found"),
  };
}

export async function syncCityCenterFromZone(cityId, coordinates = []) {
  const center = centroid(coordinates);
  if (!cityId || !center) return null;
  const city = await City.findById(cityId);
  if (!city) return null;
  if (!isFiniteCoord(city.mapCenterLat) || !isFiniteCoord(city.mapCenterLng)) {
    city.mapCenterLat = center.lat;
    city.mapCenterLng = center.lng;
    city.mapZoom = Number(city.mapZoom || 12);
    await city.save();
  }
  return city.toObject();
}

export async function ensureCityAndZoneNames({ cityId = "", zoneId = "", cityName = "", zoneName = "" } = {}) {
  let nextCityName = normalizeText(cityName);
  let nextZoneName = normalizeText(zoneName);
  let nextCityId = normalizeText(cityId);
  let nextZoneId = normalizeText(zoneId);

  if (nextZoneId && !nextZoneName) {
    const zone = await Zone.findById(nextZoneId).populate("city").lean();
    if (zone) {
      nextZoneName = zone.name || nextZoneName;
      nextCityId = zone.city?._id?.toString?.() || nextCityId;
      nextCityName = zone.city?.name || nextCityName;
    }
  }

  if (nextCityId && !nextCityName) {
    const city = await City.findById(nextCityId).lean();
    if (city) nextCityName = city.name || nextCityName;
  }

  if (!nextCityId && nextCityName) {
    const city = await City.findOne({ name: new RegExp(`^${normalizeText(nextCityName)}$`, "i") }).lean();
    if (city) nextCityId = city._id?.toString?.() || "";
  }

  if (!nextZoneId && nextZoneName && nextCityId) {
    const zone = await Zone.findOne({
      city: nextCityId,
      name: new RegExp(`^${normalizeText(nextZoneName)}$`, "i"),
      status: "active",
    }).lean();
    if (zone) nextZoneId = zone._id?.toString?.() || "";
  }

  return {
    cityId: nextCityId,
    cityName: nextCityName,
    zoneId: nextZoneId,
    zoneName: nextZoneName,
  };
}

export function locationOutOfZoneMessage() {
  return "Your current location is out of zone, apply for the custom zone.";
}

export function belongsToCity(entity, cityId = "", cityName = "") {
  if (!entity) return false;
  if (cityId && String(entity.cityId || "") === String(cityId)) return true;
  if (cityName && sameText(entity.city, cityName)) return true;
  return false;
}
