import { useState, useEffect } from "react";
import { FileText, Download, ExternalLink, Loader2, AlertCircle, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getDocumentSignedUrl, getFileType } from "@/services/document.service";
import { toast } from "sonner";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  prId: string;
  transactionId?: string;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  documentUrl,
  prId,
  transactionId,
}: DocumentViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("document");
  const [fileType, setFileType] = useState<"pdf" | "image" | "other">("other");

  // Fetch signed URL when modal opens
  useEffect(() => {
    if (isOpen && documentUrl && prId) {
      fetchSignedUrl();
    } else {
      // Reset state when closing
      setSignedUrl(null);
      setHasError(false);
      setErrorMessage(null);
      setIsLoading(true);
    }
  }, [isOpen, documentUrl, prId]);

  const fetchSignedUrl = async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    const result = await getDocumentSignedUrl(documentUrl, prId);

    if (!result.success || !result.signed_url) {
      setHasError(true);
      setErrorMessage(result.error || "Failed to load document");
      setIsLoading(false);
      return;
    }

    setSignedUrl(result.signed_url);
    setFileName(result.file_name || "document");
    setFileType(result.file_type || getFileType(documentUrl));
    setIsLoading(false);
  };

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
    if (!signedUrl) {
      toast.error("Document not available");
      return;
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleIframeLoad = () => {
    // Iframe loaded successfully
  };

  const handleIframeError = () => {
    setHasError(true);
    setErrorMessage("Unable to preview document in browser");
  };

  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading document...</p>
          </div>
        </div>
      );
    }

    // Error state
    if (hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md px-4">
            <div className="p-4 bg-destructive/10 rounded-full inline-block">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-foreground">Unable to preview document</p>
              <p className="text-sm text-muted-foreground mt-1">
                {errorMessage || "The document cannot be displayed."}
              </p>
            </div>
            {signedUrl && (
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
            )}
          </div>
        </div>
      );
    }

    // Image preview
    if (fileType === "image" && signedUrl) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <img
            src={signedUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain rounded-lg"
            onError={() => {
              setHasError(true);
              setErrorMessage("Failed to load image");
            }}
          />
        </div>
      );
    }

    // PDF preview (iframe)
    if (fileType === "pdf" && signedUrl) {
      return (
        <iframe
          src={signedUrl}
          className="w-full h-full border-0"
          title="Document Preview"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      );
    }

    // Other file types - offer download
    if (signedUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="p-4 bg-muted rounded-full inline-block">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                This file type cannot be previewed in the browser.
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
      );
    }

    return null;
  };

  const getFileIcon = () => {
    switch (fileType) {
      case "image":
        return <ImageIcon className="h-5 w-5 text-primary" />;
      default:
        return <FileText className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                {getFileIcon()}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {fileName || "Attached Document"}
                </DialogTitle>
                {transactionId && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {transactionId}
                  </p>
                )}
              </div>
            </div>
            {signedUrl && !isLoading && (
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
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 relative bg-muted/20 overflow-hidden">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
