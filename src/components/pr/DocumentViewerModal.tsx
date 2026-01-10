import { useState } from "react";
import { FileText, Download, ExternalLink, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  transactionId?: string;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  documentUrl,
  transactionId,
}: DocumentViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = documentUrl;
    link.download = `${transactionId || "document"}.pdf`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    window.open(documentUrl, "_blank", "noopener,noreferrer");
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  Attached Document
                </DialogTitle>
                {transactionId && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {transactionId}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-muted/20 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="p-4 bg-destructive/10 rounded-full inline-block">
                  <X className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Unable to preview document</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The document cannot be displayed in the browser.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={handleOpenExternal}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <iframe
              src={documentUrl}
              className="w-full h-full border-0"
              title="Document Preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
