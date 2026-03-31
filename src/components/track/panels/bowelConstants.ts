import { ArrowDown, ArrowUp, Gauge, ShieldCheck, Zap } from "lucide-react";

/* ── Dynamic color theming per Bristol type ── */

export const BRISTOL_ACCENT: Record<number, { hex: string; border: string; glow: string }> = {
  1: {
    hex: "#f87171",
    border: "rgba(248, 113, 113, 0.35)",
    glow: "0 0 20px rgba(248, 113, 113, 0.08)",
  },
  2: {
    hex: "#fb923c",
    border: "rgba(251, 146, 60, 0.35)",
    glow: "0 0 20px rgba(251, 146, 60, 0.08)",
  },
  3: {
    hex: "#34d399",
    border: "rgba(52, 211, 153, 0.35)",
    glow: "0 0 20px rgba(52, 211, 153, 0.08)",
  },
  4: {
    hex: "#34d399",
    border: "rgba(52, 211, 153, 0.40)",
    glow: "0 0 24px rgba(52, 211, 153, 0.12)",
  },
  5: {
    hex: "#84cc16",
    border: "rgba(132, 204, 22, 0.35)",
    glow: "0 0 20px rgba(132, 204, 22, 0.08)",
  },
  6: {
    hex: "#fb923c",
    border: "rgba(251, 146, 60, 0.35)",
    glow: "0 0 20px rgba(251, 146, 60, 0.08)",
  },
  7: {
    hex: "#f87171",
    border: "rgba(248, 113, 113, 0.35)",
    glow: "0 0 20px rgba(248, 113, 113, 0.08)",
  },
};

export const SPECTRUM_POS: Record<number, number> = {
  1: 2,
  2: 16.7,
  3: 33.3,
  4: 50,
  5: 66.7,
  6: 83.3,
  7: 98,
};

/* ── Severity color ramp: green -> amber -> orange -> red ── */

type SeverityColor = { bg: string; ring: string; text: string };

const SEVERITY_GREEN: SeverityColor = {
  bg: "rgba(52, 211, 153, 0.15)",
  ring: "rgba(52, 211, 153, 0.5)",
  text: "#34d399",
};
const SEVERITY_AMBER: SeverityColor = {
  bg: "rgba(251, 191, 36, 0.15)",
  ring: "rgba(251, 191, 36, 0.5)",
  text: "#fbbf24",
};
const SEVERITY_ORANGE: SeverityColor = {
  bg: "rgba(251, 146, 60, 0.15)",
  ring: "rgba(251, 146, 60, 0.5)",
  text: "#fb923c",
};
const SEVERITY_RED: SeverityColor = {
  bg: "rgba(248, 113, 113, 0.15)",
  ring: "rgba(248, 113, 113, 0.5)",
  text: "#f87171",
};

export const SEVERITY_COLORS: Record<string, SeverityColor> = {
  // Urgency values
  low: SEVERITY_GREEN,
  medium: SEVERITY_AMBER,
  high: SEVERITY_ORANGE,
  immediate: SEVERITY_RED,
  // Effort values
  none: SEVERITY_GREEN,
  some: SEVERITY_AMBER,
  hard: SEVERITY_ORANGE,
  "urgent-release": SEVERITY_RED,
  // Volume values
  small: SEVERITY_GREEN,
  large: SEVERITY_ORANGE,
  juices: SEVERITY_RED,
};

/* ── Scale option data ── */

export const URGENCY = [
  { value: "low" as const, icon: ShieldCheck, label: "Low" },
  { value: "medium" as const, icon: Gauge, label: "Med" },
  { value: "high" as const, icon: ArrowUp, label: "High" },
  { value: "immediate" as const, icon: Zap, label: "Now!" },
];

export const EFFORT = [
  { value: "none" as const, icon: ArrowDown, label: "Easy" },
  { value: "some" as const, icon: Gauge, label: "Some" },
  { value: "hard" as const, icon: ArrowUp, label: "Hard" },
  { value: "urgent-release" as const, icon: Zap, label: "Boom" },
];

export const VOLUME = [
  { value: "small" as const, visual: "\u2022", label: "Sm" },
  { value: "medium" as const, visual: "\u2022\u2022", label: "Med" },
  { value: "large" as const, visual: "\u2022\u2022\u2022", label: "Lg" },
  { value: "juices" as const, visual: "\u2248", label: "Juice" },
];

/* ── Human-readable labels for log display ── */

export const BOWEL_LOG_LABELS = {
  urgency: Object.fromEntries(URGENCY.map((o) => [o.value, o.label])) as Record<
    (typeof URGENCY)[number]["value"],
    string
  >,
  effort: Object.fromEntries(EFFORT.map((o) => [o.value, o.label])) as Record<
    (typeof EFFORT)[number]["value"],
    string
  >,
  volume: Object.fromEntries(VOLUME.map((o) => [o.value, o.label])) as Record<
    (typeof VOLUME)[number]["value"],
    string
  >,
};
