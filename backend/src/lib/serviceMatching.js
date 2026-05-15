import { Category, ServiceType } from "../models/Content.js";

const CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;
const GENERIC_TOKENS = new Set(["service", "services", "care", "spa", "category", "categories"]);

let contentCache = {
  loadedAt: 0,
  serviceTypeIdToLabel: new Map(),
  categoryIdToName: new Map(),
};

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenize(value) {
  return normalizeValue(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token && !GENERIC_TOKENS.has(token));
}

function hasTokenIntersection(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  return leftTokens.some((token) => rightTokens.includes(token));
}

function pushValueVariants(targetSet, value) {
  const normalized = normalizeValue(value);
  if (!normalized) return;
  targetSet.add(normalized);
  const tokens = tokenize(normalized);
  for (const token of tokens) targetSet.add(token);
}

function buildCanonicalSet(values = []) {
  const out = new Set();
  for (const value of values) pushValueVariants(out, value);
  return out;
}

export async function getContentMaps() {
  const now = Date.now();
  if (contentCache.loadedAt && (now - contentCache.loadedAt) < CONTENT_CACHE_TTL_MS) {
    return contentCache;
  }
  const [types, cats] = await Promise.all([
    ServiceType.find().lean(),
    Category.find().lean(),
  ]);
  
  const typeMap = new Map();
  (types || []).forEach(t => {
    if (t.id) typeMap.set(String(t.id), t.label);
    if (t._id) typeMap.set(String(t._id), t.label);
  });

  const catMap = new Map();
  (cats || []).forEach(c => {
    if (c.id) catMap.set(String(c.id), c.name);
    if (c._id) catMap.set(String(c._id), c.name);
  });

  console.log(`[CONTENT DEBUG] Loaded ${typeMap.size} types and ${catMap.size} categories into cache.`);

  contentCache = {
    loadedAt: now,
    serviceTypeIdToLabel: typeMap,
    categoryIdToName: catMap,
  };
  return contentCache;
}

export async function resolveRequestedSpecialtySets({ serviceTypeValues = [], categoryValues = [], serviceIds = [] } = {}) {
  const wantTypes = new Set((serviceTypeValues || []).map(normalizeValue).filter(Boolean));
  const wantCats = new Set((categoryValues || []).map(normalizeValue).filter(Boolean));
  const wantServiceIds = new Set((serviceIds || []).map(normalizeValue).filter(Boolean));
  const wantTypeLabels = new Set();
  const wantCatLabels = new Set();
  const canonicalWanted = buildCanonicalSet([...wantTypes, ...wantCats]);

  if (wantTypes.size > 0 || wantCats.size > 0) {
    try {
      const maps = await getContentMaps();
      for (const id of wantTypes) {
        const label = maps.serviceTypeIdToLabel.get(id) || maps.serviceTypeIdToLabel.get(String(id));
        if (label) {
          const normalized = normalizeValue(label);
          wantTypeLabels.add(normalized);
          pushValueVariants(canonicalWanted, normalized);
        }
      }
      for (const id of wantCats) {
        const label = maps.categoryIdToName.get(id) || maps.categoryIdToName.get(String(id)) ||
                      maps.serviceTypeIdToLabel.get(id) || maps.serviceTypeIdToLabel.get(String(id));
        if (label) {
          const normalized = normalizeValue(label);
          wantCatLabels.add(normalized);
          pushValueVariants(canonicalWanted, normalized);
        }
      }
    } catch { }
  }

  return { wantTypes, wantCats, wantTypeLabels, wantCatLabels, wantServiceIds, canonicalWanted };
}

export function providerMatchesRequestedSpecialties(provider, requested = {}) {
  const wants = [
    ...(requested.wantCats || []),
    ...(requested.wantTypes || []),
    ...(requested.wantCatLabels || []),
    ...(requested.wantTypeLabels || []),
  ].map(normalizeValue).filter(Boolean);
  
  const canonicalWanted = requested.canonicalWanted instanceof Set
    ? new Set(Array.from(requested.canonicalWanted).map(normalizeValue).filter(Boolean))
    : buildCanonicalSet(wants);

  if (canonicalWanted.size === 0) return true;

  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") return val.split(",").map(s => s.trim());
    return val ? [val] : [];
  };

  const spec = toArray(provider?.documents?.specializations);
  const primary = toArray(provider?.documents?.primaryCategory);
  const services = toArray(provider?.serviceTypes);
  const providerTags = [...spec, ...primary, ...services].map(normalizeValue).filter(Boolean);
  const canonicalProvider = buildCanonicalSet(providerTags);

  const wantServiceIds = requested.wantServiceIds || new Set();
  const wantCats = requested.wantCats || new Set();
  const wantTypes = requested.wantTypes || new Set();

  // 1. Check Services (Sub-categories level 2)
  for (const sId of wantServiceIds) {
    if (canonicalProvider.has(normalizeValue(sId))) return true;
  }

  // 2. Check Categories (Top level) - Smarter OR logic
  if (wantCats.size > 0) {
    const maps = contentCache; 
    const hasAnyCatMatch = Array.from(wantCats).some(catId => {
      const normalizedCat = normalizeValue(catId);
      const catName = normalizeValue(
        maps.categoryIdToName.get(catId) || 
        maps.serviceTypeIdToLabel.get(catId) ||
        maps.categoryIdToName.get(String(catId)) ||
        maps.serviceTypeIdToLabel.get(String(catId))
      );
      
      const majorKeywords = ["hair", "mehndi", "skin", "makeup"];
      const isMajor = majorKeywords.some(m => normalizedCat.includes(m) || (catName && catName.includes(m)));
      
      if (isMajor) {
        const target = catName || normalizedCat;
        const isMehndiTarget = target.includes("mehndi") || target.includes("mendhi");

        const wordRegex = new RegExp(`\\b${target}\\b`, 'i');
        const match = providerTags.find(tag => {
          if (tag === target || tag === normalizedCat) return true;
          if (!wordRegex.test(tag)) return false;

          if (isMehndiTarget && tag.includes("makeup")) return false;
          
          return true;
        });

        if (match) return true;
        
        const base = majorKeywords.find(m => target.includes(m));
        if (base && !isMehndiTarget) {
          const baseRegex = new RegExp(`\\b${base}\\b`, 'i');
          const fallbackMatch = providerTags.find(tag => baseRegex.test(tag));
          if (fallbackMatch) return true;
        }
        return false;
      }
      
      if (canonicalProvider.has(normalizedCat)) return true;
      if (catName && (canonicalProvider.has(catName) || providerTags.some(tag => tag === catName || tag.includes(catName)))) return true;
      return providerTags.some(tag => tag === normalizedCat || (catName && tag.includes(catName)));
    });
    
    if (!hasAnyCatMatch) return false;
  }

  // 3. Check Sub-categories/ServiceTypes (Mid level) - Use OR logic
  if (wantTypes.size > 0) {
    const hasAnyTypeMatch = Array.from(wantTypes).some(typeId => {
      const normalizedType = normalizeValue(typeId);
      if (canonicalProvider.has(normalizedType)) return true;
      return providerTags.some(tag => tag === normalizedType || tag.includes(normalizedType));
    });
    if (!hasAnyTypeMatch) return false;
  }

  // 4. Fallback for Label-only searches (if no IDs matched or were provided)
  if (wantCats.size === 0 && wantTypes.size === 0 && canonicalWanted.size > 0) {
    for (const wanted of canonicalWanted) {
      if (canonicalProvider.has(wanted)) return true;
    }
    return false;
  }

  return true;
}

/**
 * Optimized AND-based matching for multiple services.
 * Ensures a provider is capable of performing ALL requested services.
 * 
 * @param {Object} provider - The provider document
 * @param {string[]} requestedServiceIds - List of service IDs from cart
 * @param {Object[]} [preFetchedServiceData] - Optional pre-fetched [id, category] pairs to avoid redundant DB calls
 */
export async function providerMatchesAllServiceIds(provider, requestedServiceIds = [], preFetchedServiceData = null) {
  if (!requestedServiceIds || requestedServiceIds.length === 0) return true;

  const normalizedRequested = requestedServiceIds.map(s => String(s).trim()).filter(Boolean);
  if (normalizedRequested.length === 0) return true;

  const toArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") return val.split(",").map(s => s.trim());
    return val ? [val] : [];
  };

  // 1. Prepare provider skill sets
  const pServices = new Set(
    toArray(provider?.documents?.services || provider?.services)
    .map(s => String(s).trim())
  );
  
  // Strict Category Set: Exclude specializations for AND-matching to prevent "bio-bloat"
  const pCats = new Set([
    ...toArray(provider?.documents?.primaryCategory),
    ...toArray(provider?.documents?.specializations),
    ...toArray(provider?.serviceTypes),
    ...toArray(provider?.categories),
    ...(provider?.pendingCategoryRequests || [])
        .filter(req => req.status === "approved")
        .map(req => req.categoryName || req.categoryId || req._id)
  ].map(c => String(c).trim()));

  // Loose Category Set (only for fallback/tokens if needed, but not for strict ID match)
  const pSpecialties = new Set(toArray(provider?.documents?.specializations).map(s => String(s).trim()));

  // 2. Resolve Service-to-Category mapping
  let serviceData = preFetchedServiceData;
  if (!serviceData) {
    try {
      const { Service } = await import("../models/Content.js");
      serviceData = await Service.find({ id: { $in: normalizedRequested } }).select("id category").lean();
    } catch (err) {
      console.error("[ServiceMatching] Fallback to basic matching due to DB error:", err.message);
      serviceData = []; 
    }
  }

  // 3. Strict AND check: For EVERY requested service, provider must have either the ID or the Category
  const maps = await getContentMaps();
  for (const sId of normalizedRequested) {
    // A. Direct match on Service ID
    if (pServices.has(sId)) continue;

    // B. Fallback match on Category ID
    const sInfo = Array.isArray(serviceData) ? serviceData.find(d => d.id === sId) : null;
    if (sInfo && sInfo.category) {
      const sCatId = String(sInfo.category).trim();
      if (pCats.has(sCatId)) continue;
      if (pSpecialties.has(sCatId)) continue;

      // New: Also check by Category Name for providers with string-based categories
      const maps = await getContentMaps();
      const catName = normalizeValue(
        maps.categoryIdToName.get(sCatId) || 
        maps.serviceTypeIdToLabel.get(sCatId)
      );
      if (catName) {
        if (pCats.has(catName) || pSpecialties.has(catName)) continue;
        
        // Flexible fallback: check if any tag includes the category name
        const allTags = [...Array.from(pCats), ...Array.from(pSpecialties)];
        if (allTags.some(tag => tag.includes(catName) || catName.includes(tag))) continue;
      }
    }

    // C. Strict Fail: If service info not found in DB, provider does NOT match.
    return false;
  }

  return true;
}

