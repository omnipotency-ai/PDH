/**
 * WaterModal — centered dialog for logging water intake.
 *
 * Shows a circular progress ring (cyan/teal), current intake vs goal,
 * plus/minus amount selector (200ml increments), and Log Water button.
 *
 * Decision #4 in nutrition card decisions:
 *   - Position: centered (A)
 *   - Ring design + plus/minus + button: C (cyan/teal)
 *   - Heading + icon: D (droplet heading)
 *   - Prefill animation: A (ring fills as you adjust)
 *   - Icon in button: B (droplet beside "Log Water")
 *   - Escape to close: D
 */

import { Droplet, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

const WATER_COLOR = "#42BCB8";
const WATER_COLOR_MUTED = "rgba(66, 188, 184, 0.12)";

const RING_SIZE = 160;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const STEP_ML = 200;
const MIN_ML = 0;
const MAX_ML = 2000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface WaterModalProps {
  open: boolean;
  onClose: () => void;
  onLogWater: (amountMl: number) => void;
  currentIntakeMl: number;
  goalMl: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WaterModal({
  open,
  onClose,
  onLogWater,
  currentIntakeMl,
  goalMl,
}: WaterModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const amountRef = useRef(STEP_ML);

  // We track the selected amount in a ref + state to avoid stale closures
  // but still trigger re-renders when it changes.
  const [amount, setAmountState] = useAmountState(STEP_ML);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmountState(STEP_ML);
    }
  }, [open, setAmountState]);

  // Sync ref
  amountRef.current = amount;

  // Focus trap: focus the close button on open
  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is rendered
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus trap: keep focus inside dialog
  useEffect(() => {
    if (!open) return;

    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleFocusTrap);
    return () => window.removeEventListener("keydown", handleFocusTrap);
  }, [open]);

  const handleDecrement = useCallback(() => {
    setAmountState((prev) => Math.max(MIN_ML, prev - STEP_ML));
  }, [setAmountState]);

  const handleIncrement = useCallback(() => {
    setAmountState((prev) => Math.min(MAX_ML, prev + STEP_ML));
  }, [setAmountState]);

  const handleLogWater = useCallback(() => {
    if (amountRef.current <= 0) return;
    onLogWater(amountRef.current);
  }, [onLogWater]);

  // Click on overlay to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  // Compute ring progress: based on what the total WOULD be after logging
  const projectedTotal = currentIntakeMl + amount;
  const safeGoal = goalMl > 0 ? goalMl : 1;
  const progressFraction = Math.min(projectedTotal / safeGoal, 1);
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progressFraction);
  const percentOfGoal = Math.round((projectedTotal / safeGoal) * 100);
  const goalReached = projectedTotal >= goalMl;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: overlay click-to-close is supplementary to Escape key
    // biome-ignore lint/a11y/noStaticElementInteractions: modal overlay backdrop is not an interactive control
    <div
      data-slot="water-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        data-slot="water-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Log Water"
        className="relative mx-4 flex w-full max-w-sm flex-col items-center rounded-2xl p-6 shadow-lg"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        {/* Header */}
        <div
          data-slot="water-modal-header"
          className="mb-6 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Droplet className="h-5 w-5" style={{ color: WATER_COLOR }} />
            <h2 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>
              Log Water
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--text-muted)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Ring */}
        <div data-slot="water-modal-ring" className="relative mb-2">
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="rotate-[-90deg]"
            role="img"
            aria-label={`Water intake progress: ${projectedTotal} of ${goalMl} millilitres`}
          >
            <title>Water intake progress</title>
            {/* Background track */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={WATER_COLOR_MUTED}
              strokeWidth={RING_STROKE}
            />
            {/* Progress arc */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={WATER_COLOR}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-display text-2xl font-bold tabular-nums"
              style={{ color: "var(--text)" }}
            >
              {projectedTotal}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              / {goalMl} ml
            </span>
          </div>
        </div>

        {/* Status text */}
        <p className="mb-6 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {goalReached ? "Goal Reached!" : `${percentOfGoal}% of daily Goal`}
        </p>

        {/* Amount selector */}
        <div data-slot="water-modal-amount" className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={amount <= MIN_ML}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: WATER_COLOR,
              color: WATER_COLOR,
              background: "transparent",
            }}
            aria-label="Decrease amount"
          >
            <Minus className="h-4 w-4" />
          </button>

          <span
            className="min-w-[80px] text-center font-display text-lg font-semibold tabular-nums"
            style={{ color: "var(--text)" }}
          >
            {amount}{" "}
            <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
              ml
            </span>
          </span>

          <button
            type="button"
            onClick={handleIncrement}
            disabled={amount >= MAX_ML}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2"
            style={{
              borderColor: WATER_COLOR,
              color: WATER_COLOR,
              background: "transparent",
            }}
            aria-label="Increase amount"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom row: Cancel + Log Water */}
        <div data-slot="water-modal-actions" className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleLogWater}
            disabled={amount <= 0}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: WATER_COLOR,
              boxShadow: `0 0 12px rgba(66, 188, 184, 0.3)`,
            }}
          >
            <Droplet className="h-4 w-4" />
            Log Water
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Amount state hook ──────────────────────────────────────────────────────────

/**
 * Simple state wrapper for the water amount.
 * Extracted to keep the component body clean.
 */
function useAmountState(initial: number) {
  const [amount, setAmount] = useState(initial);
  return [amount, setAmount] as const;
}
