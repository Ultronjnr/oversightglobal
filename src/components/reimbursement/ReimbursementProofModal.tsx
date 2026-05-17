import { useEffect, useState } from "react";
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getReimbursementProofUrl } from "@/services/reimbursement.service";
import { toast } from "sonner";

interface ReimbursementProofModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proofPath: string | null;
  title?: string;
  subtitle?: string;
}

function detectType(path: string): "pdf" | "image" | "other" {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower)) return "image";
  return "other";
}

function deriveFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || "proof-of-payment";
}

export function ReimbursementProofModal({
  open,
  onOpenChange,
  proofPath,
  title,
  subtitle,
}: ReimbursementProofModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const fileType = proofPath ? detectType(proofPath) : "other";
  const fileName = proofPath ? deriveFileName(proofPath) : "proof";

  useEffect(() => {
    let cancelled = false;
    if (!open || !proofPath) {
      setSignedUrl(null);
      setError(null);
      setLoading(true);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      const url = await getReimbursementProofUrl(proofPath);
      if (cancelled) return;
      if (!url) {
        setError("Failed to load proof document");
      } else {
        setSignedUrl(url);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, proofPath]);

  const handleDownload = () => {
    if (!signedUrl) {
      toast.error("Document not available for download");
      return;
    }
    const link = document.createElement("a");
    link.href = signedUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    if (!signedUrl) return;
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg">
                {fileType === "image" ? (
                  <ImageIcon className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold truncate">
                  {title || fileName}
                </DialogTitle>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {signedUrl && !loading && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleOpenExternal} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 relative bg-muted/20 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading proof…</p>
              </div>
            </div>
          )}
          {!loading && error && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="text-center space-y-3 max-w-md">
                <div className="p-3 bg-destructive/10 rounded-full inline-block">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <p className="font-medium">Unable to load proof</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
          {!loading && !error && signedUrl && fileType === "image" && (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={signedUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={() => setError("Failed to display image")}
              />
            </div>
          )}
          {!loading && !error && signedUrl && fileType === "pdf" && (
            <iframe
              src={signedUrl}
              className="w-full h-full border-0"
              title="Proof of payment"
            />
          )}
          {!loading && !error && signedUrl && fileType === "other" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="p-4 bg-muted rounded-full inline-block">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  This file type cannot be previewed in the browser.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" onClick={handleOpenExternal} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open in New Tab
                  </Button>
                  <Button onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}