import type { LucideIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SectionColor = "health" | "repro" | "tracking" | "appdata" | "preferences";

const colorMap: Record<SectionColor, { accent: string; muted: string; border: string }> = {
  health: {
    accent: "var(--section-health)",
    muted: "var(--section-health-muted)",
    border: "var(--section-health-border)",
  },
  repro: {
    accent: "var(--section-repro)",
    muted: "var(--section-repro-muted)",
    border: "var(--section-repro-border)",
  },
  tracking: {
    accent: "var(--section-tracking)",
    muted: "var(--section-tracking-muted)",
    border: "var(--section-tracking-border)",
  },
  appdata: {
    accent: "var(--section-appdata)",
    muted: "var(--section-appdata-muted)",
    border: "var(--section-appdata-border)",
  },
  preferences: {
    accent: "var(--section-preferences)",
    muted: "var(--section-preferences-muted)",
    border: "var(--section-preferences-border)",
  },
};

interface SettingsTileProps {
  color: SectionColor;
  icon: LucideIcon;
  title: string;
  summary: string;
  className?: string;
}

export const SettingsTile = forwardRef<HTMLButtonElement, SettingsTileProps>(
  ({ color, icon: Icon, title, summary, className, ...props }, ref) => {
    const colors = colorMap[color];
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "settings-tile flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left",
          className,
        )}
        style={{
          borderColor: colors.border,
          background: `linear-gradient(140deg, ${colors.muted}, transparent 60%)`,
        }}
        {...props}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.muted }}
          >
            <Icon className="h-4 w-4" style={{ color: colors.accent }} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-[var(--text)]">{title}</span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {summary}
        </p>
      </button>
    );
  },
);

SettingsTile.displayName = "SettingsTile";
