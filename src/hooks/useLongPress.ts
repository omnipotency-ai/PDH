import { useCallback, useEffect, useRef } from "react";
import { LONG_PRESS_THRESHOLD_MS } from "@/lib/habitConstants";

interface UseLongPressOptions {
  onTap: () => void;
  onLongPress: () => void;
}

interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress({ onTap, onLongPress }: UseLongPressOptions): UseLongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Prevent default context menu on long press
      e.currentTarget.addEventListener(
        "contextmenu",
        (ev) => {
          ev.preventDefault();
        },
        { once: true },
      );

      didLongPressRef.current = false;
      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        timerRef.current = null;
        onLongPress();
      }, LONG_PRESS_THRESHOLD_MS);
    },
    [onLongPress],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      clearTimer();
      if (didLongPressRef.current) {
        e.preventDefault();
        return;
      }
      onTap();
    },
    [clearTimer, onTap],
  );

  const onPointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onContextMenu,
  };
}
