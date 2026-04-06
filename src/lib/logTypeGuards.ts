import type { LogDataMap, LogEntry, LogType } from "@/types/domain";

type NarrowableLog = LogEntry | { type: string; data: unknown };

/** Type guard to narrow a LogEntry by type */
export function isLogType<T extends LogType>(
  log: NarrowableLog,
  type: T,
): log is LogEntry & { type: T; data: LogDataMap[T] } {
  return log.type === type;
}

/** Type guard for food logs */
export function isFoodLog(
  log: NarrowableLog,
): log is LogEntry & { type: "food"; data: LogDataMap["food"] } {
  return log.type === "food";
}

/** Type guard for liquid logs */
export function isLiquidLog(
  log: NarrowableLog,
): log is LogEntry & { type: "liquid"; data: LogDataMap["liquid"] } {
  return log.type === "liquid";
}

/** Type guard for fluid logs */
export function isFluidLog(
  log: NarrowableLog,
): log is LogEntry & { type: "fluid"; data: LogDataMap["fluid"] } {
  return log.type === "fluid";
}

/** Type guard for digestion logs */
export function isDigestionLog(
  log: NarrowableLog,
): log is LogEntry & { type: "digestion"; data: LogDataMap["digestion"] } {
  return log.type === "digestion";
}

/** Type guard for habit logs */
export function isHabitLog(
  log: NarrowableLog,
): log is LogEntry & { type: "habit"; data: LogDataMap["habit"] } {
  return log.type === "habit";
}

/** Type guard for activity logs */
export function isActivityLog(
  log: NarrowableLog,
): log is LogEntry & { type: "activity"; data: LogDataMap["activity"] } {
  return log.type === "activity";
}

/** Type guard for weight logs */
export function isWeightLog(
  log: NarrowableLog,
): log is LogEntry & { type: "weight"; data: LogDataMap["weight"] } {
  return log.type === "weight";
}
