import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Strip grouping separators, keep digits + a single decimal point. */
export function parseAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [int, ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${int}.${rest.join("").slice(0, 2)}` : int;
}

/** Group the integer part in thousands with spaces, e.g. 1 234 567.89 */
export function groupAmount(raw: string): string {
  if (raw === "" || raw === ".") return raw;
  const [int, dec] = raw.split(".");
  const grouped = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return raw.includes(".") ? `${grouped}.${dec ?? ""}` : grouped;
}

interface AmountInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  /** Raw numeric string, e.g. "12500.5" (no separators). */
  value: string;
  /** Receives the raw numeric string (no separators). */
  onChange: (value: string) => void;
}

/**
 * Money input that shows thousands separators while typing
 * but always reports a clean numeric string upward.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, className, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={groupAmount(value ?? "")}
      onChange={(e) => onChange(parseAmount(e.target.value))}
      className={cn("tabular-nums", className)}
    />
  )
);
AmountInput.displayName = "AmountInput";
