import { useRef, useState } from "react";
import { Camera, Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCaptureModal } from "./CameraCaptureModal";

interface DocumentCaptureFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSizeMB?: number;
  helperText?: string;
  fileNamePrefix?: string;
  onError?: (msg: string) => void;
}

/**
 * Upload-or-capture field for invoices, receipts and PR documents.
 * Renders a drop zone + "Take photo" button (mobile rear camera).
 */
export function DocumentCaptureField({
  file,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  maxSizeMB = 10,
  helperText = "PDF, JPG, PNG (max 10MB)",
  fileNamePrefix = "capture",
  onError,
}: DocumentCaptureFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleFile = (f: File | null) => {
    if (!f) return onChange(null);
    if (f.size > maxSizeMB * 1024 * 1024) {
      onError?.(`File too large (max ${maxSizeMB}MB)`);
      return;
    }
    onChange(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
        <FileText className="h-5 w-5 text-primary" />
        <span className="flex-1 text-sm truncate">{file.name}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          className="h-8 w-8"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
        >
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Upload file</span>
          <span className="text-xs text-muted-foreground mt-1">{helperText}</span>
        </button>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
        >
          <Camera className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Take photo</span>
          <span className="text-xs text-muted-foreground mt-1">Use rear camera</span>
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      <CameraCaptureModal
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleFile}
        fileNamePrefix={fileNamePrefix}
      />
    </>
  );
}