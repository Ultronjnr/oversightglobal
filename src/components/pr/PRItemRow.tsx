import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { PRItem } from "@/types/pr.types";

interface PRItemRowProps {
  item: PRItem;
  index: number;
  vatRate: number;
  onUpdate: (index: number, field: keyof PRItem, value: string | number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function PRItemRow({
  item,
  index,
  vatRate,
  onUpdate,
  onRemove,
  canRemove,
}: PRItemRowProps) {
  const handleQuantityChange = (value: string) => {
    const qty = parseFloat(value) || 0;
    onUpdate(index, "quantity", qty);
    onUpdate(index, "total", qty * item.unit_price * (1 + vatRate / 100));
  };

  const handlePriceChange = (value: string) => {
    const price = parseFloat(value) || 0;
    onUpdate(index, "unit_price", price);
    onUpdate(index, "total", item.quantity * price * (1 + vatRate / 100));
  };

  return (
    <div className="grid grid-cols-12 gap-3 items-start">
      {/* Description */}
      <div className="col-span-5">
        <Input
          placeholder="Item description"
          value={item.description}
          onChange={(e) => onUpdate(index, "description", e.target.value)}
          className="bg-background/50"
        />
      </div>

      {/* Quantity */}
      <div className="col-span-2">
        <Input
          type="number"
          min="1"
          placeholder="Qty"
          value={item.quantity || ""}
          onChange={(e) => handleQuantityChange(e.target.value)}
          className="bg-background/50"
        />
      </div>

      {/* Unit Price */}
      <div className="col-span-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={item.unit_price || ""}
          onChange={(e) => handlePriceChange(e.target.value)}
          className="bg-background/50"
        />
      </div>

      {/* Total */}
      <div className="col-span-2 flex items-center h-10 px-3 text-sm font-medium text-foreground bg-muted/50 rounded-lg border border-border/50">
        {formatCurrency(item.total)}
      </div>

      {/* Remove */}
      <div className="col-span-1 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
