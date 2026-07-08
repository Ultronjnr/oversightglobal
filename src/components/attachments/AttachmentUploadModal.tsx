import { useState } from "react";
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
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  uploadAttachment,
  type AttachmentKind,
  ATTACHMENT_KIND_LABELS,
} from "@/services/attachment.service";

const ACCEPT = ".pdf,application/pdf,image/jpeg,image/jpg,image/png";

export interface AttachmentTargets {
  pr_id?: string | null;
  transaction_id?: string | null;
  reimbursement_id?: string | null;
  supplier_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AttachmentKind;
  targets: AttachmentTargets;
  defaultSupplierName?: string;
  onUploaded?: () => void;
}

export function AttachmentUploadModal({
  open,
  onOpenChange,
  kind,
  targets,
  defaultSupplierName,
  onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierName, setSupplierName] = useState(defaultSupplierName || "");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [vatNumber, setVatNumber] = useState("");

  const isInvoice = kind === "INVOICE";
  const title = `Upload ${ATTACHMENT_KIND_LABELS[kind] ?? "Attachment"}`;

  const reset = () => {
    setFile(null);
    setInvoiceNumber("");
    setSupplierName(defaultSupplierName || "");
    setInvoiceDate("");
    setVatNumber("");
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Please select a file (PDF, JPG, or PNG).");
      return;
    }
    setLoading(true);
    const res = await uploadAttachment({
      file,
      kind,
      ...targets,
      invoice_number: invoiceNumber || null,
      supplier_name: supplierName || null,
      invoice_date: invoiceDate || null,
      vat_number: vatNumber || null,
    });
    setLoading(false);
    if (res.success) {
      toast.success(`${title} successful`);
      onUploaded?.();
      reset();
      onOpenChange(false);
    } else {
      toast.error(res.error || "Upload failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            PDF, JPG or PNG. Max 15MB. Files are stored securely and linked to this record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-5 text-center hover:border-primary/50 transition-colors">
            <Input
              id="att-file"
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Label htmlFor="att-file" className="cursor-pointer flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-muted">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              {file ? (
                <div>
                  <p className="font-medium text-primary">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG · max 15MB</p>
                </div>
              )}
            </Label>
          </div>

          {isInvoice && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="att-invno" className="text-xs">Invoice Number</Label>
                <Input id="att-invno" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
              </div>
              <div>
                <Label htmlFor="att-invdate" className="text-xs">Invoice Date</Label>
                <Input id="att-invdate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="att-supplier" className="text-xs">Supplier Name</Label>
                <Input id="att-supplier" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier" />
              </div>
              <div>
                <Label htmlFor="att-vat" className="text-xs">VAT Number</Label>
                <Input id="att-vat" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="4123456789" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || !file} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}