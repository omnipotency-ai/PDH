import { useAiPreferences } from "@/hooks/useProfile";
import { DrPooSection } from "./tracking-form";

export function PreferencesForm() {
  const { aiPreferences, setAiPreferences } = useAiPreferences();

  return (
    <div className="space-y-4">
      <DrPooSection aiPreferences={aiPreferences} setAiPreferences={setAiPreferences} />
      <p className="text-[10px] text-[var(--text-faint)]">
        Dr. Poo&apos;s name, timezone, meal schedule, and communication style live here. Food and
        drink presets are now code-defined rather than user-configured.
      </p>
    </div>
  );
}
