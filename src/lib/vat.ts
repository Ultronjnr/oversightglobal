export const VAT_RATE = 0.15;

export type VatTreatment =
  | "standard_exclusive"
  | "standard_inclusive"
  | "zero_rated"
  | "exempt"
  | "not_registered"
  | "custom";

export const VAT_TREATMENT_OPTIONS: Array<{
  value: VatTreatment;
  label: string;
}> = [
  { value: "standard_exclusive", label: "Standard rate (15%), prices exclude VAT" },
  { value: "standard_inclusive", label: "Prices include VAT (15%)" },
  { value: "zero_rated", label: "Zero-rated (0%)" },
  { value: "exempt", label: "Exempt" },
  { value: "not_registered", label: "Supplier not VAT-registered" },
  { value: "custom", label: "Custom amount" },
];

export interface VatCalculation {
  subtotal: number;
  vat: number;
  total: number;
  summaryLabel: string;
}

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateVatTreatment(
  enteredAmount: number,
  treatment: VatTreatment,
  customVat = 0,
): VatCalculation {
  const amount = roundMoney(Math.max(0, Number(enteredAmount) || 0));

  if (treatment === "standard_inclusive") {
    const vat = roundMoney((amount * VAT_RATE) / (1 + VAT_RATE));
    return {
      subtotal: roundMoney(amount - vat),
      vat,
      total: amount,
      summaryLabel: "VAT (included)",
    };
  }

  if (treatment === "standard_exclusive") {
    const vat = roundMoney(amount * VAT_RATE);
    return {
      subtotal: amount,
      vat,
      total: roundMoney(amount + vat),
      summaryLabel: "VAT (15%)",
    };
  }

  if (treatment === "custom") {
    const vat = roundMoney(Math.max(0, Number(customVat) || 0));
    return {
      subtotal: amount,
      vat,
      total: roundMoney(amount + vat),
      summaryLabel: "VAT (custom)",
    };
  }

  const summaryLabel =
    treatment === "zero_rated"
      ? "VAT (zero-rated)"
      : treatment === "exempt"
        ? "VAT (exempt)"
        : "VAT (not registered)";

  return { subtotal: amount, vat: 0, total: amount, summaryLabel };
}