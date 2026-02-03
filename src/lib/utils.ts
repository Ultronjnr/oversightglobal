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
export function formatCurrency(
  amount: number,
  currency: string = "ZAR",
  decimals: number = 2
): string {
  const symbols: Record<string, string> = {
    ZAR: "R",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = symbols[currency] || currency;
  return `${symbol} ${formatNumber(amount, decimals)}`;
}
