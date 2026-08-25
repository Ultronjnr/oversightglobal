import { describe, it, expect } from "vitest";
import { bucketFor, daysBetween, AGING_BUCKETS } from "./reporting.service";

describe("reporting.service aging helpers", () => {
  it("classifies not-yet-due and same-day items as current", () => {
    expect(bucketFor(-5)).toBe("CURRENT");
    expect(bucketFor(0)).toBe("CURRENT");
  });

  it("classifies each aging bucket at its boundaries", () => {
    expect(bucketFor(1)).toBe("D1_30");
    expect(bucketFor(30)).toBe("D1_30");
    expect(bucketFor(31)).toBe("D31_60");
    expect(bucketFor(60)).toBe("D31_60");
    expect(bucketFor(61)).toBe("D61_90");
    expect(bucketFor(90)).toBe("D61_90");
    expect(bucketFor(91)).toBe("D90_PLUS");
    expect(bucketFor(365)).toBe("D90_PLUS");
  });

  it("counts whole days between two dates", () => {
    expect(daysBetween(new Date("2026-01-01"), new Date("2026-01-01"))).toBe(0);
    expect(daysBetween(new Date("2026-01-01"), new Date("2026-02-01"))).toBe(31);
    expect(daysBetween(new Date("2026-02-01"), new Date("2026-01-01"))).toBe(-31);
  });

  it("exposes all five buckets in ascending age order", () => {
    expect(AGING_BUCKETS.map((b) => b.key)).toEqual([
      "CURRENT",
      "D1_30",
      "D31_60",
      "D61_90",
      "D90_PLUS",
    ]);
  });
});
