# Fix Status: Dr. Poo / AI Markdown Audit Fixes

**Date:** 2026-03-28
**Scope:** DrPoo components, AI markdown rendering, clipboard, error handling

## HIGH Fixes

| Fix | Status | File(s) |
|-----|--------|---------|
| Extract shared `AI_MARKDOWN_COMPONENTS` | DONE | `src/lib/aiMarkdownComponents.ts` (new), `ConversationPanel.tsx`, `DrPooReport.tsx`, `MealIdeaCard.tsx` |
| Block `<img>` tags in markdown | DONE | `src/lib/aiMarkdownComponents.ts` — `img: () => null` |
| DrPooReport: innerHTML -> innerText | DONE | `DrPooReport.tsx` — `copyPlainText()` uses `el.innerText`, drops `text/html` format |
| DrPooReport: CopyReportButton error handling | DONE | `DrPooReport.tsx` — try/catch with `toast.error("Failed to copy report")` |

## MODERATE Fixes

| Fix | Status | File(s) |
|-----|--------|---------|
| ConversationPanel: stableEndMs goes stale | DONE | `ConversationPanel.tsx` — replaced with `STABLE_END = 9_999_999_999_999` constant |
| ConversationPanel: optimistic dedup by _id | DONE | `ConversationPanel.tsx` — `confirmedMessageIds` Set of `msg._id` strings, not content.trim() |
| ConversationPanel: periodSummary condition documented | DONE | `ConversationPanel.tsx` — added comment explaining "show previous period only" intent |
| ReplyInput: mutation failure handling | DONE | `ReplyInput.tsx` — await addReply, restore text + toast.error on failure |
| ReplyInput: Send button aria-label | DONE | `ReplyInput.tsx` — `aria-label="Send reply"` |
| AnalysisProgressOverlay: error truncation | DONE | `AnalysisProgressOverlay.tsx` — increased to 300 chars, added "Show more/less" toggle |
| ConversationPanel: expand button visibility | DONE | `ConversationPanel.tsx` — `opacity-0` -> `opacity-30` at rest |
| MealIdeaCard: extractFoodTags length guard | DONE | `MealIdeaCard.tsx` — `items.slice(0, 20)` before joining |
| DrPooReport: nextFoodToTry null guard | DONE | `DrPooReport.tsx` — wrapped in `{insights.nextFoodToTry && (...)}` |

## Typecheck

Pre-existing errors remain in files outside scope (convex tests, settings form, hooks).
No new errors introduced by these changes. The implicit `any` errors on `pendingReplies` callbacks (ConversationPanel line 60/61, ReplyInput line 61) are pre-existing from Convex query type inference.

## Files Changed

- `src/lib/aiMarkdownComponents.ts` (NEW)
- `src/components/track/dr-poo/ConversationPanel.tsx`
- `src/components/track/dr-poo/ReplyInput.tsx`
- `src/components/archive/DrPooReport.tsx`
- `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx`
- `src/components/archive/ai-insights/MealIdeaCard.tsx`

## Files NOT Changed (no fixes needed)

- `src/components/track/dr-poo/AiInsightsBody.tsx`
- `src/components/track/dr-poo/AiInsightsSection.tsx`
- `src/components/archive/ai-insights/index.ts`
