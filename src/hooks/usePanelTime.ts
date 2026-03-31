import { useCallback, useState } from "react";

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

    if (!timeValue) return base;
    const [h, m] = timeValue.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return base;
    const d = new Date(base);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
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
