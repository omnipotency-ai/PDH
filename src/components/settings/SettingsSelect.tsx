import { cn } from "@/lib/utils";

const BASE_SELECT_CLASS =
  "h-9 w-full rounded-xl border bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]";

type SettingsSection = "health" | "repro" | "appdata";

const BORDER_CLASS: Record<SettingsSection, string> = {
  health: "border-[var(--section-health-border)]",
  repro: "border-[var(--section-repro-border)]",
  appdata: "border-[var(--section-appdata-border)]",
};

interface SettingsSelectProps extends React.ComponentPropsWithRef<"select"> {
  /** Which settings section this select belongs to, determines border color. */
  section: SettingsSection;
}

/**
 * A styled `<select>` for settings forms.
 * Applies shared select styling with section-appropriate border color.
 */
export function SettingsSelect({ section, className, ...props }: SettingsSelectProps) {
  return (
    <select
      data-slot="settings-select"
      className={cn(BASE_SELECT_CLASS, BORDER_CLASS[section], className)}
      {...props}
    />
  );
}
