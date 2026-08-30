import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Paperclip, Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AmountInput } from "@/components/ui/amount-input";
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
  /** Quantity of the quoted item(s). */
  quantity: number;
  /** Unit price as a raw numeric string. */
  price: string;
  notes: string;
  file: File | null;
}

export const createEmptyQuoteDraft = (): SupplierQuoteDraft => ({
  id: uuidv4(),
  supplierId: null,
  supplierName: "",
  description: "",
  quantity: 1,
  price: "",
  notes: "",
  file: null,
});

/** Line total for a quote row. */
export const quoteRowTotal = (row: SupplierQuoteDraft) =>
  (Number(row.quantity) || 0) * (Number(row.price) || 0);

const OTHER = "__other__";

interface Props {
  value: SupplierQuoteDraft[];
  onChange: (rows: SupplierQuoteDraft[]) => void;
}

/**
 * "Supplier Quotes" capture block — the primary content of the New PR form.
 * The requester adds every supplier they got a price from; Finance picks the
 * winning one later, so nothing here is a commitment.
 */
export function PRSupplierQuotesInput({ value, onChange }: Props) {
  const { currency, format: formatCurrency } = useCurrency();
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

  const priced = value.filter((r) => quoteRowTotal(r) > 0);
  const lowest =
    priced.length > 0
      ? priced.reduce((a, b) => (quoteRowTotal(a) <= quoteRowTotal(b) ? a : b))
      : null;

  const nameOf = (row: SupplierQuoteDraft) =>
    row.supplierId
      ? suppliers.find((s) => s.id === row.supplierId)?.company_name ||
        row.supplierName
      : row.supplierName;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Supplier Quotes</h3>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-0.5"
          >
            {value.length} {value.length === 1 ? "quote" : "quotes"}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([createEmptyQuoteDraft(), ...value])}
          className="bg-muted/50 hover:bg-muted border-border/50 gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Supplier Quote
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Add every supplier you got a price from — the Finance Manager chooses the winner.
      </p>

      <div className="space-y-4">
        {value.map((row, index) => {
          const total = quoteRowTotal(row);
          const isLowest = lowest?.id === row.id && total > 0;
          return (
            <div
              key={row.id}
              className="bg-white border border-border/60 rounded-lg overflow-hidden shadow-sm"
            >
              <div className="flex">
                <div className="w-1.5 bg-primary shrink-0" />
                <div className="flex-1 p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">
                        Quote {value.length - index}
                      </h4>
                      {isLowest && value.length > 1 && (
                        <Badge className="bg-success/10 text-success border-success/20 text-[10px] uppercase">
                          Lowest
                        </Badge>
                      )}
                    </div>
                    {value.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(row.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Supplier <span className="text-destructive">*</span>
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
                        <SelectTrigger className="h-10 bg-white border-border">
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
                          className="h-10 bg-white border-border"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        What they quoted <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={row.description}
                        onChange={(e) =>
                          update(row.id, { description: e.target.value })
                        }
                        placeholder="200× fleece blankets, delivered"
                        className="h-10 bg-white border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) =>
                          update(row.id, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        className="h-10 bg-white border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Unit Price ({currency}) <span className="text-destructive">*</span>
                      </Label>
                      <AmountInput
                        value={row.price}
                        onChange={(v) => update(row.id, { price: v })}
                        placeholder="e.g. 12 500.00"
                        className="h-10 bg-white border-border"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/30 space-y-1.5">
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-sm text-muted-foreground">Subtotal:</span>
                      <span className="text-lg font-bold text-foreground w-32 text-right">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Notes / Justification
                      </Label>
                      <Textarea
                        value={row.notes}
                        onChange={(e) => update(row.id, { notes: e.target.value })}
                        placeholder="Lead time, warranty, why this supplier..."
                        className="bg-white border-border min-h-[90px] resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Quote document
                      </Label>
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
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs font-medium text-primary hover:bg-primary/5">
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange([...value, createEmptyQuoteDraft()])}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <Plus className="h-4 w-4" />
        Add Supplier Quote
      </button>

      {lowest && (
        <p className="text-sm text-muted-foreground">
          Lowest quote:{" "}
          <span className="font-semibold text-foreground">
            {nameOf(lowest) || "Unnamed supplier"}
          </span>{" "}
          at{" "}
          <span className="font-semibold text-foreground">
            {formatCurrency(quoteRowTotal(lowest))}
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
