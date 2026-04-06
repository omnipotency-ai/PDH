import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { sanitizeAiErrorForDisplay } from "@/lib/aiErrorFormatter";
import type { AiAnalysisStatus } from "@/types/domain";

const ERROR_TRUNCATE_LENGTH = 300;

interface AnalysisProgressOverlayProps {
  status: AiAnalysisStatus;
  error: string | null;
  onDismissError?: () => void;
  onRetry?: () => void;
  canRetry?: boolean;
}

/**
 * Inline (non-blocking) progress indicator for AI analysis.
 * Renders within the normal document flow rather than as a full-screen overlay.
 */
export function AnalysisProgressOverlay({
  status,
  error,
  onDismissError,
  onRetry,
  canRetry,
}: AnalysisProgressOverlayProps) {
  const [showFullError, setShowFullError] = useState(false);

  const label =
    status === "sending"
      ? "Sending logs to AI..."
      : status === "receiving"
        ? "Analysing your data..."
        : status === "done"
          ? "Analysis complete"
          : null;

  if (status === "error" && error) {
    const safeError = sanitizeAiErrorForDisplay(error);
    const isTruncated = safeError.length > ERROR_TRUNCATE_LENGTH;
    const displayedError =
      isTruncated && !showFullError ? `${safeError.slice(0, ERROR_TRUNCATE_LENGTH)}...` : safeError;

    return (
      <div
        data-slot="analysis-progress-inline"
        className="space-y-2 rounded-lg border border-[var(--section-food-border)] bg-[var(--section-food-muted)] px-3 py-2"
      >
        <p className="text-[11px] font-medium text-[var(--section-food)]">
          {displayedError}
          {isTruncated && (
            <button
              type="button"
              onClick={() => setShowFullError((prev) => !prev)}
              className="ml-1 underline"
            >
              {showFullError ? "Show less" : "Show more"}
            </button>
          )}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismissError}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-1)]"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry}
            className="rounded-md border border-[var(--section-log)]/30 bg-[var(--section-log-muted)] px-2.5 py-1 text-[10px] font-semibold text-[var(--section-log)] transition-colors hover:bg-[var(--section-log)]/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!label) return null;

  const isDone = status === "done";

  return (
    <div
      data-slot="analysis-progress-inline"
      className="flex items-center gap-2 rounded-lg border border-[var(--section-log)]/20 bg-[var(--section-log-muted)] px-3 py-2"
    >
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--section-observe)]" />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--section-log)]" />
      )}
      <span className="text-xs font-medium text-[var(--text)]">{label}</span>
      {!isDone && (
        <Send className="ml-auto h-3 w-3 shrink-0 text-[var(--section-log)] opacity-40" />
      )}
    </div>
  );
}
