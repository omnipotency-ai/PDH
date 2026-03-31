import { Send, Zap } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { useStore } from "@/store";

const DR_POO_REPLY_MAX_LENGTH = 2500;

interface ReplyInputProps {
  onSendNow?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function ReplyInput({ onSendNow, inputRef: externalRef }: ReplyInputProps) {
  const [text, setText] = useState("");
  const { pendingReplies, addReply } = usePendingReplies();
  const aiAnalysisStatus = useStore((state) => state.aiAnalysisStatus);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;

  // Hide pending replies while analysis is in flight — they've been captured
  // by runAnalysis and will be claimed by claimPendingReplies when it completes.
  // This prevents the same message appearing in both the pending block and the
  // conversation timeline.
  const analysisInProgress = aiAnalysisStatus === "sending" || aiAnalysisStatus === "receiving";
  const visiblePendingReplies = analysisInProgress ? [] : pendingReplies;

  const replyLength = text.length;
  const nearReplyLimit = replyLength >= Math.floor(DR_POO_REPLY_MAX_LENGTH * 0.9);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const previousText = text;
    setText("");
    inputRef.current?.focus();
    try {
      await addReply(trimmed);
    } catch (err) {
      console.error("Failed to send reply", err);
      setText(previousText);
      toast.error("Failed to send reply");
    }
  }, [text, addReply, inputRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="space-y-1.5">
      {visiblePendingReplies.length > 0 && (
        <>
          {visiblePendingReplies.map(
            (reply: { _id: string; content: string; timestamp: number }) => (
              <div
                key={reply._id}
                className="flex items-start gap-2 rounded-lg bg-[var(--section-log-muted)] px-3 py-2"
              >
                <span className="mt-0.5 shrink-0 text-[10px] font-medium text-[var(--text-faint)]">
                  {new Date(reply.timestamp).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p className="text-xs text-[var(--text-muted)]">{reply.content}</p>
              </div>
            ),
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[var(--text-faint)] italic">
              Will be included in the next report
            </p>
            {onSendNow && (
              <button
                type="button"
                onClick={onSendNow}
                className="flex items-center gap-1 text-[10px] font-semibold text-[var(--section-log)] transition-opacity hover:opacity-80"
              >
                <Zap size={10} />
                Send now
              </button>
            )}
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          maxLength={DR_POO_REPLY_MAX_LENGTH}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply to Dr. Poo..."
          aria-label="Reply to Dr. Poo"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--section-log)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]/30"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          aria-label="Send reply"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--section-log)]/30 bg-[var(--section-log-muted)] text-[var(--section-log)] transition-all hover:bg-[var(--section-log)]/15 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Send size={14} />
        </button>
      </div>
      <div className="flex justify-end pr-1">
        <span
          className={`text-[10px] tabular-nums ${
            nearReplyLimit ? "text-[var(--section-food)]" : "text-[var(--text-faint)]"
          }`}
        >
          {replyLength} / {DR_POO_REPLY_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
