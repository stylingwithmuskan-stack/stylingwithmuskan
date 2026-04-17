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

  if (wantTypes.size > 0 || wantCats.size > 0) {
    try {
      const maps = await getContentMaps();
      for (const id of wantTypes) {
        const label = maps.serviceTypeIdToLabel.get(id);
        if (label) wantTypeLabels.add(normalizeValue(label));
      }
      for (const id of wantCats) {
        const label = maps.categoryIdToName.get(id);
        if (label) wantCatLabels.add(normalizeValue(label));
      }
    } catch {}
  }

  return { wantTypes, wantCats, wantTypeLabels, wantCatLabels };
}

export function providerMatchesRequestedSpecialties(provider, requested = {}) {
  const wants = [
    ...(requested.wantCats || []),
    ...(requested.wantTypes || []),
    ...(requested.wantCatLabels || []),
    ...(requested.wantTypeLabels || []),
  ].map(normalizeValue).filter(Boolean);

  if (wants.length === 0) return true;

  const spec = Array.isArray(provider?.documents?.specializations) ? provider.documents.specializations : [];
  const primary = Array.isArray(provider?.documents?.primaryCategory) ? provider.documents.primaryCategory : [];
  const services = Array.isArray(provider?.documents?.services) ? provider.documents.services : [];
  if (spec.length === 0 && primary.length === 0 && services.length === 0) return false;

  const providerTags = [...spec, ...primary, ...services].map(normalizeValue).filter(Boolean);

  return providerTags.some((tag) =>
    wants.some((want) =>
      tag === want ||
      tag.includes(want) ||
      want.includes(tag) ||
      hasTokenIntersection(tag, want)
    )
  );
}

