import { useState } from "react";
import { ScanLine } from "lucide-react";
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlobalScanFABProps {
  /** Render as a compact header icon instead of a floating pill. */
  variant?: "floating" | "header";
  className?: string;
}

/**
 * Global Scan Invoice action. In header mode it sits beside the notification
 * bell; in floating mode it appears as a bottom-right pill.
 */
export function GlobalScanFAB({ variant = "floating", className }: GlobalScanFABProps) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  // Show one consistent scanner for every internal portal role.
  if (!role || !["EMPLOYEE", "HOD", "FINANCE", "ADMIN"].includes(role)) {
    return null;
  }

  const isHeader = variant === "header";

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan an invoice"
        className={cn(
          "group gap-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all animate-fade-in",
          isHeader
            ? "h-9 px-3 sm:px-4 shrink-0"
            : "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 sm:right-6 z-40 h-11 px-4",
          className
        )}
      >
        <ScanLine className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline text-sm font-semibold">Scan Invoice</span>
      </Button>

      {/* Scan Invoice Modal */}
      <ScanInvoiceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
