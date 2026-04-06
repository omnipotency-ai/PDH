import { useCallback, useState } from "react";

export const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clamps a timestamp to a valid range: no earlier than 5 years ago, no later than tomorrow.
 * Returns the current timestamp and logs a warning if the value is out of range.
 */
export function clampTimestamp(ts: number): number {
  const now = Date.now();
  const minAllowed = now - FIVE_YEARS_MS;
  const maxAllowed = now + ONE_DAY_MS;

  if (ts < minAllowed) {
    console.warn("[usePanelTime] Timestamp is more than 5 years in the past; clamping to now.", {
      ts,
      minAllowed,
    });
    return now;
  }

  if (ts > maxAllowed) {
    console.warn("[usePanelTime] Timestamp is more than 1 day in the future; clamping to now.", {
      ts,
      maxAllowed,
    });
    return now;
  }

  return ts;
}

/**
 * Manages the time and date input state for a logging panel.
 *
 * When captureTimestamp is provided (backdating), the final timestamp uses
 * the capture date + user's entered time. When absent, uses Date.now().
 *
 * Date resolution priority: dateValue > captureTimestamp > Date.now()
 *
 * Returns native <input type="time"> and <input type="date"> compatible values.
 */
export function usePanelTime(captureTimestamp?: number) {
  const [timeValue, setTimeValue] = useState("");
  const [dateValue, setDateValue] = useState("");

  const getTimestampMs = useCallback((): number => {
    // Date basis: dateValue > captureTimestamp > Date.now()
    let base: number;
    if (dateValue) {
      const [y, mo, d] = dateValue.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
        base = new Date(y, mo - 1, d).getTime();
      } else {
        base = captureTimestamp ?? Date.now();
      }
    } else {
      base = captureTimestamp ?? Date.now();
    }

    let result: number;
    if (!timeValue) {
      result = base;
    } else {
      const [h, m] = timeValue.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) {
        result = base;
      } else {
        const d = new Date(base);
        result = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
      }
    }

    return clampTimestamp(result);
  }, [captureTimestamp, timeValue, dateValue]);

  const reset = useCallback(() => {
    setTimeValue("");
    setDateValue("");
  }, []);

  const isEdited = timeValue !== "" || dateValue !== "";

  return {
    timeValue,
    setTimeValue,
    dateValue,
    setDateValue,
    isEdited,
    getTimestampMs,
    reset,
  };
}
