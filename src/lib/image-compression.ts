/**
 * Client-side image compression for the Invoice Scan workflow.
 *
 * Large phone photos (often 5–12 MB) make uploads slow and OCR payloads huge.
 * We downscale to a sensible max dimension and re-encode as JPEG before the
 * file is ever uploaded — dramatically reducing upload time and OCR latency
 * while keeping the document perfectly legible.
 *
 * PDFs and non-image files are returned untouched.
 */

export interface CompressOptions {
  /** Longest edge in pixels. Default 2000 keeps small text crisp for OCR. */
  maxDimension?: number;
  /** JPEG quality 0..1. Default 0.82 is a strong size/quality balance. */
  quality?: number;
  /** Skip compression if the file is already smaller than this (bytes). */
  skipUnder?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2000,
  quality: 0.82,
  skipUnder: 600 * 1024, // 600KB
};

function isCompressibleImage(file: File): boolean {
  return /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = url;
  });
}

/**
 * Compress an image file. Returns the original file unchanged when it is not a
 * compressible image, is already small, or if anything goes wrong (best effort).
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxDimension, quality, skipUnder } = { ...DEFAULTS, ...opts };

  if (!isCompressibleImage(file)) return file;
  if (file.size <= skipUnder) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { width, height } = img;
    if (!width || !height) return file;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file; // best effort — never block the scan on compression failure
  } finally {
    URL.revokeObjectURL(url);
  }
}