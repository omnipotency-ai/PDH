import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { computeTrend, type TrendData } from "./foodSafetyUtils";

interface TrendIndicatorProps {
  stat: TrendData;
}

export function TrendIndicator({ stat }: TrendIndicatorProps) {
  const trend = computeTrend(stat);
  if (trend === null) {
    return (
      <span data-slot="trend-indicator" className="text-[var(--text-faint)]">
        —
      </span>
    );
  }
  if (trend === "improving") {
    return (
      <span data-slot="trend-indicator" role="img" aria-label="Improving">
        <TrendingUp size={14} className="text-[var(--section-observe)]" />
      </span>
    );
  }
  if (trend === "worsening") {
    return (
      <span data-slot="trend-indicator" role="img" aria-label="Worsening">
        <TrendingDown size={14} className="text-[var(--section-food)]" />
      </span>
    );
  }
  return (
    <span data-slot="trend-indicator" role="img" aria-label="Stable">
      <Minus size={14} className="text-[var(--text-faint)]" />
    </span>
  );
}
