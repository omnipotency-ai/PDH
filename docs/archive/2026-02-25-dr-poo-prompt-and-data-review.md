# Dr. Poo Prompt & Data Pipeline Review

**Date:** 2026-02-25
**Context:** Mid-brainstorming session reviewing what gets sent to Dr. Poo on every "Ask Dr. Poo" call, and identifying what needs fixing.

## Current State (what gets sent today)

1. **System prompt** — Dr. Poo character, clinical reasoning rules, output format
2. **Conversation history** — last 20 messages (user replies + Dr. Poo summaries), NOT filtered by week
3. **User message payload (JSON)** containing:
   - `currentTime`, `daysPostOp`
   - `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `activityLogs` — all from last 72 hours
   - `patientMessages` — queued replies not yet sent
   - `previousSuggestionsStillInEffect` — ALL suggestions from ALL reports ever, deduped
   - `foodTrialDatabase` — last 50 foods Dr. Poo has assessed (from foodTrialSummary table)
   - `weeklyTrends` — last 4 weeks of mechanical aggregates (from weeklyDigest table)
   - `previousWeekRecap` — NEW, the AI-generated weekly conversation summary
   - `reproductiveHealthContext` — cycle/hormonal data if tracking enabled

## Issues Identified (7 areas)

### 1. Hardwired patient data in system prompt

**Problem:** The system prompt includes the surgery date as a static string (e.g., "Surgery: Ileostomy reversal on 2026-02-13"). This is hardwired and user-specific. `daysPostOp` is then calculated fresh in the user message payload from the health profile, making the surgery date in the system prompt partially redundant.

**Action needed:** Review what patient-specific data belongs in the system prompt vs. the user message. The system prompt should contain Dr. Poo's character/rules. Patient-specific data should come from the health profile dynamically in the user message. Remove hardwired patient data from the system prompt.

---

### 2. Logs: 72-hour window vs. diff vs. weekly window

**Problem:** Every call sends the last 72 hours of ALL logs (food, bowel, fluid, habit, activity). This is not a diff — it's the full 72 hours every time. If you ask Dr. Poo twice in one hour, he gets almost identical log data both times.

**User's preferred approach:** Send all logs from the **current week** (Sunday 18:00 to now) instead of last 72 hours. This way:

- Dr. Poo sees the full week's context on every call
- He can spot patterns across the week
- No redundancy concern because it's always the current week's complete picture

**Also needed:** For weeks prior to the current week, Dr. Poo should receive **weekly summaries of logs** (not raw logs). These summaries would be richer than the current weeklyDigest — they should include:

- Cigarettes: total count, daily average
- Fluids: total ml, daily average
- Meals: count, foods eaten
- Bowel movements: count, Bristol distribution (how many 4s, 5s, 6s, 7s)
- Episodes count
- Pills/medication: daily adherence
- Hygiene: days showered vs not
- Substance use: daily average
- Activity: walks, sleep

**Action needed:** Change the log context window from 72 hours to current week (Sunday 18:00 to now). Create richer weekly log summaries for prior weeks. Feed prior week summaries instead of raw prior-week logs.

---

### 3. Patient messages storage

**Current behaviour:** When the user types a message in the reply box:

1. It's stored in Zustand (`drPooReplies`) as a pending queue
2. It's also persisted to the Convex `conversations` table immediately (fire-and-forget)
3. When Dr. Poo is asked, the pending replies go into the `patientMessages` field in the payload
4. After the report comes back, the queue is cleared

**Confirmed:** Patient messages ARE being stored in the conversations table. They persist. The Zustand queue is just the "pending" state before the next analysis.

**No action needed** on storage — this is working correctly.

---

### 4. Previous suggestions: scoping and rules

**Problem:** Currently sends ALL suggestions from ALL reports ever, deduped, with the instruction "do not re-suggest anything on this list." This is wrong because:

- Context changes week to week. If the user had diarrhea on Wednesday and Dr. Poo suggested bananas, and then the user has diarrhea again on Friday, Dr. Poo should absolutely be able to suggest bananas again.
- Suggestions without timestamps and without the context of what triggered them are meaningless.

**User's preferred approach:**

- Scope suggestions to the **current week** (Sunday 18:00 to now), or last 2-3 days
- Each suggestion should carry a timestamp and context (what log/event triggered it)
- Remove the hard rule "do not suggest anything on this list"
- Instead, the suggestions serve as context: "here's what you've already suggested this week" — Dr. Poo can choose to repeat if the situation warrants it

**Action needed:** Change the suggestions query to filter by current week (or last 2-3 days). Include timestamps with each suggestion. Remove the "do not re-suggest" rule from the system prompt. Reframe the instruction as "here are your recent suggestions for context."

---

### 5. Food Trial Database: dual systems

**Problem:** There are currently TWO food ranking systems running side by side:

**System A — Deterministic (observation window):**

- User logs food → food enters the observation window → bowel movement occurs → foods in the transit window are assessed algorithmically
- Based on timing and Bristol score, foods get marked as safe/culprit/watch
- This is in `src/lib/analysis.ts` → `analyzeLogs()`

**System B — Dr. Poo's assessments (AI-based):**

- Dr. Poo reads the logs and makes clinical judgements about food safety
- His verdicts are extracted from reports and stored in `foodAssessments` table
- These are aggregated into `foodTrialSummary` table (Layer 3)
- This is what gets sent back to Dr. Poo as `foodTrialDatabase`

**User's intent:** These should be complementary, not competing. Dr. Poo should be the authority. The deterministic system provides a baseline. Where they disagree, Dr. Poo's clinical reasoning should win. Eventually, the app should use Dr. Poo's verdicts for the UI food safety display, with the deterministic system as a validation/sanity check.

**Action needed (exploration required):**

- Document exactly how each system works and where results diverge
- Decide: does the UI show deterministic results, Dr. Poo results, or a blend?
- Consider: should the deterministic system feed INTO Dr. Poo as structured input rather than running independently?
- The food trial database sent to Dr. Poo currently only has his own assessments — should it also include the deterministic system's assessments for comparison?

---

### 6. Food data: grouping, merging, and deduction

**Problem:** Foods are logged in many variations that are essentially the same thing:

- "rice", "rice soup", "salty rice soup", "salty rice soup with noodles" — these are all rice
- Rice has 22 green ticks. It will never be a culprit. But each variation is tracked separately.

**Also:** The deterministic system lacks deductive reasoning. If rice has 17 safe trials and then appears alongside a new food in 2 diarrhea events, the system might flag rice. But obviously the new food is the culprit, not the food with 17 clean trials. Basic deduction: a food with a long safe history should not be flagged based on co-occurrence with untested foods.

**Action needed:**

- Historical migration: group/merge food variants into canonical entries (e.g., all rice variants → "rice")
- The food library (`foodLibrary` table) already has `canonicalName` — this infrastructure exists but may not be fully used for assessment grouping
- Implement deductive logic in the deterministic assessment: foods with N+ safe trials should be resistant to being flagged by co-occurrence. New/untested foods should be suspected first.
- Consider whether this deduction belongs in the deterministic system, in Dr. Poo's prompt, or both

---

### 7. Token optimisation and context architecture

**Estimated current tokens per call:** ~10,000-15,000 input + ~1,000 output

**Optimisation opportunities identified:**

- Filter conversation history to current week only (instead of last 20 from all time) — covered by weekly summary carrying forward older context
- Change log window from 72 hours to current week
- Scope suggestions to current week or last 2-3 days
- Use weekly summaries for prior weeks instead of raw data
- Only send food trials that have changed since last report, PLUS a compact list of all already-assessed foods and their current status

**Note:** The weekly summary infrastructure (Layer 5) already helps here — prior weeks' conversations are compressed into ~400 tokens instead of raw message history.

---

## Diagram Request

**User requested:** A flowchart/diagram showing:

- Where each piece of information comes from (which table, which calculation)
- Who impacts it (user input, algorithm, LLM call, scheduled computation)
- How it flows into the Dr. Poo prompt
- Covering: logs, conversations, suggestions, food trial database, food trial summary, weekly digest, weekly summary

**Action needed:** Create this diagram in a future session.

---

## What Was Built This Session (Layer 5 — Weekly Summaries)

### Infrastructure completed:

- `convex/schema.ts` — `weeklySummaries` table
- `convex/weeklySummaries.ts` — add (upsert), getLatest, getByWeek, listAll
- `convex/conversations.ts` — `listByDateRange` query
- `convex/reportSuggestions.ts` — `listByDateRange` query
- `src/lib/sync.ts` — hooks: useLatestWeeklySummary, useWeeklySummaryByWeek, useAddWeeklySummary, useConversationsByDateRange, useSuggestionsByDateRange
- `src/lib/aiAnalysis.ts` — `fetchWeeklySummary()`, `PreviousWeeklySummary` interface, `previousWeekRecap` injected into user message
- `src/hooks/useWeeklySummaryAutoTrigger.ts` — auto-fires when Sunday 18:00 boundary passes
- `src/hooks/useAiInsights.ts` — feeds latestWeeklySummary into Dr. Poo's enhanced context

### Design decisions made:

- AI-generated narrative wins over mechanical summary for "previously on..."
- Week boundary: Sunday 18:00 → following Sunday 17:59
- Auto-trigger: client-side, fires when app is open after boundary passes
- Redundancy: conversations backed up to localStorage before API call
- Summary dual purpose: displayed to user AND sent to Dr. Poo
- Prompt sends: conversation messages + suggestions + bowel notes (no mechanical data — "don't lead the witness")

### Still to do:

- System prompt update: tell Dr. Poo what to do with `previousWeekRecap`
- Conversation UI redesign (scrollable view, input row, weekly filtering)
- Seed first summary for current period (click test button or re-generate)

---

## Priority Order for Next Sessions

1. ~~**System prompt update**~~ — ✅ DONE (2026-02-25 session 2): Added previousWeekRecap instructions, conversation awareness, softened repeat rules
2. ~~**Log window change**~~ — ✅ DONE: Kept at 72 hours (user decision). Conversation window changed to half-week (Sun/Wed 21:00 boundaries).
3. ~~**Suggestions scoping**~~ — ✅ DONE: Last 7 days with counts per suggestion. `recentSuggestionHistory` replaces `previousSuggestionsStillInEffect`. Prompt rewritten from "NEVER re-issue" to count-aware calibration.
4. **Richer weekly log summaries** — for prior weeks, replacing raw log data
5. **Food data grouping/migration** — canonical name merging, deductive logic
6. **Dual food system resolution** — how deterministic and AI systems relate
7. **Data flow diagram** — visual map of the whole pipeline
8. **Conversation UI redesign** — the visual layer

### Additional changes from session 2 (2026-02-25)

- **Half-week cadence**: Summary auto-trigger changed from Sunday-only to Sunday + Wednesday, both at 21:00 (9pm Barcelona time)
- **Conversation window**: Dr. Poo now receives only messages from the current half-week period (since last Sun/Wed 21:00 boundary), instead of the last 20 messages from all time. Changed `useConversationHistory(20)` → `useConversationsByDateRange(halfWeekStartMs, now)` in `useAiInsights.ts`.
- **Boundary constant**: `BOUNDARY_HOUR = 21` in `useWeeklySummaryAutoTrigger.ts` — single place to change if timing needs adjusting
- **Suggestions**: Now pulled from `reportSuggestions` table via `useSuggestionsByDateRange` (last 7 days) instead of extracted from previous report blobs (all time). Grouped by normalized text with count/firstSeen/lastSeen. Sent as `recentSuggestionHistory` in user message payload. Old `previousSuggestionsStillInEffect` field is gone.

### What happens at 21:00 Wednesday 2026-02-25

The first Wednesday boundary fires tonight. When the app is open after 9pm:

1. `getLastHalfWeekBoundary()` will return **Wednesday 21:00** (tonight) instead of last Sunday 21:00
2. The auto-trigger will detect no summary exists for the period Sunday 21:00 → Wednesday 21:00
3. It will generate a summary from all conversations/suggestions/bowel notes in that period
4. It saves to `weeklySummaries` table
5. From this point, Dr. Poo only sees conversations from Wednesday 21:00 onwards
6. The summary of everything before Wednesday 21:00 feeds into `previousWeekRecap`

**Nothing has been committed yet — all changes are unstaged.**
