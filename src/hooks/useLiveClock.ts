import { useEffect, useRef, useState } from "react";

/**
 * Returns an incrementing `tick` counter that advances once per minute,
 * aligned to the top of the clock minute (self-correcting to avoid drift).
 *
 * Consumers call `new Date()` themselves to derive formatted strings —
 * this hook only provides the re-render trigger.
 *
 * Usage:
 *   const tick = useLiveClock();
 *   const label = format(new Date(), "HH:mm");
 */
export function useLiveClock(): number {
  const [tick, setTick] = useState(0);
  const idRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      idRef.current = setTimeout(
        () => {
          setTick((t) => t + 1);
          schedule();
        },
        Math.max(msUntilNextMinute, 1000),
      );
    };

    schedule();

    return () => {
      if (idRef.current !== null) {
        clearTimeout(idRef.current);
      }
    };
  }, []);

  return tick;
}
