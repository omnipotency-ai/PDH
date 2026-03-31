import type { FoodPrimaryStatus, FoodTendency } from "@/types/domain";
import { formatStatusLabel } from "./foodSafetyUtils";

interface StatusStyle {
  color: string;
  bg: string;
  border: string;
}

const STATUS_STYLE: Record<FoodPrimaryStatus, StatusStyle> = {
  safe: {
    color: "var(--section-observe)",
    bg: "var(--section-observe-muted)",
    border: "var(--section-observe-border)",
  },
  watch: {
    color: "var(--section-quick)",
    bg: "var(--section-quick-muted)",
    border: "var(--section-quick-border)",
  },
  avoid: {
    color: "var(--section-food)",
    bg: "var(--section-food-muted)",
    border: "var(--section-food-border)",
  },
  building: {
    color: "var(--section-log)",
    bg: "var(--section-log-muted)",
    border: "var(--section-log-border)",
  },
};

interface StatusBadgeProps {
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
}

export function StatusBadge({ primaryStatus, tendency }: StatusBadgeProps) {
  const { color, bg, border } = STATUS_STYLE[primaryStatus];

  return (
    <span
      data-slot="status-badge"
      className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, background: bg, borderColor: border }}
    >
      {formatStatusLabel(primaryStatus, tendency)}
    </span>
  );
}
