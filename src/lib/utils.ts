import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with space as thousands separator and 2 decimal places
 * e.g., 1234567.89 -> "1 234 567.89"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const fixed = value.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

/**
 * Format currency with symbol and space thousands separator
 * e.g., 1234567.89 -> "R 1 234 567.89"
 */
export const SUPPORTED_CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "NAD", "BWP"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "ZAR";

/** Symbol for each supported organization currency. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: "R",
  USD: "$",
  EUR: "€",
  GBP: "£",
  NAD: "N$",
  BWP: "P",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  ZAR: "South African Rand (R)",
  USD: "US Dollar ($)",
  EUR: "Euro (€)",
  GBP: "British Pound (£)",
  NAD: "Namibian Dollar (N$)",
  BWP: "Botswana Pula (P)",
};

export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format currency with symbol and space thousands separator
 * e.g., 1234567.89 -> "R 1 234 567.89"
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  decimals: number = 2
): string {
  return `${currencySymbol(currency)} ${formatNumber(amount, decimals)}`;
}
