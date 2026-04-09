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

import { Camera, Keyboard, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

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

  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(!isBarcodeDetectorSupported());
  const [manualBarcode, setManualBarcode] = useState("");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    scanningRef.current = false;
  }, []);

  // Start camera + detection loop
  useEffect(() => {
    if (manualMode) return;

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

        // BarcodeDetector is available (checked in manualMode guard)
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
          setManualMode(true);
        }
      }
    }

    void startScanning();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [manualMode, onScan, stopStream]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const handleManualSubmit = useCallback(() => {
    const cleaned = manualBarcode.trim().replace(/\D/g, "");
    if (cleaned.length >= 8) {
      onScan(cleaned);
    }
  }, [manualBarcode, onScan]);

  return (
    <div data-slot="barcode-scanner" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text)]">
          {manualMode ? "Enter barcode" : "Scan barcode"}
        </h3>
        <div className="flex items-center gap-1.5">
          {!manualMode && (
            <button
              type="button"
              onClick={() => {
                stopStream();
                setManualMode(true);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Switch to manual entry"
            >
              <Keyboard className="size-3" />
              Type
            </button>
          )}
          {manualMode && isBarcodeDetectorSupported() && (
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                setError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              aria-label="Switch to camera"
            >
              <Camera className="size-3" />
              Camera
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

      {error !== null && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      {/* Camera view */}
      {!manualMode && (
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

      {/* Manual entry */}
      {manualMode && (
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
            disabled={manualBarcode.trim().replace(/\D/g, "").length < 8}
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
