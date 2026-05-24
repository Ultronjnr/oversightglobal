import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllSuppliers,
  createManualSupplier,
  type Supplier,
} from "@/services/finance.service";

interface SupplierPickerProps {
  value?: string;
  onChange: (supplierId: string | undefined, supplier?: Supplier) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SupplierPicker({
  value,
  onChange,
  disabled,
  placeholder = "Select or create supplier...",
}: SupplierPickerProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    vat_number: "",
    contact_email: "",
    phone: "",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllSuppliers().then((res) => {
      if (cancelled) return;
      if (res.success) setSuppliers(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === value),
    [suppliers, value],
  );

  const openCreate = () => {
    setForm({
      company_name: query.trim(),
      vat_number: "",
      contact_email: "",
      phone: "",
    });
    setOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!form.company_name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setSubmitting(true);
    const res = await createManualSupplier(form);
    setSubmitting(false);
    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to create supplier");
      return;
    }
    toast.success("Supplier created");
    setSuppliers((prev) => [res.data!, ...prev]);
    onChange(res.data.id, res.data);
    setCreateOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between bg-background/50 font-normal"
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">
                {selected ? selected.company_name : placeholder}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder="Search suppliers..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      No suppliers found.
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {suppliers.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={`${s.company_name} ${s.contact_email ?? ""}`}
                        onSelect={() => {
                          onChange(s.id, s);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === s.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{s.company_name}</span>
                          {s.contact_email && (
                            <span className="text-xs text-muted-foreground truncate">
                              {s.contact_email}
                            </span>
                          )}
                        </div>
                        {s.is_manual && (
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                            Manual
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <div className="border-t p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={openCreate}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create new supplier
                      {query.trim() ? ` "${query.trim()}"` : ""}
                    </Button>
                  </div>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={(o) => !submitting && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ms_name">
                Supplier name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ms_name"
                value={form.company_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, company_name: e.target.value }))
                }
                maxLength={200}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms_vat">VAT number</Label>
              <Input
                id="ms_vat"
                value={form.vat_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vat_number: e.target.value }))
                }
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms_email">Email</Label>
              <Input
                id="ms_email"
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_email: e.target.value }))
                }
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms_phone">Phone</Label>
              <Input
                id="ms_phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                maxLength={50}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This supplier is stored as a record only and does not require a
              login account.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create supplier"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}