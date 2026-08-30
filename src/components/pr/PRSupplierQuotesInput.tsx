import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Paperclip, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getAllSuppliers, type Supplier } from "@/services/finance.service";

export interface SupplierQuoteDraft {
  id: string;
  /** Platform supplier id when picked from the list. */
  supplierId: string | null;
  /** Free-typed supplier name for off-platform suppliers. */
  supplierName: string;
  description: string;
  price: string;
  file: File | null;
}

export const createEmptyQuoteDraft = (): SupplierQuoteDraft => ({
  id: uuidv4(),
  supplierId: null,
  supplierName: "",
  description: "",
  price: "",
  file: null,
});

const OTHER = "__other__";

interface Props {
  value: SupplierQuoteDraft[];
  onChange: (rows: SupplierQuoteDraft[]) => void;
}

/**
 * "Supplier quotes" capture block for the New PR form.
 * The requester adds every supplier they got a price from — Finance picks the
 * winning one later, so nothing here is a commitment.
 */
export function PRSupplierQuotesInput({ value, onChange }: Props) {
  const { format: formatCurrency } = useCurrency();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllSuppliers().then((res) => {
      if (cancelled) return;
      if (res.success) setSuppliers(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (id: string, patch: Partial<SupplierQuoteDraft>) =>
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => onChange(value.filter((r) => r.id !== id));

  const priced = value.filter((r) => Number(r.price) > 0);
  const lowest =
    priced.length > 0
      ? priced.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b))
      : null;

  const nameOf = (row: SupplierQuoteDraft) =>
    row.supplierId
      ? suppliers.find((s) => s.id === row.supplierId)?.company_name ||
        row.supplierName
      : row.supplierName;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Supplier quotes</h3>
        <p className="text-xs text-muted-foreground">
          Add every supplier you got a price from — the Finance Manager chooses.
        </p>
      </div>

      <div className="space-y-3">
        {value.map((row, index) => (
          <div
            key={row.id}
            className="rounded-lg border border-border/60 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>

              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-12">
                <div className="space-y-1.5 md:col-span-4">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Supplier
                  </Label>
                  <Select
                    value={row.supplierId ?? (row.supplierName ? OTHER : "")}
                    onValueChange={(v) =>
                      update(row.id, {
                        supplierId: v === OTHER ? null : v,
                        supplierName: v === OTHER ? row.supplierName : "",
                      })
                    }
                  >
                    <SelectTrigger className="h-10 bg-white">
                      <SelectValue
                        placeholder={loading ? "Loading..." : "Select supplier"}
                      />
                    </SelectTrigger>
                    <SelectContent className="z-[120] bg-white">
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.company_name}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other — type a name</SelectItem>
                    </SelectContent>
                  </Select>
                  {!row.supplierId && (
                    <Input
                      value={row.supplierName}
                      onChange={(e) =>
                        update(row.id, { supplierName: e.target.value })
                      }
                      placeholder="e.g. Cozy Home Traders"
                      className="h-10 bg-white"
                    />
                  )}
                </div>

                <div className="space-y-1.5 md:col-span-5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description / what they quoted
                  </Label>
                  <Input
                    value={row.description}
                    onChange={(e) =>
                      update(row.id, { description: e.target.value })
                    }
                    placeholder="200× fleece blankets, delivered"
                    className="h-10 bg-white"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Price (incl. VAT)
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => update(row.id, { price: e.target.value })}
                    placeholder="0.00"
                    className="h-10 bg-white"
                  />
                </div>
              </div>

              {value.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(row.id)}
                  className="mt-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="mt-3 pl-9">
              {row.file ? (
                <span className="inline-flex items-center gap-2 text-xs font-medium text-success">
                  <Check className="h-3.5 w-3.5" />
                  {row.file.name} attached
                  <button
                    type="button"
                    onClick={() => update(row.id, { file: null })}
                    className="text-muted-foreground underline"
                  >
                    remove
                  </button>
                </span>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary hover:underline">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach quote document
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) update(row.id, { file: f });
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...value, createEmptyQuoteDraft()])}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <Plus className="h-4 w-4" />
        Add another supplier
      </button>

      {lowest && (
        <p className="text-sm text-muted-foreground">
          Lowest quote:{" "}
          <span className="font-semibold text-foreground">
            {nameOf(lowest) || "Unnamed supplier"}
          </span>{" "}
          at{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(Number(lowest.price))}
          </span>
        </p>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading suppliers…
        </p>
      )}
    </div>
  );
}
