import type { FoodStatus } from "@/data/transitData";

export const MAP_BACKGROUND =
  "radial-gradient(circle at top left, color-mix(in srgb, var(--indigo) 22%, transparent) 0%, transparent 24%), radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--teal) 18%, transparent) 0%, transparent 20%), radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--section-summary) 14%, transparent) 0%, transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 86%, black 14%) 0%, color-mix(in srgb, var(--surface-0) 92%, black 8%) 100%)";

export const ZONE_SURFACES = [
  {
    fill: "rgba(110, 231, 183, 0.08)",
    stroke: "rgba(110, 231, 183, 0.2)",
    label: "#86efac",
  },
  {
    fill: "rgba(96, 165, 250, 0.08)",
    stroke: "rgba(96, 165, 250, 0.2)",
    label: "#7dd3fc",
  },
  {
    fill: "rgba(244, 114, 182, 0.08)",
    stroke: "rgba(244, 114, 182, 0.2)",
    label: "#f9a8d4",
  },
] as const;

export const STATUS_ORDER: FoodStatus[] = ["safe", "testing", "watch", "avoid", "untested"];
export const STATION_RADIUS = 29;
export const TRACK_SHADOW_STROKE = 18;
export const TRACK_COLOR_STROKE = 10;
export const SVG_VIEWBOX = { width: 1400, height: 860 } as const;
export const INTERCHANGE_A = { x: 330, y: 430 } as const;
export const INTERCHANGE_B = { x: 814, y: 430 } as const;
export const ZONE_CARDS = {
  one: { x: 52, y: 116, width: 300, height: 592 },
  two: { x: 372, y: 184, width: 418, height: 492 },
  three: { x: 836, y: 98, width: 516, height: 650 },
} as const;
