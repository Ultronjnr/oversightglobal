import { useState } from "react";
import { ScanLine } from "lucide-react";
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Global floating action button (top-right) that lets Employee / HOD / Finance
 * users instantly scan an invoice with AI. Opens the Scan Invoice (AI OCR)
 * workflow which handles secure storage upload and the AI OCR pipeline.
 */
export function GlobalScanFAB() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  // Only show for org users who can act on invoices (Admin excluded).
  if (!role || !["EMPLOYEE", "HOD", "FINANCE"].includes(role)) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan an invoice with AI"
        className="fixed top-20 right-4 sm:right-6 z-40 group flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all px-4 py-3 animate-fade-in"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        <ScanLine className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Scan Invoice</span>
      </button>

      {/* Scan Invoice (AI OCR) Modal */}
      <ScanInvoiceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
