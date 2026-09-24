import { describe, expect, it } from "vitest";
import { calculateVatTreatment } from "@/lib/vat";

describe("calculateVatTreatment", () => {
  it("adds standard VAT to VAT-exclusive prices", () => {
    expect(calculateVatTreatment(600_000, "standard_exclusive")).toEqual({
      subtotal: 600_000,
      vat: 90_000,
      total: 690_000,
      summaryLabel: "VAT (15%)",
    });
  });

  it("extracts VAT from VAT-inclusive prices", () => {
    expect(calculateVatTreatment(115, "standard_inclusive")).toEqual({
      subtotal: 100,
      vat: 15,
      total: 115,
      summaryLabel: "VAT (included)",
    });
  });

  it.each(["zero_rated", "exempt", "not_registered"] as const)(
    "uses zero VAT for %s",
    (treatment) => {
      const result = calculateVatTreatment(500, treatment);
      expect(result.vat).toBe(0);
      expect(result.total).toBe(500);
    },
  );

  it("adds a custom VAT amount", () => {
    expect(calculateVatTreatment(500, "custom", 37.456)).toMatchObject({
      subtotal: 500,
      vat: 37.46,
      total: 537.46,
    });
  });
});