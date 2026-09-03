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
              <Button onClick={() => setScanOpen(true)}>Upload invoice</Button>
              <Button
                variant="secondary"
                className="bg-white/10 text-white hover:bg-white/20 border-0"
                onClick={() =>
                  toast.info(
                    "The sample invoice arrives with the guided capture step — coming in the next layer.",
                  )
                }
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
                Hi{profile?.name ? ` ${profile.name}` : ""}! Let's capture your very first
                expense. Just tap <strong>Upload invoice</strong> — I'll do the rest. ✨
              </p>
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

      <ScanInvoiceModal open={scanOpen} onOpenChange={setScanOpen} />
    </>
  );
}
