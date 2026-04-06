import { useEffect, useState } from "react";

const REFRESH_MS = 60_000;

// ── Module-level shared timer ───────────────────────────────────────────────
// All hook instances subscribe to one global interval. The interval is created
// when the first subscriber mounts and cleared when the last one unmounts.

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  // Start the global interval when the first listener subscribes
  if (listeners.size === 1) {
    intervalId = setInterval(() => {
      const now = Date.now();
      for (const fn of listeners) {
        fn(now);
      }
    }, REFRESH_MS);
  }

  return () => {
    listeners.delete(listener);

    // Tear down the global interval when the last listener unsubscribes
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

/**
 * Returns a timestamp (ms) that updates every 60 seconds via a single
 * global interval shared across all component instances.
 *
 * Use this instead of per-component setInterval timers for relative-time
 * displays so only one timer runs regardless of how many rows are visible.
 */
export function useCurrentMinute(): number {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    // Immediately sync on mount in case another tick happened while unmounted
    setNow(Date.now());
    return subscribe(setNow);
  }, []);

  return now;
}
