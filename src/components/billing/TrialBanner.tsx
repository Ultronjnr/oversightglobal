import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSubscriptionState, type SubscriptionState } from "@/services/subscription.service";

/**
 * Shows the 14-day trial countdown and, once the trial has lapsed or billing is
 * past due, a hard prompt to add payment details.
 */
export function TrialBanner() {
  const [state, setState] = useState<SubscriptionState | null>(null);

  useEffect(() => {
    getSubscriptionState().then(setState).catch(() => setState(null));
  }, []);

  if (!state) return null;

  if (state.locked) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {state.status === "PAST_DUE"
              ? "Your last payment failed. Update your card to keep your account active."
              : "Your free trial has ended. Choose a plan to continue using Ovasyt."}
          </p>
          <Button asChild size="sm">
            <Link to="/billing">Choose a plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "TRIALING" && state.trial_days_left !== null) {
    return (
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            Free trial — <span className="font-semibold">{state.trial_days_left} day{state.trial_days_left === 1 ? "" : "s"}</span> left
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/billing">Activate Platform Pro</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}