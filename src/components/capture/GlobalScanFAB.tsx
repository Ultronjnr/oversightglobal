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
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Scan an invoice"
        className={cn(
          "group transition-all animate-fade-in",
          isHeader
            ? "h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95 shrink-0"
            : "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 sm:right-6 z-40 h-11 gap-2 rounded-full px-4 bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/50 hover:scale-105 active:scale-95",
          className
        )}
      >
        {!isHeader && (
          <span className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
        )}
        <ScanLine className={cn("shrink-0", isHeader ? "h-4 w-4" : "h-4 w-4")} />
        {!isHeader && (
          <span className="hidden sm:inline text-sm font-semibold">Scan Invoice</span>
        )}
      </Button>

      {/* Scan Invoice Modal */}
      <ScanInvoiceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
