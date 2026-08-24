import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ScanLine,
  Trophy,
  Trash2,
  FileText,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  getPRSourcingQuotes,
  addManualQuote,
  deleteManualQuote,
  uploadManualQuoteDocument,
  scanQuoteDocument,
  type SourcedQuote,
} from "@/services/pr-sourcing.service";
import { getAllSuppliers, acceptQuote, type Supplier } from "@/services/finance.service";
import { getQuoteDocumentUrl } from "@/services/quote-document.service";
import type { PurchaseRequisition } from "@/types/pr.types";

interface SourcingQuotesModalProps {
  open: boolean;
  onClose: () => void;
  pr: PurchaseRequisition;
  onChanged?: () => void;
}

const MANUAL_SUPPLIER = "__manual__";

export function SourcingQuotesModal({
  open,
  onClose,
  pr,
  onChanged,
}: SourcingQuotesModalProps) {
  const { role } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);

  const [quotes, setQuotes] = useState<SourcedQuote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [amount, setAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const isFinance = role === "FINANCE" || role === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    const [q, s] = await Promise.all([getPRSourcingQuotes(pr.id), getAllSuppliers()]);
    setQuotes(q.data);
    if (s.success) setSuppliers(s.data);
    setLoading(false);
  }, [pr.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const cheapestId = useMemo(() => {
    const live = quotes.filter((q) => q.status !== "REJECTED");
    if (live.length === 0) return null;
    return live.reduce((a, b) => (a.amount <= b.amount ? a : b)).id;
  }, [quotes]);

  const acceptedQuote = quotes.find((q) => q.status === "ACCEPTED") || null;

  const resetForm = () => {
    setSupplierId("");
    setSupplierName("");
    setAmount("");
    setValidUntil("");
    setDeliveryTime("");
    setNotes("");
    setDocumentPath(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** Upload the quote document and let OCR fill in the amount for the user. */
  const handleFile = async (file: File) => {
    setScanning(true);
    setFileName(file.name);
    try {
      const upload = await uploadManualQuoteDocument(file, pr.id);
      if (!upload.success || !upload.path) {
        toast.error(upload.error || "Upload failed");
        setFileName(null);
        return;
      }
      setDocumentPath(upload.path);

      const scan = await scanQuoteDocument(upload.path, pr.id);
      if (!scan.success) {
        toast.warning("Document saved, but could not be read automatically");
        return;
      }
      const ex = scan.extracted;
      if (ex?.total_amount) setAmount(String(ex.total_amount));
      if (ex?.supplier_name && !supplierId) {
        const match = suppliers.find(
          (s) =>
            s.company_name?.toLowerCase().trim() ===
            ex.supplier_name?.toLowerCase().trim()
        );
        if (match) {
          setSupplierId(match.id);
        } else {
          setSupplierId(MANUAL_SUPPLIER);
          setSupplierName(ex.supplier_name);
        }
      }
      toast.success("Quote scanned — check the values before saving");
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const result = await addManualQuote({
        prId: pr.id,
        supplierId: supplierId && supplierId !== MANUAL_SUPPLIER ? supplierId : null,
        supplierName:
          supplierId === MANUAL_SUPPLIER || !supplierId ? supplierName : null,
        amount: Number(amount),
        deliveryTime,
        validUntil: validUntil || null,
        notes,
        documentPath,
      });
      if (!result.success) {
        toast.error(result.error || "Could not save quote");
        return;
      }
      toast.success("Quote added to this requisition");
      resetForm();
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (quote: SourcedQuote) => {
    setActionId(quote.id);
    try {
      const result = await acceptQuote(quote.id, pr.id);
      if (!result.success) {
        toast.error(result.error || "Could not accept quote");
        return;
      }
      toast.success(`${quote.display_supplier} selected as the winning quote`);
      await load();
      onChanged?.();
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (quote: SourcedQuote) => {
    setActionId(quote.id);
    try {
      const result = await deleteManualQuote(quote.id);
      if (!result.success) {
        toast.error(result.error || "Could not remove quote");
        return;
      }
      toast.success("Quote removed");
      await load();
      onChanged?.();
    } finally {
      setActionId(null);
    }
  };

  const handleView = async (quote: SourcedQuote) => {
    if (!quote.document_url) return;
    const result = await getQuoteDocumentUrl(quote.document_url);
    if (result.success && result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error || "Could not open document");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supplier sourcing — {pr.transaction_id}</DialogTitle>
          <DialogDescription>
            Collect several quotes against this requisition. Finance selects the
            winning quote, and only that one moves into the financials.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Quotes received ({quotes.length})
              </h4>
              {quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground border rounded-lg p-4">
                  No quotes yet. Capture the first one below — from a platform
                  supplier or one that is not on Ovasyt.
                </p>
              ) : (
                <div className="space-y-2">
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3"
                    >
                      <div className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{q.display_supplier}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {q.source === "MANUAL" ? "Captured" : "Portal"}
                          </Badge>
                          {q.id === cheapestId && q.status !== "REJECTED" && (
                            <Badge className="text-[10px] gap-1">
                              <Trophy className="h-3 w-3" /> Lowest
                            </Badge>
                          )}
                          {q.status === "ACCEPTED" && (
                            <Badge className="text-[10px] bg-emerald-600">
                              Winning quote
                            </Badge>
                          )}
                          {q.status === "REJECTED" && (
                            <Badge variant="secondary" className="text-[10px]">
                              Not selected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {q.delivery_time ? `${q.delivery_time} · ` : ""}
                          {q.valid_until
                            ? `valid to ${format(new Date(q.valid_until), "dd MMM yyyy")}`
                            : "no expiry"}
                        </p>
                      </div>

                      <div className="text-lg font-semibold text-primary">
                        {formatCurrency(q.amount, pr.currency)}
                      </div>

                      <div className="flex items-center gap-2">
                        {q.document_url && (
                          <Button size="sm" variant="outline" onClick={() => handleView(q)}>
                            <FileText className="h-4 w-4 mr-1" /> View
                          </Button>
                        )}
                        {isFinance && q.status === "SUBMITTED" && !acceptedQuote && (
                          <Button
                            size="sm"
                            onClick={() => handleAccept(q)}
                            disabled={actionId === q.id}
                          >
                            {actionId === q.id ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1" />
                            )}
                            Select
                          </Button>
                        )}
                        {q.source === "MANUAL" && q.status !== "ACCEPTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(q)}
                            disabled={actionId === q.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {acceptedQuote ? (
              <p className="text-sm text-muted-foreground">
                A winning quote has been selected for this requisition, so no
                further quotes can be captured.
              </p>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Capture a quote</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-[100]">
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.company_name}
                          </SelectItem>
                        ))}
                        <SelectItem value={MANUAL_SUPPLIER}>
                          Not on Ovasyt — type a name
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {supplierId === MANUAL_SUPPLIER && (
                    <div className="space-y-2">
                      <Label>Supplier name</Label>
                      <Input
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="e.g. Cape Office Supplies"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Quote amount (incl. VAT)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Valid until</Label>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Delivery lead time</Label>
                    <Input
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="e.g. 5 working days"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quote document</Label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileRef.current?.click()}
                      disabled={scanning}
                    >
                      {scanning ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ScanLine className="h-4 w-4 mr-2" />
                      )}
                      {fileName || "Attach & scan quote"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything Finance should know about this quote"
                    rows={2}
                  />
                </div>

                <Button onClick={handleAdd} disabled={saving || scanning}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add quote
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
