/**
 * WaterModal — centered dialog for logging water intake.
 *
 * Shows a dual-segment circular progress ring:
 *   - Total fluids (bluish-green) = water + coffee + tea + all type="fluid"
 *   - Water subset (sky blue) = just water, highlighted within the fluids ring
 *   - Preview arc (faded) grows as the user adds water via +/- buttons
 *
 * Amount starts at 0. User increments in 50ml steps or types a custom value.
 * The ring animates from 0 to current on open via Framer Motion.
 *
 * Uses Base UI Dialog for focus trapping, Escape to close, click-outside
 * to close, aria-modal, and return-focus-on-close.
 */

import { Dialog } from "@base-ui/react/dialog";
import { Droplets, Minus, Plus, X } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { CircularProgressRing } from "./CircularProgressRing";

// ── Constants ────────────────────────────────────────────────────────────────

const WATER_COLOR = "var(--water)";
const FLUID_COLOR = "var(--fluid)";

const STEP_ML = 50;
const MIN_ML = 0;
const MAX_ML = 2000;

// ── Types ────────────────────────────────────────────────────────────────────

interface WaterModalProps {
  open: boolean;
  onClose: () => void;
  onLogWater: (amountMl: number) => void;
  /** Total fluid intake today (water + coffee + tea + all fluids). */
  totalFluidsMl: number;
  /** Water-only intake today (subset of totalFluidsMl). */
  waterOnlyMl: number;
  /** Daily fluid goal in ml. */
  goalMl: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WaterModal({
  open,
  onClose,
  onLogWater,
  totalFluidsMl,
  waterOnlyMl,
  goalMl,
}: WaterModalProps) {
  const [amount, setAmount] = useState(0);
  const [inputValue, setInputValue] = useState("0");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmount(0);
      setInputValue("0");
    }
  }, [open]);

  // Keep input display in sync when amount changes via +/- buttons
  const updateAmount = useCallback((next: number) => {
    const clamped = Math.max(MIN_ML, Math.min(MAX_ML, next));
    setAmount(clamped);
    setInputValue(String(clamped));
  }, []);

  const handleDecrement = useCallback(() => {
    setAmount((prev) => {
      const next = Math.max(MIN_ML, prev - STEP_ML);
      setInputValue(String(next));
      return next;
    });
  }, []);

  const handleIncrement = useCallback(() => {
    setAmount((prev) => {
      const next = Math.min(MAX_ML, prev + STEP_ML);
      setInputValue(String(next));
      return next;
    });
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      setAmount(Math.max(MIN_ML, Math.min(MAX_ML, parsed)));
    }
  }, []);

  const handleInputBlur = useCallback(() => {
    // Snap to valid value on blur
    updateAmount(amount);
  }, [amount, updateAmount]);

  const handleLogWater = useCallback(() => {
    if (amount <= 0) return;
    onLogWater(amount);
  }, [onLogWater, amount]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose],
  );

  // Ring values
  // Preview shows where water WOULD be after logging (water portion grows)
  const projectedWater = waterOnlyMl + amount;
  // Total fluids also grows by the same amount (adding water adds to total)
  const projectedFluids = totalFluidsMl + amount;
  const remainingMl = Math.max(0, goalMl - totalFluidsMl);
  const safeGoal = goalMl > 0 ? goalMl : 1;
  const fluidPercent = Math.min(Math.round((totalFluidsMl / safeGoal) * 100), 100);
  const waterPercent = Math.min(Math.round((waterOnlyMl / safeGoal) * 100), 100);
  const goalReached = totalFluidsMl >= goalMl;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="water-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        />
        <Dialog.Popup
          data-slot="water-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Log Water"
          className="fixed top-1/2 left-1/2 z-50 mx-4 flex w-full max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-2xl p-6 shadow-lg"
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
              <Droplets className="h-5 w-5" style={{ color: WATER_COLOR }} aria-hidden="true" />
              <Dialog.Title
                className="font-display text-lg font-semibold"
                style={{ color: "var(--text)" }}
              >
                Fluid Tracker
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Dual-segment Progress Ring */}
          <div data-slot="water-modal-ring" className="mb-2">
            <CircularProgressRing
              value={totalFluidsMl}
              goal={goalMl}
              color={FLUID_COLOR}
              secondaryValue={waterOnlyMl}
              secondaryColor={WATER_COLOR}
              {...(amount > 0 && { previewValue: projectedFluids })}
              {...(amount > 0 && { secondaryPreviewValue: projectedWater })}
              animateIn
              ariaLabel={`Fluid intake: ${totalFluidsMl} ml total, ${waterOnlyMl} ml water, goal ${goalMl} ml`}
            />
          </div>

          {/* Status text — fluid progress + water breakdown */}
          <Dialog.Description
            className="mb-6 text-center text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {goalReached ? (
              "Goal Reached!"
            ) : (
              <>
                {fluidPercent}% of daily fluids goal
                <br />
                <span style={{ color: WATER_COLOR }}>
                  ({waterOnlyMl} ml water - {waterPercent}% )
                </span>
              </>
            )}
          </Dialog.Description>

          {/* Amount selector — editable input with +/- buttons */}
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
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex min-w-[80px] items-baseline justify-center gap-1">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-14 bg-transparent text-center font-display text-lg font-semibold tabular-nums outline-none focus:underline"
                style={{ color: "var(--text)" }}
                aria-live="polite"
                aria-atomic="true"
                aria-label="Amount to add in millilitres"
              />
              <span className="text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                ml
              </span>
            </div>

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
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Log Water button — centered, no cancel */}
          <div data-slot="water-modal-actions" className="flex w-full items-center justify-center">
            <button
              type="button"
              onClick={handleLogWater}
              disabled={amount <= 0}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: WATER_COLOR,
                boxShadow: "0 0 12px var(--water-glow)",
              }}
            >
              <Droplets className="h-4 w-4" aria-hidden="true" />
              Log Water
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
