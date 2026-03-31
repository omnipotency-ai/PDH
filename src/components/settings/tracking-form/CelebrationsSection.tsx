import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface CelebrationsSectionProps {
  gamification: {
    soundEnabled: boolean;
    confettiEnabled: boolean;
  };
  setGamificationSettings: (updates: Partial<CelebrationsSectionProps["gamification"]>) => void;
}

export function CelebrationsSection({
  gamification,
  setGamificationSettings,
}: CelebrationsSectionProps) {
  const celebrationsEnabled = gamification.soundEnabled || gamification.confettiEnabled;

  return (
    <div data-slot="celebrations-section" className="space-y-2">
      <Label
        htmlFor="celebrations-enabled"
        className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-tracking)]"
      >
        Show Celebrations
      </Label>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[9px] text-[var(--text-muted)]">
            Turn on feedback after logging. When disabled, sound and confetti options are hidden.
          </p>
        </div>
        <Switch
          id="celebrations-enabled"
          size="sm"
          checked={celebrationsEnabled}
          className="data-[checked]:bg-[var(--section-tracking)] data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-[var(--section-tracking)]"
          onCheckedChange={(checked) => {
            if (checked) {
              setGamificationSettings({
                soundEnabled: true,
                confettiEnabled: true,
              });
              return;
            }
            setGamificationSettings({
              soundEnabled: false,
              confettiEnabled: false,
            });
          }}
        />
      </div>

      {celebrationsEnabled && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] px-3 py-2">
            <Label
              htmlFor="celebrations-sound"
              className="cursor-pointer text-xs font-normal text-[var(--text-muted)]"
            >
              Sound
            </Label>
            <Checkbox
              id="celebrations-sound"
              checked={gamification.soundEnabled}
              onCheckedChange={(v) => setGamificationSettings({ soundEnabled: v === true })}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] px-3 py-2">
            <Label
              htmlFor="celebrations-confetti"
              className="cursor-pointer text-xs font-normal text-[var(--text-muted)]"
            >
              Confetti
            </Label>
            <Checkbox
              id="celebrations-confetti"
              checked={gamification.confettiEnabled}
              onCheckedChange={(v) => setGamificationSettings({ confettiEnabled: v === true })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
