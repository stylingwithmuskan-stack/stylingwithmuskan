/**
 * Geo-Spatial Zone Matching Library
 * Provides polygon-based zone matching and distance-based provider sorting
 */

import { City, Zone } from "../models/CityZone.js";
import ProviderAccount from "../models/ProviderAccount.js";
import { pointInPolygon } from "./locationResolution.js";

/**
 * Find zones that contain a given point using polygon boundaries
 */
export async function findZonesContainingPoint(lat, lng, city) {
  try {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.log('[GeoMatching] Invalid coordinates:', { lat, lng });
      return [];
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.log('[GeoMatching] Coordinates out of range:', { lat, lng });
      return [];
    }

    let cityId = "";
    if (city) {
      const cityDoc = await City.findOne({ name: new RegExp(`^${city}$`, "i"), status: "active" }).lean();
      cityId = cityDoc?._id?.toString?.() || "";
    }

    const zones = (await Zone.find({
      ...(cityId ? { city: cityId } : {}),
      status: "active"
    }).select('name coordinates').lean()).filter((zone) => pointInPolygon(lat, lng, zone.coordinates || []));

    const zoneNames = zones.map(z => z.name);
    console.log(`[GeoMatching] Found ${zoneNames.length} zones containing point (${lat}, ${lng}):`, zoneNames);
    return zoneNames;
  } catch (error) {
    console.error('[GeoMatching] Error in findZonesContainingPoint:', error.message);
    return [];
  }
}

/**
 * Find providers sorted by distance from a given point
 */
export async function findProvidersByDistance(userLat, userLng, filters = {}, maxDistanceKm = 50) {
  try {
    if (typeof userLat !== 'number' || typeof userLng !== 'number') {
      console.log('[GeoMatching] Invalid user coordinates:', { userLat, userLng });
      return [];
    }

    const pipeline = [];

    pipeline.push({
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [userLng, userLat]
        },
        distanceField: "distanceMeters",
        maxDistance: maxDistanceKm * 1000,
        spherical: true,
        key: "currentLocation"
      }
    });

    const matchStage = {};
    if (filters.approvalStatus) matchStage.approvalStatus = filters.approvalStatus;
    if (filters.registrationComplete !== undefined) matchStage.registrationComplete = filters.registrationComplete;
    if (filters.city) matchStage.city = { $regex: new RegExp(`^${filters.city}`, "i") };
    if (filters.zones && Array.isArray(filters.zones) && filters.zones.length > 0) {
      matchStage.zones = { $in: filters.zones };
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $addFields: {
        distanceKm: { $divide: ["$distanceMeters", 1000] }
      }
    });

    const providers = await ProviderAccount.aggregate(pipeline);
    console.log(`[GeoMatching] Found ${providers.length} providers within ${maxDistanceKm}km`);
    return providers;
  } catch (error) {
    console.error('[GeoMatching] Error in findProvidersByDistance:', error.message);
    return [];
  }
}

/**
 * Hybrid zone matching: Try polygon-based first, fallback to text-based
 */
export async function findProvidersInZone(address, filters = {}) {
  const { lat, lng, zone, city } = address;
  let providers = [];
  let matchMethod = 'none';

  // Method 1: Polygon-based matching
  if (typeof lat === 'number' && typeof lng === 'number' && city) {
    try {
      const zonesContainingPoint = await findZonesContainingPoint(lat, lng, city);
      
      if (zonesContainingPoint.length > 0) {
        const query = {
          approvalStatus: filters.approvalStatus || "approved",
          registrationComplete: filters.registrationComplete !== undefined ? filters.registrationComplete : true,
          city: { $regex: new RegExp(`^${city}`, "i") },
          zones: { $in: zonesContainingPoint.map(z => new RegExp(`^${String(z).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) }
        };

        providers = await ProviderAccount.find(query).lean();
        matchMethod = 'polygon';
        console.log(`[GeoMatching] Polygon matching found ${providers.length} providers`);
      }
    } catch (error) {
      console.error('[GeoMatching] Polygon matching failed:', error.message);
    }
  }

  // Method 2: Text-based zone matching
  if (providers.length === 0 && zone && city) {
    try {
      const query = {
        approvalStatus: filters.approvalStatus || "approved",
        registrationComplete: filters.registrationComplete !== undefined ? filters.registrationComplete : true,
        city: { $regex: new RegExp(`^${city}`, "i") },
        zones: { $in: [new RegExp(`^${zone}`, "i")] }
      };

      providers = await ProviderAccount.find(query).lean();
      matchMethod = 'text';
      console.log(`[GeoMatching] Text-based matching found ${providers.length} providers`);
    } catch (error) {
      console.error('[GeoMatching] Text-based matching failed:', error.message);
    }
  }

  // Method 3: City-wide fallback
  if (providers.length === 0 && city) {
    try {
      const query = {
        approvalStatus: filters.approvalStatus || "approved",
        registrationComplete: filters.registrationComplete !== undefined ? filters.registrationComplete : true,
        city: { $regex: new RegExp(`^${city}`, "i") }
      };

      providers = await ProviderAccount.find(query).lean();
      matchMethod = 'city';
      console.log(`[GeoMatching] City-wide fallback found ${providers.length} providers`);
    } catch (error) {
      console.error('[GeoMatching] City-wide fallback failed:', error.message);
    }
  }

  console.log(`[GeoMatching] Final: ${providers.length} providers using ${matchMethod}`);
  return providers;
}

/**
 * Sort providers by distance and other criteria
 */
export async function sortProvidersByProximity(providers, userLat, userLng, proPartnerIds = [], qualifiesAsElite = () => false) {
  if (typeof userLat !== 'number' || typeof userLng !== 'number') {
    return providers.map(p => ({
      ...p,
      distanceKm: null,
      online: p.isOnline ? 1 : 0,
      isPro: proPartnerIds.includes(p._id.toString()) ? 1 : 0,
      isElite: qualifiesAsElite(p) ? 1 : 0,
      rating: Number(p.rating || 0),
      jobs: Number(p.totalJobs || 0)
    })).sort((a, b) => 
      (b.isElite - a.isElite) || 
      (b.isPro - a.isPro) || 
      (b.online - a.online) || 
      (b.rating - a.rating) || 
      (b.jobs - a.jobs)
    );
  }

  const providersWithDistance = providers.map(p => {
    let distanceKm = null;
    
    if (p.currentLocation?.lat && p.currentLocation?.lng) {
      const R = 6371;
      const dLat = (p.currentLocation.lat - userLat) * Math.PI / 180;
      const dLng = (p.currentLocation.lng - userLng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(userLat * Math.PI / 180) * Math.cos(p.currentLocation.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = R * c;
    }

    return {
      ...p,
      distanceKm,
      online: p.isOnline ? 1 : 0,
      isPro: proPartnerIds.includes(p._id.toString()) ? 1 : 0,
      isElite: qualifiesAsElite(p) ? 1 : 0,
      rating: Number(p.rating || 0),
      jobs: Number(p.totalJobs || 0)
    };
  });

  return providersWithDistance.sort((a, b) => {
    if (b.isElite !== a.isElite) return b.isElite - a.isElite;
    if (b.isPro !== a.isPro) return b.isPro - a.isPro;
    if (b.online !== a.online) return b.online - a.online;
    
    if (a.distanceKm !== null && b.distanceKm !== null) {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    } else if (a.distanceKm !== null) {
      return -1;
    } else if (b.distanceKm !== null) {
      return 1;
    }
    
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.jobs - a.jobs;
  });
}
