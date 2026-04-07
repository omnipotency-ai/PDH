import { Label } from "@/components/ui/label";
import { getModelLabel, INSIGHT_MODEL_OPTIONS, type InsightModel } from "@/lib/aiModels";
import { APP_DATA_HEADING_CLASS, APP_DATA_SELECT_CLASS } from "./shared";

interface ArtificialIntelligenceSectionProps {
  aiEnabled: boolean;
  aiModel: InsightModel;
  onAiModelChange: (model: InsightModel) => void;
}

export function ArtificialIntelligenceSection({
  aiEnabled,
  aiModel,
  onAiModelChange,
}: ArtificialIntelligenceSectionProps) {
  return (
    <div
      data-slot="artificial-intelligence-section"
      className="space-y-3 rounded-xl border border-[var(--section-appdata-border)] bg-[var(--panel)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className={APP_DATA_HEADING_CLASS}>Artificial Intelligence</p>
        <span className="text-[11px] text-[var(--text-muted)]">
          Status:{" "}
          <span className={aiEnabled ? "text-emerald-400" : "text-amber-300"}>
            {aiEnabled ? "configured" : "not configured"}
          </span>
        </span>
      </div>

      <div className="space-y-2 rounded-lg border border-[var(--section-appdata-border)]/60 bg-[var(--surface-0)]/40 p-3">
        <p className="text-xs font-medium text-[var(--text-muted)]">OpenAI access</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {aiEnabled
            ? "This private deployment uses an app-owned OpenAI key stored in server environment variables. Nothing is stored in this browser or in your user profile."
            : "OpenAI access has not been configured for this deployment yet. Add OPENAI_API_KEY to Convex and Vercel before using AI features on your devices."}
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-[var(--text-faint)]">Insights model</Label>
        <select
          className={APP_DATA_SELECT_CLASS}
          value={aiModel}
          onChange={(event) => {
            const match = INSIGHT_MODEL_OPTIONS.find((m) => m === event.target.value);
            if (match) onAiModelChange(match);
          }}
        >
          {INSIGHT_MODEL_OPTIONS.map((model) => (
            <option key={model} value={model}>
              {getModelLabel(model)}
              {model === INSIGHT_MODEL_OPTIONS[0] ? " (recommended)" : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[var(--text-faint)]">
          Background tasks always use GPT-5.4 Mini. This setting controls Dr. Poo and insight
          reports.
        </p>
      </div>
    </div>
  );
}
