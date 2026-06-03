import { useEffect, useMemo, useRef, useState } from "react";
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
import { Card } from "@/components/ui/card";
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
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ScanLine,
  Camera,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument, type OcrAnalysis } from "@/services/ocr.service";
import { CameraCaptureModal } from "@/components/capture/CameraCaptureModal";
import {
  getCategories,
  createCategory,
  type Category,
  type CategoryType,
} from "@/services/category.service";
import {
  createTransactionFromInvoice,
  validateSarsInvoice,
  type SarsValidationCode,
} from "@/services/scan-invoice.service";

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp,image/heic";
const ACCEPTED_INVOICE = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_SIZE = 15 * 1024 * 1024;

type CameraMode = "capture" | "scan" | null;

interface LineItemRow {
  description: string;
  quantity: string;
  unit_price: string;
  total: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const codeLabels: Record<SarsValidationCode, string> = {
  VALID: "Valid SARS Tax Invoice",
  MISSING_VAT_NUMBER: "Missing VAT Number",
  MISSING_SUPPLIER_DETAILS: "Missing Supplier Details",
  MISSING_INVOICE_NUMBER: "Missing Invoice Number",
  MISSING_INVOICE_DATE: "Missing Invoice Date",
  MISSING_VAT_AMOUNT: "Missing VAT Amount",
};

export function ScanInvoiceModal({ open, onOpenChange, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [analysis, setAnalysis] = useState<OcrAnalysis | null>(null);
  const [scanPath, setScanPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [supplierName, setSupplierName] = useState("");
  const [supplierVat, setSupplierVat] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [subtotal, setSubtotal] = useState<string>("");
  const [vatAmount, setVatAmount] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);

  // Inline create-category
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<CategoryType>("EXPENSE");
  const [creatingCat, setCreatingCat] = useState(false);

  useEffect(() => {
    if (!open) return;
    getCategories().then((r) => r.success && setCategories(r.data));
  }, [open]);

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setScanPath(null);
    setCameraMode(null);
    setSupplierName("");
    setSupplierVat("");
    setInvoiceNumber("");
    setInvoiceDate("");
    setSubtotal("");
    setVatAmount("");
    setTotalAmount("");
    setCategoryId("");
    setLineItems([]);
  };

  const handleClose = () => {
    if (scanning || submitting) return;
    reset();
    onOpenChange(false);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error("File must be smaller than 15MB");
      return;
    }
    setFile(f);
    setAnalysis(null);
  };

  const handleCapture = (f: File) => {
    setCameraMode(null);
    onFile(f);
  };

  const updateLineItem = (idx: number, field: keyof LineItemRow, value: string) => {
    setLineItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    );
  };

  const addLineItem = () =>
    setLineItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "", total: "" }]);

  const removeLineItem = (idx: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const applyLineItemTotals = () => {
    const sub = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
    if (sub > 0) {
      setSubtotal(sub.toFixed(2));
      const vat = Number(vatAmount) || 0;
      setTotalAmount((sub + vat).toFixed(2));
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.error("Enter a category name");
      return;
    }
    setCreatingCat(true);
    const res = await createCategory({ name: newCatName.trim(), type: newCatType });
    setCreatingCat(false);
    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to create category");
      return;
    }
    setCategories((prev) => [...prev, res.data!]);
    setCategoryId(res.data.id);
    setNewCatName("");
    setShowCreateCat(false);
    toast.success("Category created");
  };

  const runScan = async () => {
    if (!file) return;
    setScanning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
      const path = `${user.id}/scan/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("invoice-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }
      setScanPath(path);

      const res = await analyzeDocument({
        document_type: "INVOICE",
        bucket: "invoice-documents",
        storage_path: path,
        force: true,
      });
      if (!res.success || !res.analysis) {
        toast.error(res.error || "AI scan failed");
        return;
      }
      setAnalysis(res.analysis);
      const e = res.analysis.extracted || {};
      setSupplierName(e.supplier_name ?? "");
      setSupplierVat(e.supplier_vat_number ?? "");
      setInvoiceNumber(e.document_number ?? "");
      setInvoiceDate(e.document_date ?? "");
      setSubtotal(typeof e.subtotal === "number" ? String(e.subtotal) : "");
      setVatAmount(typeof e.vat_amount === "number" ? String(e.vat_amount) : "");
      setTotalAmount(typeof e.total_amount === "number" ? String(e.total_amount) : "");
      const li = (e.line_items ?? []).map((it: any) => ({
        description: it.description ?? "",
        quantity: it.quantity != null ? String(it.quantity) : "1",
        unit_price: it.unit_price != null ? String(it.unit_price) : "",
        total:
          it.total_price != null
            ? String(it.total_price)
            : it.amount != null
            ? String(it.amount)
            : "",
      }));
      setLineItems(li);
      toast.success("Invoice scanned. Review and confirm.");
    } finally {
      setScanning(false);
    }
  };

  const sars = useMemo(() => {
    return validateSarsInvoice({
      supplier_name: supplierName,
      supplier_vat_number: supplierVat,
      document_number: invoiceNumber,
      document_date: invoiceDate,
      vat_amount: vatAmount ? Number(vatAmount) : undefined,
    });
  }, [supplierName, supplierVat, invoiceNumber, invoiceDate, vatAmount]);

  const confidence = analysis?.confidence ?? null;

  const handleCreate = async () => {
    const total = Number(totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter a valid total amount");
      return;
    }
    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (!categoryId) {
      toast.error("Select a category");
      return;
    }
    setSubmitting(true);
    const res = await createTransactionFromInvoice({
      file,
      supplier_name: supplierName.trim(),
      supplier_id: supplierId ?? null,
      supplier_vat_number: supplierVat.trim() || null,
      document_number: invoiceNumber.trim() || null,
      document_date: invoiceDate || null,
      subtotal: subtotal ? Number(subtotal) : null,
      vat_amount: vatAmount ? Number(vatAmount) : null,
      total_amount: total,
      category_id: categoryId,
      ocr_analysis_id: analysis?.id ?? null,
    });
    // best-effort cleanup of the scan staging file
    if (scanPath) {
      supabase.storage.from("invoice-documents").remove([scanPath]).catch(() => {});
    }
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error || "Failed to create transaction");
      return;
    }
    toast.success("Transaction created from invoice");
    onCreated?.();
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Scan Invoice with AI
          </DialogTitle>
          <DialogDescription>
            Upload a supplier invoice. AI will extract the fields, validate SARS
            compliance and let you create a transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Capture options */}
          {!file ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <ActionTile
                icon={<Camera className="h-6 w-6" />}
                label="Take Picture"
                hint="Use device camera"
                onClick={() => setCameraMode("capture")}
              />
              <ActionTile
                icon={<Upload className="h-6 w-6" />}
                label="Upload Image"
                hint="From your gallery"
                onClick={() => imageInputRef.current?.click()}
              />
              <ActionTile
                icon={<Receipt className="h-6 w-6" />}
                label="Add Receipt"
                hint="Auto edge detection"
                onClick={() => setCameraMode("scan")}
              />
              <ActionTile
                icon={<FileText className="h-6 w-6" />}
                label="Upload Invoice"
                hint="PDF or image"
                onClick={() => invoiceInputRef.current?.click()}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="rounded-full bg-primary/10 text-primary p-2.5 shrink-0">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setAnalysis(null);
                }}
                disabled={scanning || submitting}
              >
                Change
              </Button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept={ACCEPTED_IMAGE}
            capture="environment"
            hidden
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <input
            ref={invoiceInputRef}
            type="file"
            accept={ACCEPTED_INVOICE}
            hidden
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          <Button
            onClick={runScan}
            disabled={!file || scanning}
            className="w-full gap-2"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analysis ? "Re-scan invoice" : "Scan with AI"}
          </Button>

          {analysis && (
            <>
              {/* Confidence + SARS validation */}
              <Card className="p-3 space-y-2 bg-indigo-50/40 border-indigo-100">
                <div className="flex flex-wrap items-center gap-2">
                  {typeof confidence === "number" && (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3 w-3 text-indigo-600" />
                      {Math.round(confidence * 100)}% confidence
                    </Badge>
                  )}
                  {sars.isValid ? (
                    <Badge className="bg-success/15 text-success border-success/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {codeLabels.VALID}
                    </Badge>
                  ) : (
                    sars.codes.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="gap-1 border-destructive/40 text-destructive"
                      >
                        <AlertTriangle className="h-3 w-3" /> {codeLabels[c]}
                      </Badge>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Review and correct any fields before creating the transaction.
                </p>
              </Card>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Supplier</Label>
                  <SupplierPicker
                    value={supplierId}
                    onChange={(id, s) => {
                      setSupplierId(id);
                      if (s) {
                        setSupplierName(s.company_name);
                        if (s.vat_number) setSupplierVat(s.vat_number);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="si-name" className="text-xs">Supplier Name</Label>
                  <Input
                    id="si-name"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-vat" className="text-xs">VAT Number</Label>
                  <Input
                    id="si-vat"
                    value={supplierVat}
                    onChange={(e) => setSupplierVat(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-invno" className="text-xs">Invoice Number</Label>
                  <Input
                    id="si-invno"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-invdate" className="text-xs">Invoice Date</Label>
                  <Input
                    id="si-invdate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-sub" className="text-xs">Subtotal (ZAR)</Label>
                  <Input
                    id="si-sub"
                    type="number"
                    step="0.01"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-vata" className="text-xs">VAT Amount (ZAR)</Label>
                  <Input
                    id="si-vata"
                    type="number"
                    step="0.01"
                    value={vatAmount}
                    onChange={(e) => setVatAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-total" className="text-xs">
                    Total (ZAR) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="si-total"
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({c.type === "EXPENSE" ? "Expense" : "Fixed Asset"})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting || scanning}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !analysis}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              Create Transaction from Invoice
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Camera capture */}
      <CameraCaptureModal
        open={cameraMode !== null}
        onOpenChange={(o) => !o && setCameraMode(null)}
        onCapture={handleCapture}
        fileNamePrefix={cameraMode === "scan" ? "receipt-scan" : "invoice-capture"}
      />
    </Dialog>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors p-4 text-center"
    >
      <span className="rounded-full bg-primary/10 text-primary p-2.5 group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}