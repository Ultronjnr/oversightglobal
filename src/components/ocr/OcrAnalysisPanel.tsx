import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  analyzeDocument,
  getLatestAnalysisFor,
  type AnalyzeDocumentInput,
  type OcrAnalysis,
} from "@/services/ocr.service";

interface OcrAnalysisPanelProps {
  input: AnalyzeDocumentInput;
  title?: string;
  autoLoad?: boolean;
}

export function OcrAnalysisPanel({
  input,
  title = "Document analysis",
  autoLoad = true,
}: OcrAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<OcrAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedInitial, setLoadedInitial] = useState(false);

  useEffect(() => {
    if (!autoLoad) {
      setLoadedInitial(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const cached = await getLatestAnalysisFor({
        storage_path: input.storage_path,
        bucket: input.bucket,
        invoice_id: input.invoice_id,
        reimbursement_id: input.reimbursement_id,
        pr_id: input.pr_id,
      });
      if (!cancelled) {
        setAnalysis(cached);
        setLoadedInitial(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    autoLoad,
    input.storage_path,
    input.bucket,
    input.invoice_id,
    input.reimbursement_id,
    input.pr_id,
  ]);

  const run = async (force = false) => {
    setLoading(true);
    const res = await analyzeDocument({ ...input, force });
    setLoading(false);
    if (!res.success || !res.analysis) {
      toast({
        title: "OCR failed",
        description: res.error ?? "Could not analyze document",
        variant: "destructive",
      });
      return;
    }
    setAnalysis(res.analysis);
    toast({
      title: res.cached ? "Loaded cached analysis" : "Document analyzed",
      description: res.cached
        ? "Reused a previous extraction for this file."
        : "Extracted structured fields from the document.",
    });
  };

  const e = analysis?.extracted ?? null;
  const currency = e?.currency || "ZAR";

  return (
    <Card className="p-4 space-y-3 border-indigo-100 bg-indigo-50/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <h4 className="font-medium text-sm">{title}</h4>
          {analysis?.status === "COMPLETED" && (
            <Badge variant="outline" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {typeof analysis.confidence === "number"
                ? `${Math.round(analysis.confidence * 100)}% confidence`
                : "Completed"}
            </Badge>
          )}
          {analysis?.status === "FAILED" && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <AlertCircle className="h-3 w-3" /> Failed
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!analysis && loadedInitial && (
            <Button size="sm" onClick={() => run(false)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              Scan document
            </Button>
          )}
          {analysis && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Re-analyze
            </Button>
          )}
        </div>
      </div>

      {!loadedInitial && (
        <p className="text-xs text-muted-foreground">Checking for existing analysis…</p>
      )}

      {analysis?.status === "FAILED" && analysis.error_message && (
        <p className="text-xs text-destructive">{analysis.error_message}</p>
      )}

      {e && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Supplier" value={e.supplier_name} />
          <Field label="VAT number" value={e.supplier_vat_number} />
          <Field label="Document #" value={e.document_number} />
          <Field label="Document date" value={e.document_date} />
          {e.due_date && <Field label="Due date" value={e.due_date} />}
          {e.payment_method && <Field label="Payment method" value={e.payment_method} />}
          {e.payment_reference && (
            <Field label="Payment reference" value={e.payment_reference} />
          )}
          {typeof e.subtotal === "number" && (
            <Field label="Subtotal" value={formatCurrency(e.subtotal, currency)} />
          )}
          {typeof e.vat_amount === "number" && (
            <Field
              label={`VAT${typeof e.vat_rate === "number" ? ` (${e.vat_rate}%)` : ""}`}
              value={formatCurrency(e.vat_amount, currency)}
            />
          )}
          {typeof e.total_amount === "number" && (
            <Field
              label="Total"
              value={formatCurrency(e.total_amount, currency)}
              strong
            />
          )}
        </div>
      )}

      {e?.line_items && e.line_items.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Line items</p>
          <div className="rounded border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Qty</th>
                  <th className="p-2 text-right">Unit</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {e.line_items.map((li, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{li.description}</td>
                    <td className="p-2 text-right">{li.quantity ?? "—"}</td>
                    <td className="p-2 text-right">
                      {typeof li.unit_price === "number"
                        ? formatCurrency(li.unit_price, currency)
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {typeof li.amount === "number"
                        ? formatCurrency(li.amount, currency)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {e?.notes && (
        <p className="text-xs text-muted-foreground italic">Note: {e.notes}</p>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string | number | null;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={strong ? "font-semibold" : ""}>
        {value === undefined || value === null || value === "" ? "—" : String(value)}
      </p>
    </div>
  );
}