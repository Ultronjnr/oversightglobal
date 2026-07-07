import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, ImageIcon, Loader2, Receipt, FileCheck2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getLatestAnalysisFor, type OcrExtracted } from "@/services/ocr.service";

interface Props {
  fileName: string;
  fileUrl: string; // stored path like "pr-documents/chat/<id>/..."
  mine?: boolean;
}

function parsePath(stored: string): { bucket: string; path: string } {
  // Accept "pr-documents/foo/bar.jpg" or already-stripped "foo/bar.jpg"
  if (stored.startsWith("pr-documents/")) {
    return { bucket: "pr-documents", path: stored.replace(/^pr-documents\//, "") };
  }
  return { bucket: "pr-documents", path: stored };
}

function isImage(name: string) {
  return /\.(png|jpe?g|webp|gif|heic)$/i.test(name);
}
function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

type DocKind = "receipt" | "invoice" | "other";
function detectKind(fileName: string, storagePath: string): DocKind {
  const hay = `${fileName} ${storagePath}`.toLowerCase();
  if (/(invoice|inv[-_ ]?no|tax[-_ ]?inv|vat[-_ ]?inv)/.test(hay)) return "invoice";
  if (/(receipt|till[-_ ]?slip|proof[-_ ]?of[-_ ]?payment|pop|scan)/.test(hay)) return "receipt";
  // Default heuristic: PDFs are usually invoices, photos are usually receipts
  if (isPdf(fileName)) return "invoice";
  if (isImage(fileName)) return "receipt";
  return "other";
}

function fmtMoney(n?: number, currency?: string) {
  if (n == null || isNaN(n)) return null;
  const cur = (currency || "ZAR").toUpperCase();
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${cur} ${n.toFixed(2)}`;
  }
}

export function PRChatAttachment({ fileName, fileUrl, mine }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [ocr, setOcr] = useState<OcrExtracted | null>(null);
  const image = isImage(fileName);
  const pdf = isPdf(fileName);
  const { path: storagePath } = parsePath(fileUrl);
  const kind = detectKind(fileName, storagePath);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { bucket, path } = parsePath(fileUrl);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
      if (!cancelled) {
        setSigned(data?.signedUrl ?? null);
        setLoading(false);
      }
      // Try to load OCR extracted fields (best-effort)
      if (image || pdf) {
        const analysis = await getLatestAnalysisFor({ bucket, storage_path: path });
        if (!cancelled && analysis?.extracted) setOcr(analysis.extracted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, image, pdf]);

  const triggerDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signed) return;
    const a = document.createElement("a");
    a.href = signed;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Image thumbnail
  if (image) {
    return (
      <>
        <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "relative block overflow-hidden rounded-lg border max-w-[220px] hover:opacity-90 transition",
            mine ? "border-primary-foreground/30" : "border-border"
          )}
          aria-label={`Preview ${fileName}`}
        >
          {loading || !signed ? (
            <div className="h-32 w-40 flex items-center justify-center bg-muted/40">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <img
              src={signed}
              alt={fileName}
              className="h-32 w-40 object-cover bg-muted/30"
              loading="lazy"
            />
          )}
          <span
            className={cn(
              "absolute bottom-0 left-0 right-0 text-[10px] px-1.5 py-0.5 truncate text-left",
              "bg-black/55 text-white"
            )}
          >
            {fileName}
          </span>
          <span className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-md bg-black/55 text-white text-[10px] px-1.5 py-0.5">
            {kind === "invoice" ? <FileCheck2 className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
            {kind === "invoice" ? "Invoice" : "Receipt"}
          </span>
        </button>
        <OcrPreviewCard kind={kind} ocr={ocr} mine={mine} />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden">
            <div className="bg-black flex items-center justify-center max-h-[80vh]">
              {signed && (
                <img
                  src={signed}
                  alt={fileName}
                  className="max-h-[80vh] w-auto object-contain"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border bg-background">
              <span className="text-sm font-medium truncate">{fileName}</span>
              <Button size="sm" variant="outline" onClick={triggerDownload} className="gap-1">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // PDF / generic file pill
  return (
    <div className="flex flex-col gap-1.5">
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs max-w-[260px]",
        mine
          ? "bg-primary-foreground/10 border-primary-foreground/25 text-primary-foreground"
          : "bg-background border-border text-foreground"
      )}
    >
      {kind === "invoice" ? (
        <FileCheck2 className="h-4 w-4 shrink-0" />
      ) : pdf ? (
        <FileText className="h-4 w-4 shrink-0" />
      ) : (
        <ImageIcon className="h-4 w-4 shrink-0" />
      )}
      <span className="truncate flex-1" title={fileName}>{fileName}</span>
      <button
        type="button"
        onClick={triggerDownload}
        disabled={!signed}
        className={cn(
          "shrink-0 rounded p-1 hover:bg-foreground/10 disabled:opacity-50",
          mine ? "hover:bg-primary-foreground/10" : ""
        )}
        aria-label="Download attachment"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
    <OcrPreviewCard kind={kind} ocr={ocr} mine={mine} />
    </div>
  );
}

function OcrPreviewCard({
  kind,
  ocr,
  mine,
}: {
  kind: DocKind;
  ocr: OcrExtracted | null;
  mine?: boolean;
}) {
  if (kind === "other" || !ocr) return null;
  const total = fmtMoney(ocr.total_amount, ocr.currency);
  const vat = fmtMoney(ocr.vat_amount, ocr.currency);
  const fields: Array<[string, string | null | undefined]> = [
    ["Supplier", ocr.supplier_name],
    [kind === "invoice" ? "Invoice #" : "Receipt #", ocr.document_number],
    ["Date", ocr.document_date],
    ["Total", total],
    ["VAT", vat],
  ].filter(([, v]) => !!v) as Array<[string, string]>;
  if (fields.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 text-[11px] max-w-[260px]",
        mine
          ? "bg-primary-foreground/10 border-primary-foreground/25 text-primary-foreground"
          : "bg-background border-border text-foreground"
      )}
    >
      <div className="flex items-center gap-1 mb-1 font-medium opacity-80">
        <Sparkles className="h-3 w-3" />
        Extracted · {kind === "invoice" ? "Invoice" : "Receipt"}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {fields.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="opacity-70">{k}</dt>
            <dd className="font-medium truncate">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}