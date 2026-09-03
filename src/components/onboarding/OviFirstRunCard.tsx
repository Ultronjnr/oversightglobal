import { useState } from "react";
import { ReceiptText, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScanInvoiceModal } from "@/components/finance/ScanInvoiceModal";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Ovi — the Ovasyt guide. Shown on the Super User workspace right after
 * onboarding so the very first action is capturing an expense.
 * Dismissal is remembered per user in local storage.
 */
export function OviFirstRunCard() {
  const { user, profile } = useAuth();
  const storageKey = `ovi_first_run_dismissed_${user?.id ?? "anon"}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "1",
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [useSample, setUseSample] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(true);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, "1");
    setDismissed(true);
  };

  return (
    <>
      <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-primary via-primary/60 to-primary/20 animate-fade-in">
        <div className="relative rounded-[14px] bg-slate-900 text-white p-6 sm:p-8 overflow-hidden">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss guided setup"
            className="absolute top-3 right-3 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative">
            <div className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center">
              <ReceiptText className="h-5 w-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-4">
              Capture your first expense
            </h2>
            <p className="text-white/70 text-sm mt-1 max-w-lg">
              Upload an invoice and watch it become documented, tracked and report-ready.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <Button
                onClick={() => {
                  setUseSample(false);
                  setScanOpen(true);
                }}
              >
                Upload invoice
              </Button>
              <Button
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/20 border-0"
                onClick={() => {
                  setUseSample(true);
                  setScanOpen(true);
                  toast.info("Loading a sample invoice — Ovi will scan it for you.");
                }}
              >
                Try a sample
              </Button>
            </div>
          </div>
        </div>
      </div>

      {bubbleOpen && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-teal-400 text-white text-xs font-bold flex items-center justify-center">
              OVi
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm flex items-center gap-1.5">
                Ovi <Sparkles className="h-3.5 w-3.5 text-primary" />
              </p>
              <p className="text-xs text-muted-foreground">Your Ovasyt guide</p>
              <p className="text-sm mt-3">
                {captured ? (
                  <>
                    Beautifully done{profile?.name ? `, ${profile.name}` : ""}! That expense is
                    now documented, categorised and ready for donor reporting. Next I can show
                    you projects, donors and Section 18A receipts.
                  </>
                ) : (
                  <>
                    Hi{profile?.name ? ` ${profile.name}` : ""}! Let's capture your very first
                    expense. Upload an invoice — or tap <strong>Try a sample</strong> and I'll
                    walk you through it. ✨
                  </>
                )}
              </p>
              <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>1. Upload or scan the invoice</li>
                <li>2. Ovi extracts supplier, VAT and line items</li>
                <li>3. Pick or create the expense category</li>
                <li>4. Link it to a project and donor</li>
                <li>5. Transaction created &amp; report-ready</li>
              </ol>
              <div className="flex items-center justify-between mt-4">
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip tour
                </button>
                <Button size="sm" onClick={() => setBubbleOpen(false)}>
                  Got it →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScanInvoiceModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        sampleUrl={useSample ? "/samples/sample-invoice.pdf" : undefined}
        onCreated={() => {
          setCaptured(true);
          setBubbleOpen(true);
          toast.success("Your first expense is captured — welcome to Ovasyt!");
        }}
      />
    </>
  );
}
