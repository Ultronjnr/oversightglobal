import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, PiggyBank } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";

export interface ProjectBudgetSummary {
  budget: number;
  reserved: number;
  spent: number;
  remaining: number;
}

interface Props {
  projectId: string | null;
  /** Amount about to be reserved against the project. */
  amount: number;
  projectName?: string;
  /** Notified whenever the requested amount exceeds what is left. */
  onOverBudgetChange?: (overBudget: boolean) => void;
}

/**
 * Live budget context shown to Finance before they approve a requisition
 * against a donation project: budget / reserved / spent / remaining, plus
 * what this requisition would leave behind.
 */
export function ProjectBudgetPreview({
  projectId,
  amount,
  projectName,
  onOverBudgetChange,
}: Props) {
  const { format: formatCurrency } = useCurrency();
  const [summary, setSummary] = useState<ProjectBudgetSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!projectId) {
      setSummary(null);
      setError(null);
      onOverBudgetChange?.(false);
      return;
    }

    setLoading(true);
    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_project_budget_summary" as never,
        { _project_id: projectId } as never,
      );
      if (!active) return;
      setLoading(false);

      const result = data as unknown as
        | (ProjectBudgetSummary & { success: boolean; error?: string })
        | null;

      if (rpcError || !result?.success) {
        setSummary(null);
        setError(result?.error || rpcError?.message || "Could not load project budget");
        onOverBudgetChange?.(false);
        return;
      }

      setError(null);
      setSummary({
        budget: Number(result.budget) || 0,
        reserved: Number(result.reserved) || 0,
        spent: Number(result.spent) || 0,
        remaining: Number(result.remaining) || 0,
      });
    })();

    return () => {
      active = false;
    };
  }, [projectId, onOverBudgetChange]);

  useEffect(() => {
    if (!summary) return;
    onOverBudgetChange?.(amount > summary.remaining);
  }, [summary, amount, onOverBudgetChange]);

  if (!projectId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking project budget…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!summary) return null;

  const after = summary.remaining - amount;
  const overBudget = after < 0;

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        overBudget
          ? "bg-destructive/10 border-destructive/30"
          : "bg-primary/5 border-primary/25"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold">
        <PiggyBank className="h-4 w-4 text-primary" />
        {projectName ? `${projectName} budget` : "Project budget"}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <Row label="Budget" value={formatCurrency(summary.budget)} />
        <Row label="Reserved" value={formatCurrency(summary.reserved)} />
        <Row label="Spent" value={formatCurrency(summary.spent)} />
        <Row label="Remaining" value={formatCurrency(summary.remaining)} />
      </dl>

      <div
        className={`text-xs pt-2 border-t ${
          overBudget
            ? "border-destructive/30 text-destructive font-medium"
            : "border-primary/20 text-muted-foreground"
        }`}
      >
        {overBudget ? (
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            This requisition of {formatCurrency(amount)} exceeds the remaining budget by{" "}
            {formatCurrency(Math.abs(after))}. Approval is blocked until the budget is
            increased or another project is selected.
          </span>
        ) : (
          <>
            Reserving {formatCurrency(amount)} leaves{" "}
            <span className="font-semibold text-foreground">{formatCurrency(after)}</span>{" "}
            available on this project.
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </>
  );
}
