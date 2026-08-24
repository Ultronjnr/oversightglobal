import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSubscriptionState, type SubscriptionState } from "@/services/subscription.service";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Blocks portal content once the trial has lapsed or billing is past due.
 * The billing page itself stays reachable so users can resolve the block.
 */
export function SubscriptionLockGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  useEffect(() => {
    getSubscriptionState().then(setState).catch(() => setState(null));
  }, []);

  const allowed = pathname.startsWith("/billing");

  if (!state?.locked || allowed) return <>{children}</>;

  const pastDue = state.status === "PAST_DUE";

  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <Lock className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        {pastDue ? "Billing needs attention" : "Your free trial has ended"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isAdmin
          ? pastDue
            ? "Your last payment failed, so access is paused. Update your payment details to unlock your workspace again."
            : "Access is paused until a plan is activated. Choose a plan to continue using Ovasyt."
          : pastDue
            ? "Your organisation's last payment failed, so access is paused. Only an administrator can update the billing details."
            : "Your organisation's access is paused until a plan is activated. Only an administrator can choose a plan."}
      </p>
      {isAdmin ? (
        <Button asChild className="mt-6">
          <Link to="/billing">{pastDue ? "Update billing" : "Choose a plan"}</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-6">
          <a href="mailto:info@ovasyt.tech?subject=Ovasyt%20access%20paused">
            Contact support
          </a>
        </Button>
      )}
    </Card>
  );
}
