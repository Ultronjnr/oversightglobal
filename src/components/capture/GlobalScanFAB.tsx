import { useRef, useState } from "react";
import {
  Camera,
  Upload,
  ScanLine,
  FileText,
  Receipt,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { SubmitStandaloneReimbursementModal } from "@/components/pr/SubmitStandaloneReimbursementModal";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp,image/heic";
const ACCEPTED_INVOICE = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 15;

type Mode = "capture" | "scan" | null;

/**
 * Global floating action button (top-right) that lets Employee / HOD / Finance
 * users instantly capture or upload a receipt/invoice. Captured files are
 * pushed into the existing reimbursement flow which already handles secure
 * storage upload, RLS-scoped persistence and the AI OCR pipeline.
 */
export function GlobalScanFAB() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<Mode>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [reimbursementOpen, setReimbursementOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  // Only show for org users who can act on receipts (Admin excluded).
  if (!role || !["EMPLOYEE", "HOD", "FINANCE"].includes(role)) {
    return null;
  }

  const handleFile = (file: File | null, accept: string) => {
    if (!file) return;
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      toast.error(`File too large — max ${MAX_MB}MB`);
      return;
    }
    const ok = accept.split(",").some((m) => file.type === m.trim());
    if (!ok) {
      toast.error("Unsupported file type");
      return;
    }
    setPendingFile(file);
    setOpen(false);
    setReimbursementOpen(true);
  };

  const handleCapture = (file: File) => {
    setCameraMode(null);
    handleFile(file, ACCEPTED_IMAGE);
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add invoice or upload a receipt"
        className="fixed top-20 right-4 sm:right-6 z-40 group flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all px-4 py-3 animate-fade-in"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        <FileText className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Add Invoice</span>
      </button>

      {/* Action sheet */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Capture a document
            </DialogTitle>
            <DialogDescription>
              Snap a receipt, add an invoice or upload a file. We'll create a
              reimbursement and run AI analysis automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <ActionTile
              icon={<Camera className="h-6 w-6" />}
              label="Take Picture"
              hint="Use device camera"
              onClick={() => {
                setOpen(false);
                setCameraMode("capture");
              }}
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
              onClick={() => {
                setOpen(false);
                setCameraMode("scan");
              }}
            />
            <ActionTile
              icon={<FileText className="h-6 w-6" />}
              label="Upload Invoice"
              hint="PDF or image"
              onClick={() => invoiceInputRef.current?.click()}
            />
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept={ACCEPTED_IMAGE}
            capture="environment"
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0] ?? null, ACCEPTED_IMAGE);
              e.target.value = "";
            }}
          />
          <input
            ref={invoiceInputRef}
            type="file"
            accept={ACCEPTED_INVOICE}
            hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0] ?? null, ACCEPTED_INVOICE);
              e.target.value = "";
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Camera */}
      <CameraCaptureModal
        open={cameraMode !== null}
        onOpenChange={(o) => !o && setCameraMode(null)}
        onCapture={handleCapture}
        fileNamePrefix={cameraMode === "scan" ? "receipt-scan" : "capture"}
      />

      {/* Reimbursement modal with file pre-attached */}
      <SubmitStandaloneReimbursementModal
        open={reimbursementOpen}
        onOpenChange={(o) => {
          setReimbursementOpen(o);
          if (!o) setPendingFile(null);
        }}
        initialFile={pendingFile}
        onSubmitted={() => {
          toast.success("Reimbursement created — AI analysis running.");
        }}
      />
    </>
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