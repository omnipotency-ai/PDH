import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/sounds";

// Sound and confetti are always enabled — preferences were removed with the
// gamification schema field. Re-introduce user-level settings if needed.
const SOUND_ENABLED = true;
const CONFETTI_ENABLED = true;

interface CelebrationEvent {
  encouragement: string;
  confettiActive: boolean;
  confettiOriginX: number;
  confettiOriginY: number;
}

export function useCelebration() {
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear the timeout on unmount to avoid state updates after unmount.
  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Brief visual confirmation only — no confetti, no sound.
  const celebrateLog = useCallback(() => {
    toast.success("Logged!");
  }, []);

  const celebrateGoalComplete = useCallback((message: string) => {
    if (SOUND_ENABLED) {
      playSound("goalComplete");
    }
    if (CONFETTI_ENABLED) {
      setCelebration({
        encouragement: message,
        confettiActive: true,
        confettiOriginX: window.innerWidth / 2,
        confettiOriginY: window.innerHeight / 3,
      });
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCelebration(null), 2200);
    } else {
      toast.success(message);
    }
  }, []);

  const clearCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return {
    celebration,
    celebrateLog,
    celebrateGoalComplete,
    clearCelebration,
  };
}
