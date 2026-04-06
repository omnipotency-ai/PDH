import { BookOpen, BrainCircuit, Check, Copy, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { type RefObject, useCallback, useRef, useState } from "react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { MealIdeaCard } from "@/components/archive/ai-insights/MealIdeaCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getAiDisclaimer } from "@/lib/aiAnalysis";
import { AI_MARKDOWN_COMPONENTS } from "@/lib/aiMarkdownComponents";
import type { AiNutritionistInsight } from "@/types/domain";

/** Copy the plain text content of a container element to the clipboard. */
async function copyPlainText(el: HTMLElement) {
  const blob = new Blob([el.innerText], { type: "text/plain" });
  await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}

export function CopyReportButton({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      await copyPlainText(containerRef.current);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy report", err);
      toast.error("Failed to copy report");
    }
  }, [containerRef]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 text-[11px] text-[var(--section-log)] hover:underline"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "copied!" : "copy report"}
    </button>
  );
}

function confidenceBadgeTone(confidence: "high" | "medium" | "low"): string {
  if (confidence === "high")
    return "text-[var(--section-food)] bg-[var(--section-food-muted)] border-[var(--section-food-border)]";
  if (confidence === "medium")
    return "text-[var(--section-quick)] bg-[var(--section-quick-muted)] border-[var(--section-quick-border)]";
  return "text-[var(--text-muted)] bg-[var(--surface-3)] border-[var(--border)]";
}

/**
 * Report details: culprits, meals, educational insight, suggestions, disclaimer.
 * Used by Track page inside a collapsible, and by DrPooFullReport on the Archive page.
 *
 * Section order:
 *   0. Clinical reasoning (collapsible "Dr. Poo's analysis")
 *   1. Suspected culprits
 *   2. Meal ideas (prominent, expanded by default — most actionable section)
 *   3. Did you know (educational insight)
 *   4. Suggestions
 *   5. Disclaimer
 */
export function DrPooReportDetails({ insights }: { insights: AiNutritionistInsight }) {
  const hasMealPlan = insights.mealPlan.length > 0;

  return (
    <div className="space-y-4">
      {/* 0. Clinical Reasoning — collapsible "Dr. Poo's analysis" */}
      {insights.clinicalReasoning && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <BrainCircuit size={12} />
              <span>Dr. Poo's analysis</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="prose-sm mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-muted)] [&_em]:text-[var(--text-faint)] [&_strong]:text-[var(--text)]">
              <Markdown components={AI_MARKDOWN_COMPONENTS}>{insights.clinicalReasoning}</Markdown>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 1. Suspected Culprits — FAQ accordion */}
      {insights.suspectedCulprits.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <TriangleAlert size={12} className="text-[var(--section-food)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--section-food)]">
              Suspected Culprits
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-1">
            {insights.suspectedCulprits.map((item) => (
              <AccordionItem
                key={item.food}
                value={item.food}
                className="glass-card overflow-hidden rounded-xl border-0"
              >
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-[var(--text-faint)]">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-[var(--text)]">
                      {item.food}
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeTone(item.confidence)}`}
                    >
                      {item.confidence}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="prose-sm text-xs text-[var(--text-muted)] [&_strong]:text-[var(--text)] [&_em]:text-[var(--text-faint)]">
                    <Markdown components={AI_MARKDOWN_COMPONENTS}>{item.reasoning}</Markdown>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* 2. Meal Ideas — blog-style cards, vertical stack on mobile, grid on desktop */}
      {hasMealPlan && (
        <div>
          <div className="mb-3 flex items-center gap-1.5">
            <UtensilsCrossed size={12} className="text-[var(--section-food)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--section-food)]">
              Meal Ideas
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.mealPlan.map((meal) => (
              <MealIdeaCard key={meal.meal} meal={meal} />
            ))}
          </div>
        </div>
      )}

      {/* 3. Educational Insight (Did You Know?) */}
      {insights.educationalInsight && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <BookOpen size={12} className="text-[var(--section-observe)]" />
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--section-observe)]">
              Did You Know?
            </p>
          </div>
          <div className="glass-card rounded-xl px-3 py-2.5">
            <p className="font-display text-sm font-semibold text-[var(--text)]">
              {insights.educationalInsight.topic}
            </p>
            <div className="prose-sm mt-1 text-xs text-[var(--text-muted)] [&_strong]:text-[var(--text)] [&_em]:text-[var(--text-faint)]">
              <Markdown components={AI_MARKDOWN_COMPONENTS}>
                {insights.educationalInsight.fact}
              </Markdown>
            </div>
          </div>
        </div>
      )}

      {/* 5. Suggestions */}
      {insights.suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--section-habits)]">
            Suggestions
          </p>
          <div className="prose-sm space-y-1 text-xs text-[var(--text-muted)] [&_strong]:text-[var(--text)] [&_em]:text-[var(--text-faint)]">
            {insights.suggestions.map((suggestion) => (
              <div key={suggestion}>
                <Markdown components={AI_MARKDOWN_COMPONENTS}>{suggestion}</Markdown>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Disclaimer */}
      <p className="border-t border-[var(--border)] pt-3 text-[10px] leading-relaxed text-[var(--text-faint)] italic">
        {getAiDisclaimer()}
      </p>
    </div>
  );
}

/**
 * Full Dr. Poo report with summary + details.
 * Used by the Archive page where everything is always visible.
 */
export function DrPooFullReport({ insights }: { insights: AiNutritionistInsight }) {
  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CopyReportButton containerRef={reportRef} />
      </div>
      <div ref={reportRef} className="space-y-4">
        {/* Direct response to user */}
        {insights.directResponseToUser && (
          <div className="rounded-xl border border-[var(--section-log-border)] bg-[var(--section-log-muted)] px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--section-log)]">
              In reply to you
            </p>
            <div className="prose-sm text-sm text-[var(--text)] [&_em]:text-[var(--text-muted)] [&_strong]:font-semibold">
              <Markdown components={AI_MARKDOWN_COMPONENTS}>
                {insights.directResponseToUser}
              </Markdown>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="prose-sm text-sm text-[var(--text)] [&_em]:text-[var(--text-muted)] [&_strong]:font-semibold">
          <Markdown components={AI_MARKDOWN_COMPONENTS}>{insights.summary}</Markdown>
        </div>

        <DrPooReportDetails insights={insights} />
      </div>
    </div>
  );
}
