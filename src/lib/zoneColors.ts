export type Zone = 1 | 2 | 3;

export const ZONE_BADGE_CLASSES: Record<Zone, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  3: "bg-[var(--section-quick-muted)] text-[var(--section-quick)]",
};

export const ZONE_BADGE_BACKGROUNDS: Record<Zone, string> = {
  1: "var(--emerald)",
  2: "var(--amber)",
  3: "var(--section-quick)",
};

export function getZoneBadgeClasses(zone: Zone): string {
  return ZONE_BADGE_CLASSES[zone];
}

export function getZoneBadgeBackground(zone: Zone): string {
  return ZONE_BADGE_BACKGROUNDS[zone];
}
