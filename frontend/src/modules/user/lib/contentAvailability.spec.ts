import { describe, expect, it } from "vitest";
import { getEffectiveAvailabilityZones, isContentAvailable, resolveLocationKeys } from "./contentAvailability";

describe("content availability", () => {
  it("treats empty zones as global availability", () => {
    expect(isContentAvailable({ id: "svc-1", zones: [] }, { zone: "Ujjain Hub" })).toBe(true);
  });

  it("matches against resolved zone before area or city", () => {
    const item = { id: "svc-1", zones: ["Ujjain Hub"] };
    const address = {
      area: "Abhishek Nagar",
      city: "Ujjain",
      zone: "Ujjain Hub",
    };

    expect(isContentAvailable(item, address)).toBe(true);
  });

  it("falls back from service to category to parent availability", () => {
    const service = { id: "svc-1", category: "facial", zones: [] };
    const categories = [{ id: "facial", serviceType: "skin", zones: [] }];
    const serviceTypes = [{ id: "skin", zones: ["Ujjain Hub"] }];

    expect(getEffectiveAvailabilityZones(service, { categories, serviceTypes })).toEqual(["Ujjain Hub"]);
    expect(isContentAvailable(service, { zone: "Ujjain Hub" }, null, null, { categories, serviceTypes })).toBe(true);
  });

  it("keeps legacy city and area fallbacks for older data", () => {
    expect(resolveLocationKeys({ city: "Ujjain", area: "Nanakheda" })).toEqual(["Ujjain", "Nanakheda"]);
    expect(isContentAvailable({ id: "svc-2", zones: ["Ujjain"] }, { city: "Ujjain" })).toBe(true);
  });
});
