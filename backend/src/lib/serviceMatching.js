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
    ServiceType.find().select("id label").lean(),
    Category.find().select("id name").lean(),
  ]);
  contentCache = {
    loadedAt: now,
    serviceTypeIdToLabel: new Map((types || []).map((t) => [t.id, t.label])),
    categoryIdToName: new Map((cats || []).map((c) => [c.id, c.name])),
  };
  return contentCache;
}

export async function resolveRequestedSpecialtySets({ serviceTypeValues = [], categoryValues = [] } = {}) {
  const wantTypes = new Set((serviceTypeValues || []).map(normalizeValue).filter(Boolean));
  const wantCats = new Set((categoryValues || []).map(normalizeValue).filter(Boolean));
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
        const label = maps.categoryIdToName.get(id) || maps.categoryIdToName.get(String(id));
        if (label) {
          const normalized = normalizeValue(label);
          wantCatLabels.add(normalized);
          pushValueVariants(canonicalWanted, normalized);
        }
      }
    } catch {}
  }

  return { wantTypes, wantCats, wantTypeLabels, wantCatLabels, canonicalWanted };
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

  // ✅ FIX: Support both root-level and documents-nested data structures
  // This ensures backward compatibility with both old and new provider data formats
  
  // Try root level first (new format), then fallback to documents (old format)
  const spec = Array.isArray(provider?.categories) 
    ? provider.categories 
    : (Array.isArray(provider?.documents?.specializations) ? provider.documents.specializations : []);
  
  const primary = Array.isArray(provider?.serviceTypes) 
    ? provider.serviceTypes 
    : (Array.isArray(provider?.documents?.primaryCategory) ? provider.documents.primaryCategory : []);
  
  const services = Array.isArray(provider?.services) 
    ? provider.services 
    : (Array.isArray(provider?.documents?.services) ? provider.documents.services : []);
  
  // If no specialties found in either location, provider doesn't match
  if (spec.length === 0 && primary.length === 0 && services.length === 0) return false;

  const providerTags = [...spec, ...primary, ...services].map(normalizeValue).filter(Boolean);
  const canonicalProvider = buildCanonicalSet(providerTags);

  for (const wanted of canonicalWanted) {
    if (canonicalProvider.has(wanted)) return true;
  }

  // Fallback broad matching for mixed legacy values.
  return providerTags.some((tag) => {
    for (const wanted of canonicalWanted) {
      if (tag === wanted) return true;
      if (tag.includes(wanted) || wanted.includes(tag)) return true;
      if (hasTokenIntersection(tag, wanted)) return true;
    }
    return false;
  });
}

