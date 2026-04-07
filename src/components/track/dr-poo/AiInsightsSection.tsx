import { Loader2, Stethoscope } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisProgressOverlay } from "@/components/dr-poo/AnalysisProgressOverlay";
import { AiInsightsBody } from "@/components/track/dr-poo/AiInsightsBody";
import { ConversationPanel } from "@/components/track/dr-poo/ConversationPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useLatestSuccessfulAiAnalysis } from "@/lib/sync";
import { useStore } from "@/store";
import type { AiAnalysisStatus } from "@/types/domain";

interface AiInsightsSectionProps {
  onSendNow?: () => void;
}

export function AiInsightsSection({ onSendNow }: AiInsightsSectionProps = {}) {
  const latestSuccessfulAnalysis = useLatestSuccessfulAiAnalysis();
  const insights = latestSuccessfulAnalysis?.insight ?? null;
  const { isAiConfigured } = useAiConfig();
  const status = useStore((state) => state.aiAnalysisStatus);
  const error = useStore((state) => state.aiAnalysisError);
  const setAiAnalysisStatus = useStore((state) => state.setAiAnalysisStatus);

  const replyInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "sending" || status === "receiving";
  const canRetry = Boolean(isAiConfigured && onSendNow);

  const handleDismissError = useCallback(() => {
    setAiAnalysisStatus("idle");
  }, [setAiAnalysisStatus]);

  const handleRetry = useCallback(() => {
    setAiAnalysisStatus("idle");
    onSendNow?.();
  }, [onSendNow, setAiAnalysisStatus]);

  // Show "done" inline indicator briefly, then clear it
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    if (status === "done") {
      setShowDone(true);
      const timer = setTimeout(() => {
        setShowDone(false);
        setAiAnalysisStatus("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
    setShowDone(false);
  }, [status, setAiAnalysisStatus]);

  const showInlineProgress =
    status === "sending" || status === "receiving" || status === "error" || showDone;
  const progressStatus: AiAnalysisStatus = showDone ? "done" : status;

  return (
    <div className="space-y-3">
      {/* Dr. Poo report card — summary, suggestions, experiments, etc. */}
      <div className="glass-card glass-card-log overflow-hidden p-5">
        <SectionHeader
          icon={Stethoscope}
          title="Dr. Poo"
          color="var(--section-log)"
          mutedColor="var(--section-log-muted)"
        >
          {isLoading ? (
            <Loader2
              size={14}
              className="ml-auto animate-spin text-[var(--section-log)] opacity-60"
            />
          ) : isAiConfigured ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    replyInputRef.current?.focus({ preventScroll: true });
                  }}
                  data-slot="ask-dr-poo"
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--section-log)]/30 bg-[var(--section-log-muted)] px-3 py-1.5 text-[11px] font-semibold text-[var(--section-log)] transition-all hover:bg-[var(--section-log)]/15 active:scale-95"
                >
                  <Stethoscope size={12} />
                  Ask Dr. Poo
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[46ch] text-sm">
                Type a question for Dr. Poo in the reply box below.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </SectionHeader>

        {/* Inline progress indicator — non-blocking, within normal flow */}
        {showInlineProgress && (
          <div className="mb-3">
            <AnalysisProgressOverlay
              status={progressStatus}
              error={error}
              onDismissError={handleDismissError}
              onRetry={handleRetry}
              canRetry={canRetry}
            />
          </div>
        )}

        {isAiConfigured && (
          <div className="mb-4">
            <ConversationPanel
              {...(onSendNow !== undefined && { onSendNow })}
              replyInputRef={replyInputRef}
            />
          </div>
        )}

        {!isAiConfigured ? (
          <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
            <Stethoscope size={32} className="text-[var(--section-log)] opacity-30" />
            <p className="text-sm text-[var(--text-faint)]">
              AI is not configured for this deployment yet.
            </p>
          </div>
        ) : !insights ? (
          <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
            <Stethoscope size={32} className="text-[var(--section-log)] opacity-30" />
            <p className="text-sm text-[var(--text-faint)]">
              Log a bowel movement or send Dr. Poo a question to generate your first report.
            </p>
          </div>
        ) : (
          <AiInsightsBody insights={insights} />
        )}
      </div>
    </div>
  );
}
