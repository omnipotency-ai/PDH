import type { HabitConfig } from "@/lib/habitTemplates";
import type { SyncedLog } from "@/lib/sync";
import type { DisplayWeightUnit } from "@/lib/units";
import type {
  FluidLog,
  FoodLog,
  HabitLogData,
  LogDataMap,
  LogType,
  ReproductiveLog,
  WeightLog,
} from "@/types/domain";

// Re-export HabitLogData so consumers don't need a separate import
export type { HabitLogData };

// ── Shared callback types ─────────────────────────────────────────────
/** Union of all typed log data shapes. Editors produce one of these variants. */
export type LogUpdateData = LogDataMap[LogType];

// ── Display-item types ────────────────────────────────────────────────
export type IndividualItem = {
  kind: "individual";
  log: SyncedLog;
  sortKey: number;
};
export type CounterHabitGroup = {
  kind: "counter_habit";
  groupKey: string;
  entries: SyncedLog[];
  sortKey: number;
};
export type EventHabitGroup = {
  kind: "event_habit";
  groupKey: string;
  entries: SyncedLog[];
  sortKey: number;
};
export type FluidGroup = {
  kind: "fluid";
  entries: FluidLog[];
  totalMl: number;
  sortKey: number;
};
export type FoodLogGroup = {
  kind: "food";
  entries: FoodLog[];
  sortKey: number;
};
export type ActivityGroup = {
  kind: "activity";
  groupKey: string;
  entries: SyncedLog[];
  sortKey: number;
};
export type SleepGroup = {
  kind: "sleep";
  groupKey: string;
  entries: SyncedLog[];
  sortKey: number;
};
export type WeightGroup = {
  kind: "weight";
  entries: WeightLog[];
  sortKey: number;
};
export type ReproductiveGroup = {
  kind: "reproductive";
  entries: ReproductiveLog[];
  sortKey: number;
};
export type DisplayItem =
  | IndividualItem
  | CounterHabitGroup
  | EventHabitGroup
  | FluidGroup
  | FoodLogGroup
  | SleepGroup
  | ActivityGroup
  | WeightGroup
  | ReproductiveGroup;

// ── Component prop types ──────────────────────────────────────────────
export interface TodayLogProps {
  logs: SyncedLog[];
  habits: HabitConfig[];
  weightUnit: DisplayWeightUnit;
  constrainHeight?: boolean;
  selectedDate: Date;
  dayOffset: number;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onJumpToToday: () => void;
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, data: LogUpdateData, timestamp?: number) => Promise<void>;
  /** When set, the LogEntry with this ID will auto-open in edit mode. */
  autoEditId?: string | null;
  /** Called after auto-edit is activated so the parent can clear the ID. */
  onAutoEditHandled?: () => void;
}

export interface LogEntryProps {
  log: SyncedLog;
  habits: HabitConfig[];
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, data: LogUpdateData, timestamp?: number) => Promise<void>;
}

export interface DraftItem {
  name: string;
  quantity: string;
  unit: string;
}
