import type { ReactNode, RefObject } from "react";
import { useCallback, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { ReplyInput } from "@/components/track/dr-poo/ReplyInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { getLastHalfWeekBoundary } from "@/hooks/useWeeklySummaryAutoTrigger";
import { AI_MARKDOWN_COMPONENTS } from "@/lib/aiMarkdownComponents";
import { useConversationsByDateRange, useLatestWeeklySummary } from "@/lib/sync";
import { useStore } from "@/store";

interface ConversationPanelProps {
  onSendNow?: () => void;
  replyInputRef?: RefObject<HTMLInputElement | null>;
}

const COLLAPSED_MESSAGE_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 4,
  overflow: "hidden",
};

export function ConversationPanel({ onSendNow, replyInputRef }: ConversationPanelProps) {
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(() => new Set());

  // Far-future constant so stableEndMs never goes stale across the memo lifetime.
  const STABLE_END = 9_999_999_999_999;

  const halfWeekStartMs = useMemo(() => {
    return getLastHalfWeekBoundary().getTime();
  }, []);

  const messages = useConversationsByDateRange(halfWeekStartMs, STABLE_END);
  const latestWeeklySummary = useLatestWeeklySummary();
  const { pendingReplies } = usePendingReplies();
  const aiAnalysisStatus = useStore((state) => state.aiAnalysisStatus);

  // While analysis is in flight, pending replies have been captured and are
  // being processed — suppress optimistic rendering to prevent duplication.
  const analysisInProgress = aiAnalysisStatus === "sending" || aiAnalysisStatus === "receiving";

  // Dedup optimistic messages by Convex _id — once a pending reply appears in
  // the subscription results, we no longer need to render it optimistically.
  // Using _id is more reliable than content.trim() equality which can collide
  // when the user sends identical messages.
  const confirmedMessageIds = useMemo(() => {
    const set = new Set<string>();
    for (const msg of messages ?? []) {
      set.add(String(msg._id));
    }
    return set;
  }, [messages]);

  const optimisticMessages = useMemo(
    () =>
      analysisInProgress
        ? []
        : pendingReplies
            .filter((r: { _id: unknown }) => !confirmedMessageIds.has(String(r._id)))
            .map((r: { _id: unknown; content: string; timestamp: number }) => ({
              _id: `optimistic-${r.timestamp}` as const,
              role: "user" as const,
              content: r.content,
              timestamp: r.timestamp,
              optimistic: true,
            })),
    [pendingReplies, confirmedMessageIds, analysisInProgress],
  );

  const allMessages = useMemo(
    () => [...(messages ?? []), ...optimisticMessages],
    [messages, optimisticMessages],
  );

  // Show the most recent weekly summary only if it covers a *previous* period
  // (i.e. its end timestamp is before the current half-week boundary). This
  // prevents showing an in-progress summary for the current period.
  const periodSummary =
    latestWeeklySummary && latestWeeklySummary.weekEndTimestamp <= halfWeekStartMs
      ? latestWeeklySummary
      : null;

  const hasContent = periodSummary !== null || allMessages.length > 0;

  const toggleExpandedMessage = useCallback((messageId: string) => {
    setExpandedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const periodLabel = periodSummary
    ? new Date(periodSummary.weekEndTimestamp).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div
      data-slot="conversation-panel"
      className="rounded-2xl border border-[var(--section-log)]/35 bg-[var(--surface-1)]/85 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
    >
      {/* Scrollable message area */}
      <ScrollArea data-slot="conversation-messages" className="max-h-[28rem] min-h-[6rem] pr-2">
        <div className="flex min-h-full flex-col gap-4 py-1 pb-4">
          {!hasContent && (
            <div className="flex flex-1 items-center justify-center py-6">
              <p className="text-center text-xs text-[var(--text-faint)]">
                Start a conversation with Dr. Poo
              </p>
            </div>
          )}

          {/* Period summary — pinned at top */}
          {periodSummary && (
            <ExpandableMessage
              expanded={expandedMessageIds.has(`summary-${periodSummary.weekEndTimestamp}`)}
              messageId={`summary-${periodSummary.weekEndTimestamp}`}
              onToggle={toggleExpandedMessage}
              timeLabel={`Period summary to ${periodLabel}`}
            >
              <AssistantMessage
                expanded={expandedMessageIds.has(`summary-${periodSummary.weekEndTimestamp}`)}
              >
                <Markdown components={AI_MARKDOWN_COMPONENTS}>
                  {periodSummary.weeklySummary}
                </Markdown>
              </AssistantMessage>
            </ExpandableMessage>
          )}

          {/* Messages */}
          {allMessages.map((msg) => {
            const messageId = String(msg._id);
            const expanded = expandedMessageIds.has(messageId);
            const isOptimistic = "optimistic" in msg && msg.optimistic === true;
            const isUser = msg.role === "user";
            const timeLabel = new Date(msg.timestamp).toLocaleString("en-GB", {
              weekday: "long",
              hour: "2-digit",
              minute: "2-digit",
            });

            if (isUser) {
              return (
                <ExpandableMessage
                  key={msg._id}
                  expanded={expanded}
                  messageId={messageId}
                  onToggle={toggleExpandedMessage}
                  timeLabel={timeLabel}
                  align="right"
                  optimistic={isOptimistic}
                >
                  <div
                    className="w-full rounded-2xl rounded-br-md bg-[var(--section-log)]/15 px-3 py-2 text-xs leading-relaxed text-[var(--text)]"
                    style={expanded ? undefined : COLLAPSED_MESSAGE_STYLE}
                  >
                    {msg.content}
                  </div>
                </ExpandableMessage>
              );
            }

            return (
              <ExpandableMessage
                key={msg._id}
                expanded={expanded}
                messageId={messageId}
                onToggle={toggleExpandedMessage}
                timeLabel={timeLabel}
              >
                <AssistantMessage expanded={expanded}>
                  <Markdown components={AI_MARKDOWN_COMPONENTS}>{msg.content}</Markdown>
                </AssistantMessage>
              </ExpandableMessage>
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply input — full width */}
      <div className="pt-3">
        <ReplyInput
          {...(onSendNow !== undefined && { onSendNow })}
          {...(replyInputRef !== undefined && { inputRef: replyInputRef })}
        />
      </div>
    </div>
  );
}

function ExpandableMessage({
  children,
  expanded,
  messageId,
  onToggle,
  timeLabel,
  align = "left",
  optimistic = false,
}: {
  children: ReactNode;
  expanded: boolean;
  messageId: string;
  onToggle: (messageId: string) => void;
  timeLabel: string;
  align?: "left" | "right";
  optimistic?: boolean;
}) {
  const isRightAligned = align === "right";

  return (
    <div
      className={`group flex flex-col gap-1 ${
        isRightAligned ? "items-end pl-5 pr-0" : "pl-0 pr-5"
      } ${optimistic ? "opacity-60" : ""}`}
    >
      <div className={`relative w-full ${isRightAligned ? "max-w-[92%]" : "max-w-[94%]"}`}>
        <button
          type="button"
          onClick={() => onToggle(messageId)}
          className={`absolute top-2 z-10 rounded-md border border-[var(--border)] bg-[var(--surface-1)]/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] opacity-30 transition-opacity hover:text-[var(--text)] group-hover:opacity-100 group-focus-within:opacity-100 ${
            isRightAligned ? "left-2" : "right-2"
          }`}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
        {children}
      </div>
      <span
        className={`text-[10px] text-[var(--text-faint)] ${
          isRightAligned ? "pr-1 text-right" : "pl-1 text-left"
        }`}
      >
        {timeLabel}
      </span>
    </div>
  );
}

/** Assistant message — no bubble, just markdown text on the page background */
function AssistantMessage({ children, expanded }: { children: ReactNode; expanded: boolean }) {
  return (
    <div
      className="prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed text-[var(--text)] [&_strong]:font-semibold [&_em]:text-[var(--text-muted)] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-medium [&_p]:my-1"
      style={expanded ? undefined : COLLAPSED_MESSAGE_STYLE}
    >
      {children}
    </div>
  );
}
