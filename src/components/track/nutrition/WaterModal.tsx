/**
 * WaterModal — centered dialog for logging water intake.
 *
 * Shows a circular progress ring (cyan/teal), current intake vs goal,
 * plus/minus amount selector (200ml increments), and Log Water button.
 *
 * Uses Base UI Dialog for focus trapping, Escape to close, click-outside
 * to close, aria-modal, and return-focus-on-close.
 *
 * Decision #4 in nutrition card decisions:
 *   - Position: centered (A)
 *   - Ring design + plus/minus + button: C (cyan/teal)
 *   - Heading + icon: D (droplet heading)
 *   - Prefill animation: A (ring fills as you adjust)
 *   - Icon in button: B (droplet beside "Log Water")
 *   - Escape to close: D
 */

import { Dialog } from "@base-ui/react/dialog";
import { Droplets, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CircularProgressRing } from "./CircularProgressRing";

// ── Constants ──────────────────────────────────────────────────────────────────

const WATER_COLOR = "var(--water)";

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
  const [amount, setAmount] = useState(STEP_ML);

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmount(STEP_ML);
    }
  }, [open]);

  const handleDecrement = useCallback(() => {
    setAmount((prev) => Math.max(MIN_ML, prev - STEP_ML));
  }, []);

  const handleIncrement = useCallback(() => {
    setAmount((prev) => Math.min(MAX_ML, prev + STEP_ML));
  }, []);

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

  // Compute ring progress: based on what the total WOULD be after logging
  const projectedTotal = currentIntakeMl + amount;
  const safeGoal = goalMl > 0 ? goalMl : 1;
  // Cap at 100 so the status text never shows ">100% of daily goal"
  const percentOfGoal = Math.min(
    Math.round((projectedTotal / safeGoal) * 100),
    100,
  );
  const goalReached = projectedTotal >= goalMl;
  // #59: remaining never goes negative
  const remainingMl = Math.max(0, goalMl - currentIntakeMl);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="water-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
        />
        <Dialog.Popup
          data-slot="water-modal"
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
              <Droplets className="h-5 w-5" style={{ color: WATER_COLOR }} />
              <Dialog.Title
                className="font-display text-lg font-semibold"
                style={{ color: "var(--text)" }}
              >
                Log Water
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Progress Ring */}
          <div data-slot="water-modal-ring" className="mb-2">
            <CircularProgressRing
              value={projectedTotal}
              goal={goalMl}
              color={WATER_COLOR}
              ariaLabel={`Water intake progress: ${projectedTotal} of ${goalMl} millilitres`}
            />
          </div>

          {/* Status text */}
          <p
            className="mb-6 text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {goalReached
              ? "Goal Reached!"
              : `${remainingMl} ml remaining (${percentOfGoal}% of daily goal)`}
          </p>

          {/* Amount selector */}
          <div
            data-slot="water-modal-amount"
            className="mb-6 flex items-center gap-4"
          >
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
              <span
                className="text-sm font-normal"
                style={{ color: "var(--text-muted)" }}
              >
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

          {/* Bottom row: Log Water (centered) */}
          <div
            data-slot="water-modal-actions"
            className="flex w-full items-center justify-center"
          >
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
              <Droplets className="h-4 w-4" />
              Log Water
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
