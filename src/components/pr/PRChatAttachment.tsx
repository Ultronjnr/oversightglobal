import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

export function PRChatAttachment({ fileName, fileUrl, mine }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const image = isImage(fileName);
  const pdf = isPdf(fileName);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { bucket, path } = parsePath(fileUrl);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
      if (!cancelled) {
        setSigned(data?.signedUrl ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

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
        </button>

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
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs max-w-[260px]",
        mine
          ? "bg-primary-foreground/10 border-primary-foreground/25 text-primary-foreground"
          : "bg-background border-border text-foreground"
      )}
    >
      {pdf ? <FileText className="h-4 w-4 shrink-0" /> : <ImageIcon className="h-4 w-4 shrink-0" />}
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
  );
}