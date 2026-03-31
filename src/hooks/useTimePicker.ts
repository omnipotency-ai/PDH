import { useCallback, useState } from "react";

function currentTimeStr(): string {
  const now = new Date();
  return formatTimeStr(now);
}

function formatTimeStr(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function timestampToTimeStr(timestampMs: number): string {
  return formatTimeStr(new Date(timestampMs));
}

function toTodayTimestampMs(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

interface UseTimePickerReturn {
  /** Current displayed time string (HH:MM) */
  timeValue: string;
  /** Whether the user has manually changed the time */
  timeEdited: boolean;
  /** Update the time value directly (HH:MM string) */
  setTimeValue: (value: string) => void;
  /** Mark time as user-edited */
  markEdited: () => void;
  /** Get the timestampMs if edited, or undefined if not */
  getTimestampMs: () => number | undefined;
  /** Restore a timestamp into the picker state. */
  setTimestampMs: (timestampMs: number | null | undefined) => void;
  /** Reset time back to "now" and clear edited state */
  reset: () => void;
}

export function useTimePicker(): UseTimePickerReturn {
  const [timeValue, setTimeValueState] = useState(currentTimeStr);
  const [timeEdited, setTimeEdited] = useState(false);

  const setTimeValue = useCallback((value: string) => {
    setTimeValueState(value);
    setTimeEdited(true);
  }, []);

  const markEdited = useCallback(() => {
    setTimeEdited(true);
  }, []);

  const getTimestampMs = useCallback((): number | undefined => {
    if (!timeEdited) return undefined;
    return toTodayTimestampMs(timeValue);
  }, [timeEdited, timeValue]);

  const setTimestampMs = useCallback((timestampMs: number | null | undefined) => {
    if (typeof timestampMs !== "number") {
      setTimeValueState(currentTimeStr());
      setTimeEdited(false);
      return;
    }

    setTimeValueState(timestampToTimeStr(timestampMs));
    setTimeEdited(true);
  }, []);

  const reset = useCallback(() => {
    setTimeValueState(currentTimeStr());
    setTimeEdited(false);
  }, []);

  return {
    timeValue,
    timeEdited,
    setTimeValue,
    markEdited,
    getTimestampMs,
    setTimestampMs,
    reset,
  };
}
