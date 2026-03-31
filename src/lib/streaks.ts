export interface GamificationState {
  streakCount: number;
  totalEntries: number;
  streakShieldsUsed: number; // 0 or 1 this week
  lastLogDate: string; // "YYYY-MM-DD"
  lastShieldResetWeek: string; // "YYYY-WW" week identifier
  soundEnabled: boolean;
  confettiEnabled: boolean;
  nudgesEnabled: boolean;
}

export interface SleepGoal {
  targetHours: number;
  nudgeTime: string; // "HH:mm"
  nudgeEnabled: boolean;
}

export const DEFAULT_GAMIFICATION: GamificationState = {
  streakCount: 0,
  totalEntries: 0,
  streakShieldsUsed: 0,
  lastLogDate: "",
  lastShieldResetWeek: "",
  soundEnabled: true,
  confettiEnabled: true,
  nudgesEnabled: true,
};

export const DEFAULT_SLEEP_GOAL: SleepGoal = {
  targetHours: 8,
  nudgeTime: "14:00",
  nudgeEnabled: true,
};
