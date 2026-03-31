import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AiBadgeProps {
  type: "safe" | "watch" | "trial_next" | "avoid";
}

const PALETTE: Record<
  AiBadgeProps["type"],
  { color: string; bg: string; border: string; label: string }
> = {
  safe: {
    color: "var(--section-observe)",
    bg: "var(--section-observe-muted)",
    border: "var(--section-observe-border)",
    label: "AI: Likely Safe",
  },
  watch: {
    color: "var(--section-quick)",
    bg: "var(--section-quick-muted)",
    border: "var(--section-quick-border)",
    label: "AI: Watch / Mixed",
  },
  trial_next: {
    color: "var(--section-meals)",
    bg: "var(--section-meals-muted)",
    border: "var(--section-meals-border)",
    label: "AI: Next To Try",
  },
  avoid: {
    color: "var(--section-food)",
    bg: "var(--section-food-muted)",
    border: "var(--section-food-border)",
    label: "AI: Avoid / Strong Suspect",
  },
};

export function AiBadge({ type }: AiBadgeProps) {
  const palette = PALETTE[type];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-slot="ai-badge"
          className="inline-flex shrink-0 items-center rounded border px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide"
          style={{
            color: palette.color,
            background: palette.bg,
            borderColor: palette.border,
          }}
        >
          AI
        </span>
      </TooltipTrigger>
      <TooltipContent>{palette.label}</TooltipContent>
    </Tooltip>
  );
}
