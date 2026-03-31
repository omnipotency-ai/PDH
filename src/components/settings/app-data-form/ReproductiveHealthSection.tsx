import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { APP_DATA_HEADING_CLASS } from "./shared";

interface ReproductiveHealthSectionProps {
  reproEnabled: boolean;
  onToggleReproTracking: (checked: boolean) => void;
}

export function ReproductiveHealthSection({
  reproEnabled,
  onToggleReproTracking,
}: ReproductiveHealthSectionProps) {
  // Feature-gated: reproductive health is out of v1 scope (ADR-0008)
  if (!FEATURE_FLAGS.reproductiveHealth) return null;
  const reproToggleActionLabel = reproEnabled
    ? "Hide Reproductive Health Module"
    : "Un-hide Reproductive Health Module";

  return (
    <div data-slot="reproductive-health-section" className="space-y-3">
      <p className={APP_DATA_HEADING_CLASS}>Reproductive Health</p>

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="repro-toggle-appdata" className="text-sm text-[var(--text)]">
            {reproToggleActionLabel}
          </Label>
          <p className="text-[11px] text-[var(--text-muted)]">
            Shows cycle, pregnancy, menopause, and hormone settings when active.
          </p>
        </div>
        <Switch
          size="sm"
          id="repro-toggle-appdata"
          checked={reproEnabled}
          onCheckedChange={onToggleReproTracking}
          className="data-[checked]:bg-violet-500 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-violet-500"
        />
      </div>
    </div>
  );
}
