import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/sounds";

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
    playSound("goalComplete");
    setCelebration({
      encouragement: message,
      confettiActive: true,
      confettiOriginX: window.innerWidth / 2,
      confettiOriginY: window.innerHeight / 3,
    });
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCelebration(null), 2200);
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
