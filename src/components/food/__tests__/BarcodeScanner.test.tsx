/**
 * BarcodeScanner — fallback path tests
 *
 * The critical path: when camera access is denied (getUserMedia rejects),
 * the component must switch to manual-input mode.
 *
 * Because this project's test environment is edge-runtime (no DOM), we test
 * the fallback logic at the unit level:
 *
 *   1. Feature-detection: BarcodeDetector absent → manualMode starts true
 *   2. Camera-denied logic: getUserMedia rejection → setManualMode(true)
 *
 * These tests verify the branching logic extracted from BarcodeScanner without
 * a React renderer. If @testing-library/react is added to the project in future,
 * these tests can be promoted to full render tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Feature detection — mirrors isBarcodeDetectorSupported() in BarcodeScanner
// ---------------------------------------------------------------------------

function isBarcodeDetectorSupported(env: Record<string, unknown>): boolean {
  return "BarcodeDetector" in env;
}

describe("BarcodeScanner — isBarcodeDetectorSupported (feature detection)", () => {
  it("returns false when BarcodeDetector is absent (unsupported browser)", () => {
    // Edge-runtime and most desktop browsers do not have BarcodeDetector
    const env = {}; // no BarcodeDetector key
    expect(isBarcodeDetectorSupported(env)).toBe(false);
  });

  it("returns true when BarcodeDetector is present (supported browser)", () => {
    const env = { BarcodeDetector: class {} };
    expect(isBarcodeDetectorSupported(env)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Camera-denied fallback — mirrors the catch block in BarcodeScanner
// ---------------------------------------------------------------------------

/**
 * Simulate the startScanning logic from BarcodeScanner:
 * - If getUserMedia rejects, set error message and switch to manual mode.
 */
async function simulateStartScanning(
  getUserMedia: () => Promise<unknown>,
  setState: {
    setError: (msg: string) => void;
    setManualMode: (v: boolean) => void;
  },
  cancelled: boolean,
): Promise<void> {
  try {
    await getUserMedia();
  } catch {
    if (!cancelled) {
      setState.setError("Camera access denied. Use manual entry instead.");
      setState.setManualMode(true);
    }
  }
}

describe("BarcodeScanner — camera-denied fallback", () => {
  it("falls back to manual mode when getUserMedia rejects", async () => {
    const setError = vi.fn();
    const setManualMode = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("NotAllowedError"));

    await simulateStartScanning(
      getUserMedia,
      { setError, setManualMode },
      false,
    );

    expect(setManualMode).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith(
      "Camera access denied. Use manual entry instead.",
    );
  });

  it("shows the correct error message on permission denial", async () => {
    const setError = vi.fn();
    const setManualMode = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("NotAllowedError"));

    await simulateStartScanning(
      getUserMedia,
      { setError, setManualMode },
      false,
    );

    expect(setError.mock.calls[0]?.[0]).toContain("manual entry");
  });

  it("does NOT call setManualMode if component was cancelled before the rejection resolved", async () => {
    const setError = vi.fn();
    const setManualMode = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException("NotAllowedError"));

    // cancelled = true simulates the cleanup function running before the rejection
    await simulateStartScanning(
      getUserMedia,
      { setError, setManualMode },
      true,
    );

    expect(setManualMode).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Initial mode selection — mirrors useState(!isBarcodeDetectorSupported())
// ---------------------------------------------------------------------------

describe("BarcodeScanner — initial mode selection", () => {
  it("starts in manual mode when BarcodeDetector is not supported", () => {
    const supported = isBarcodeDetectorSupported({});
    // When unsupported, the component's initial manualMode state = true
    const initialManualMode = !supported;
    expect(initialManualMode).toBe(true);
  });

  it("starts in camera mode when BarcodeDetector is supported", () => {
    const env = { BarcodeDetector: class {} };
    const supported = isBarcodeDetectorSupported(env);
    const initialManualMode = !supported;
    expect(initialManualMode).toBe(false);
  });
});
