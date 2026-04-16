/**
 * BarcodeScanner — camera-based barcode detection using the browser's
 * BarcodeDetector API with a getUserMedia video stream fallback.
 *
 * On supported browsers (Chrome Android, Safari 16+), opens the rear camera
 * and continuously scans for EAN/UPC barcodes. On detection, calls onScan
 * with the barcode string and stops the stream.
 *
 * Falls back to a manual text input on unsupported browsers.
 */

import { Camera, ImageUp, Keyboard, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ScanMode = "camera" | "manual" | "photo";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

// ── Feature detection ──────────────────────────────────────────────────────

function isBarcodeDetectorSupported(): boolean {
  return "BarcodeDetector" in window;
}

// ── Component ──────────────────────────────────────────────────────────────

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanMode>(
    isBarcodeDetectorSupported() ? "camera" : "manual",
  );
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  const switchMode = useCallback(
    (next: ScanMode) => {
      stopStream();
      setError(null);
      setPhotoError(null);
      setMode(next);
    },
    [stopStream],
  );

  // Start camera + detection loop
  useEffect(() => {
    if (mode !== "camera") return;

    let cancelled = false;

    async function startScanning() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
        });

        scanningRef.current = true;

        const scan = async () => {
          if (!scanningRef.current || !videoRef.current || cancelled) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              scanningRef.current = false;
              onScan(barcodes[0].rawValue);
              return;
            }
          } catch {
            // Detection frame failed — continue
          }

          if (scanningRef.current && !cancelled) {
            requestAnimationFrame(scan);
          }
        };

        requestAnimationFrame(scan);
      } catch {
        if (!cancelled) {
          setError("Camera access denied. Use manual entry instead.");
          setMode("manual");
        }
      }
    }

    void startScanning();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [mode, onScan, stopStream]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const handleManualSubmit = useCallback(() => {
    const cleaned = manualBarcode.trim().replace(/\D/g, "");
    const validLengths = [8, 12, 13, 14];
    if (validLengths.includes(cleaned.length) && !/^(.)\1+$/.test(cleaned)) {
      onScan(cleaned);
    }
  }, [manualBarcode, onScan]);

  const handlePhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setPhotoError(null);
      setPhotoProcessing(true);

      try {
        const bitmap = await createImageBitmap(file);
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
        });
        const barcodes = await detector.detect(bitmap);
        bitmap.close();

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          onScan(barcodes[0].rawValue);
        } else {
          setPhotoError(
            "No barcode found in this image. Try a clearer photo with the barcode fully visible.",
          );
        }
      } catch {
        setPhotoError("Could not read the image. Try a different photo.");
      } finally {
        setPhotoProcessing(false);
        // Reset so the same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onScan],
  );

  const modeTitle =
    mode === "photo"
      ? "Upload barcode photo"
      : mode === "manual"
        ? "Enter barcode"
        : "Scan barcode";

  const activeError = mode === "photo" ? photoError : error;

  return (
    <div data-slot="barcode-scanner" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text)]">{modeTitle}</h3>
        <div className="flex items-center gap-1.5">
          {mode !== "camera" && isBarcodeDetectorSupported() && (
            <button
              type="button"
              onClick={() => switchMode("camera")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Switch to camera"
            >
              <Camera className="size-3" />
              Camera
            </button>
          )}
          {mode !== "photo" && isBarcodeDetectorSupported() && (
            <button
              type="button"
              onClick={() => switchMode("photo")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Switch to photo upload"
            >
              <ImageUp className="size-3" />
              Photo
            </button>
          )}
          {mode !== "manual" && (
            <button
              type="button"
              onClick={() => switchMode("manual")}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Switch to manual entry"
            >
              <Keyboard className="size-3" />
              Type
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="inline-flex size-6 items-center justify-center rounded-md text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Close scanner"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {activeError !== null && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {activeError}
        </p>
      )}

      {/* Camera view */}
      {mode === "camera" && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="h-48 w-full object-cover"
            playsInline
            muted
            aria-label="Camera viewfinder for barcode scanning"
          />
          {/* Scan line animation */}
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-teal-400/60" />
          <p className="absolute inset-x-0 bottom-2 text-center text-[10px] text-white/60">
            Point at a barcode
          </p>
        </div>
      )}

      {/* Photo upload */}
      {mode === "photo" && (
        <div className="flex flex-col items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handlePhotoSelect(e)}
            className="hidden"
            aria-label="Choose a photo with a barcode"
          />

          {photoProcessing ? (
            <div className="flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-6 animate-spin text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)]">
                  Scanning for barcode…
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex h-32 w-full items-center justify-center rounded-xl",
                "border border-dashed border-[var(--border)] bg-[var(--surface-2)]",
                "transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]",
              )}
            >
              <div className="flex flex-col items-center gap-2">
                <ImageUp className="size-8 text-[var(--text-faint)]" />
                <p className="text-xs text-[var(--text-muted)]">
                  Choose a photo with a barcode
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Manual entry */}
      {mode === "manual" && (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleManualSubmit();
            }}
            placeholder="e.g. 5011476100098"
            className={cn(
              "flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]",
              "px-3 py-2 text-sm text-[var(--text)]",
              "placeholder:text-[var(--text-faint)]",
              "focus:border-[var(--border-strong)] focus:outline-none",
            )}
            aria-label="Barcode number"
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={(() => {
              const c = manualBarcode.trim().replace(/\D/g, "");
              return ![8, 12, 13, 14].includes(c.length) || /^(.)\1+$/.test(c);
            })()}
            className={cn(
              "rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold",
              "text-[var(--text-muted)] transition-colors",
              "hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            Look up
          </button>
        </div>
      )}
    </div>
  );
}

// ── Type declarations for BarcodeDetector API ──────────────────────────────

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(
    source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
  ): Promise<Array<{ rawValue: string }>>;
}
