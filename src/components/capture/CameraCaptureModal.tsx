import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, X, SwitchCamera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface CameraCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  fileNamePrefix?: string;
}

/**
 * Live camera capture for receipts / invoices.
 * - Uses the rear camera by default (facingMode "environment")
 * - Snapshot drawn to a canvas and returned as a JPEG File
 * - Falls back gracefully when getUserMedia is unavailable
 */
export function CameraCaptureModal({
  open,
  onOpenChange,
  onCapture,
  fileNamePrefix = "capture",
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [starting, setStarting] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = async (mode: "environment" | "user") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported on this device.");
      return;
    }
    setStarting(true);
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to access the camera";
      setError(message);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (open && !snapshot) {
      startStream(facingMode);
    }
    if (!open) {
      stopStream();
      setSnapshot(null);
      setError(null);
    }
    return () => {
      if (!open) stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facingMode]);

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast({ title: "Camera not ready", description: "Please wait a moment and try again." });
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setSnapshot(dataUrl);
    stopStream();
  };

  const retake = () => {
    setSnapshot(null);
    startStream(facingMode);
  };

  const confirm = async () => {
    if (!snapshot) return;
    const blob = await (await fetch(snapshot)).blob();
    const file = new File(
      [blob],
      `${fileNamePrefix}-${Date.now()}.jpg`,
      { type: "image/jpeg" }
    );
    onCapture(file);
    onOpenChange(false);
  };

  const flipCamera = () => {
    setSnapshot(null);
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Capture document
          </DialogTitle>
        </DialogHeader>

        <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white text-sm">
              {error}
            </div>
          ) : snapshot ? (
            <img src={snapshot} alt="Captured document snapshot" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Starting camera…
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={flipCamera}
            disabled={!!snapshot || starting || !!error}
            className="gap-2"
          >
            <SwitchCamera className="h-4 w-4" /> Flip
          </Button>
          <div className="flex gap-2 ml-auto">
            {snapshot ? (
              <>
                <Button variant="outline" onClick={retake} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Retake
                </Button>
                <Button onClick={confirm} className="gap-2">
                  <Check className="h-4 w-4" /> Use photo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button onClick={takeSnapshot} disabled={starting || !!error} className="gap-2">
                  <Camera className="h-4 w-4" /> Capture
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}