import { useState } from "react";
import { ScanLine } from "lucide-react";
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Global floating action button (top-right) that lets Employee / HOD / Finance
 * users instantly scan an invoice. Opens the Scan Invoice
 * workflow which handles secure storage upload and the OCR pipeline.
 */
export function GlobalScanFAB() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  // Show one consistent floating scanner for every internal portal role.
  if (!role || !["EMPLOYEE", "HOD", "FINANCE", "ADMIN"].includes(role)) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan an invoice"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 sm:right-6 z-40 group h-11 gap-2 rounded-full px-4 bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all animate-fade-in"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline text-sm font-semibold">Scan Invoice</span>
      </Button>

      {/* Scan Invoice Modal */}
      <ScanInvoiceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
