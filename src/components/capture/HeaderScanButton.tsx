import { useState } from "react";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Compact Scan Invoice action shown in the top bar (next to the notification
 * bell) for Super Users, who do not get the floating scan button.
 */
export function HeaderScanButton() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);

  if (role !== "ADMIN") return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Scan an invoice"
        title="Scan Invoice"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 text-primary hover:text-primary hover:bg-primary/10"
      >
        <ScanLine className="h-5 w-5" />
      </Button>
      <ScanInvoiceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
