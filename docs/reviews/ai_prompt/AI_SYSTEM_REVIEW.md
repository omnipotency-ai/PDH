# AI System Review — Caca Traca

> Created: 2026-03-01
> Last updated: 2026-03-15
> Status: Active review — issues identified, most fixes deferred pending #80 (OpenAI prompt management)

## Architecture Note (2026-03-15)

**The AI system is client-initiated BYOK (bring your own key).** The user provides their OpenAI API key, which is stored in IndexedDB. All LLM calls are made client-side — not via server-scheduled Convex actions. This was a deliberate architecture decision made during the food system rebuild (2026-03-13). Server-scheduled AI calls were explicitly rejected. See `memory/feedback_llm_key_architecture.md` for rationale.

The trigger column below reflects the CURRENT implemented trigger, which may differ from the originally reviewed architecture. The "Weekly Summary Sun/Wed 21:00 auto" trigger (#7) still runs but is also client-initiated — it fires from a client-side timer check, not a Convex scheduled function.

**#80 OpenAI prompt management is the current ship blocker.** All other rework items in this review are queued behind it.

---

## Current State: 7 LLM Call Types

| #   | Feature                       | Model        | Current Trigger                                          | Stored?                                 | Fed Back to LLM?                            |
| --- | ----------------------------- | ------------ | -------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| 1   | Food Parsing                  | gpt-5-mini   | User logs food (client-initiated)                        | Yes (Convex logs + food library)        | Yes (canonicalNames → food trials)          |
| 2   | Dr. Poo Report                | gpt-5.2/mini | User-triggered after bowel log (client-initiated)        | Yes (Convex aiAnalyses + conversations) | Yes (summary → conversation → next report)  |
| 3   | Pane Summaries (correlations) | gpt-5-mini   | View Patterns page (×4 parallel, client-side)            | Yes (Zustand cache, 6h TTL)             | Yes (→ habitCorrelationInsights in Dr. Poo) |
| 4   | Coaching Snippet              | gpt-5-mini   | Every quick capture / habit change (2s debounce, client) | No (transient)                          | No                                          |
| 5   | Habit Detail Snippet          | gpt-5-mini   | Open habit detail sheet (client)                         | No (transient)                          | No                                          |
| 6   | Settings Suggestions          | gpt-5-mini   | Every Settings page load (client)                        | No (transient)                          | No                                          |
| 7   | Weekly Summary                | gpt-5.2/mini | Sun/Wed 21:00 client-side timer check                    | Yes (Convex)                            | Yes (→ previousWeeklySummary in Dr. Poo)    |

---

## Issues & Decisions Per Feature

### #1 Food Parsing — NEEDS REWORK

**Current behavior:** User types food text → gpt-5-mini parses it → confirmation modal → save.

**Issues identified:**

- [ ] **Food library has duplicates** — canonicalName normalization is failing. Need to audit food library and fix dedup logic before trusting it.
- [ ] **Confirmation modal shouldn't appear every time** — user wants seamless logging. Modal should only appear when there's ambiguity (uncertain flag, multiple interpretations).
- [ ] **Should use structured outputs first** — OpenAI's structured outputs (JSON schema response_format) should be used to parse food deterministically. Only fall back to gpt-5-mini if structured parsing fails for complex or ambiguous input.

**Action items:**

1. Audit and deduplicate the food library (canonicalName normalization)
2. Implement structured output parsing as primary method, gpt-5-mini as fallback
3. Auto-confirm when parsing is unambiguous (no uncertain flags); only show modal for uncertain items

---

### #2 Dr. Poo Report — BUGS + PROMPT REWORK

**Current behavior:** `triggerAnalysis()` called after bowel log → 60s debounce → fetchAiInsights with massive context payload.

**Confirmed:** `triggerAnalysis()` is ONLY called in `handleLogBowel` (Track.tsx:187). It does NOT fire after food logging. The render loop bug (fixed earlier) was causing the flood of duplicate calls, not a food trigger.

**Issues identified:**

- [ ] **Prompt is being completely reworked** — in progress in Google AI Studio (Peter working on this separately)
- [ ] **Context window management is broken** — currently sends last 20 conversation messages regardless of age. Should only send messages since the last half-week cutover (Sun/Wed 21:00).
- [ ] **Half-weekly cutover should clear conversation context** — at 9pm Wed/Sun, the weekly summary should REPLACE the raw conversation messages. The summary provides context instead of individual messages. Same for food table, suggestions — everything compiled should be half-weekly and eliminate previous raw context.
- [ ] **This keeps prompt size constant and predictable** — always max N tokens for summary + current period's messages only.

**The intended architecture:**

```
Sun 21:00 cutover:
  1. Generate weekly summary from Wed→Sun conversations + suggestions + bowel notes
  2. Store summary in Convex
  3. Clear/archive raw conversation messages for that period
  4. Next Dr. Poo report uses: weekly summary (compact) + only new messages since cutover

Result: Prompt size stays constant — one summary block + fresh messages only
```

**Action items:**

1. Prompt rework — Peter doing this in Google AI Studio
2. Change conversation context from "last 20 messages" to "messages since last half-week cutover"
3. Implement cutover clearing: weekly summary replaces raw conversation context
4. Apply same pattern to food table, suggestions — half-weekly compilation replaces raw data

---

### #3 Pane Summaries (Patterns Page Correlations) — NEEDS REWORK

**Current behavior:** Opening Patterns page fires 4 parallel gpt-5-mini calls (water, walking, sleep, destructive habits). Cached for 6 hours. That's up to 24 calls/day if user checks Patterns every 6 hours.

**Issues identified:**

- [ ] **4 parallel calls is wasteful** — should be ONE call that covers all 4 correlation areas
- [ ] **Should not fire on every page visit** — auto-refresh should happen at fixed times only
- [ ] **Manual refresh should be available** — user can trigger on demand

**Decision:**

- Auto-refresh at **9:00 AM and 9:00 PM daily** (twice per day, 1 call each = 2 calls/day)
- Manual refresh button available at any time
- Combine all 4 panes into a single LLM call with structured output
- Continue caching in Zustand with display from cache on page visit

**Action items:**

1. Merge 4 pane summary calls into 1 combined call
2. Change trigger from "page visit" to scheduled (9am/9pm) + manual button
3. Update cache TTL from 6h to match schedule (invalidate at 9am/9pm)

---

### #4 Coaching Snippet — NEEDS REWORK

**Current behavior:** Every quick capture button press calls `refreshCoaching()` → 2-second debounce → gpt-5-mini call. Fires after every habit increment, every fluid log, every quick capture action.

**The 2-second debounce explained:** When you press a quick capture button, `refreshCoaching()` is called. It sets a 2-second timer. If another button press happens within 2 seconds, the timer resets. After 2 seconds of no presses, it fires the API call. This is why the coaching message doesn't appear instantly — there's always a 2-second delay. But if you press multiple buttons quickly, it only fires once (after the last press + 2s).

**Issues identified:**

- [ ] **Too many calls** — every habit interaction fires this. If you log 5 things, that's 5 timer resets but still fires at least once.
- [ ] **Positioned wrong in UI** — currently under Dr. Poo's report section. Should be directly under quick capture buttons.
- [ ] **Should be milestone-based, not every-action** — e.g., "You haven't drunk half your water target and it's past midday"
- [ ] **Shouldn't fire for non-relevant actions** — medication logs, weight logs shouldn't trigger coaching

**Decision:**

- Change from "fire on every habit change" to milestone-based triggers:
  - Midday check: haven't reached 50% of a target
  - Goal completion: just hit a target
  - Streak events: new streak milestone (3 days, 7 days, 14 days)
  - First log of the day: welcome back message
  - Cap exceeded: went over a daily cap
- Move UI position to directly under quick capture
- Use heuristic (rule-based) messages for most milestones; only call LLM for complex/contextual ones
- Maximum 1 LLM call per session (not per action)

**Action items:**

1. Define milestone trigger conditions
2. Move coaching strip UI under quick capture
3. Implement milestone detection logic
4. Limit LLM calls to max 1 per app session; use heuristics for the rest

---

### #5 Habit Detail Snippet — NEEDS REWORK

**Current behavior:** Opening a habit detail sheet calls gpt-5-mini with 7 days of history. Returns a 100-char insight. Not stored, not cached.

**What it currently receives:**

- Habit name, kind (target/cap), unit
- Daily target or cap value
- Current streak length, good days count
- Last 7 days: date, total value, whether it was a "good day" (met target / stayed under cap)

**What it generates:** A single 100-character insight like "Your water intake dropped 20% on weekends — try setting a reminder" or "3-day streak! Keep going."

**Issues identified:**

- [ ] **Fires every time the sheet opens** — should be max once per day per habit
- [ ] **Not stored** — should be stored so insights can accumulate and feed into correlations
- [ ] **Insight quality is limited** — 100 chars with only met/not-met data. Could be richer with actual values and trends.

**Decision:**

- Cache per habit per day — only 1 LLM call per habit per day
- Store insights in Convex (new table or field on habit data)
- Feed stored insights into Dr. Poo reports as additional context
- Consider expanding input data to include actual values, not just good/not-good

**Action items:**

1. Add daily caching per habit (store in Zustand + Convex)
2. Only call LLM if no cached insight exists for this habit today
3. Store insights persistently for correlation use
4. Include in Dr. Poo context as habit-level insights

---

### #6 Settings Suggestions — NEEDS REWORK

**Current behavior:** Every time Settings page loads, fires gpt-5-mini with 14-day habit data. Returns up to 3 target/cap adjustment suggestions. Not stored.

**Issues identified:**

- [ ] **Fires on every settings page visit** — bug. Should be on-demand only.
- [ ] **Not stored** — suggestions should persist so user can see them later and so they feed back into context.

**Decision:**

- On-demand only (button press), NOT on page load
- Store suggestions in Convex
- Show stored suggestions in Settings UI (with timestamp of when generated)
- Feed back into Dr. Poo reports as context

**Action items:**

1. Remove auto-trigger from Settings page mount
2. Add "Generate Suggestions" button
3. Store suggestions in Convex with timestamp
4. Display persisted suggestions with date in UI

---

### #7 Weekly Summary — CORRECT AS-IS

**Current behavior:** Auto-fires at Sunday 21:00 and Wednesday 21:00. Generates narrative summary from half-week's conversations, suggestions, bowel notes. Stored in Convex. Fed into next Dr. Poo report.

**This is the intended architecture.** The fix applied earlier (generatedForPeriodRef + stable deps) prevents duplicate calls.

**Enhancement needed:**

- [ ] After summary generation, the raw conversation context for that period should be archived/cleared so it doesn't continue growing in the Dr. Poo prompt

---

## Data Flow Architecture (Target State)

```
Half-week period (Wed 21:00 → Sun 21:00):

  During the period:
    Food parsing (gpt-5-mini) → food library + food trials
    Bowel log → Dr. Poo report (gpt-5.2) → conversation message
      Context: weekly summary from PREVIOUS period + messages since THIS period's cutover only
    Pane summaries (1 call at 9am + 9pm) → correlation cache → Dr. Poo context
    Coaching (milestone-based, heuristic-first) → transient UI
    Habit snippets (1/day/habit) → stored → Dr. Poo context
    Settings suggestions (on-demand) → stored

  At boundary (Sun 21:00):
    Weekly summary generated from this period's conversations + suggestions + bowel notes
    Summary REPLACES raw conversation context for this period
    New period begins with clean conversation slate + summary as context
```

**Result:** Prompt size is bounded and predictable. No cumulative growth.

---

## Cost Impact Estimate

| Feature              | Current calls/day        | Target calls/day                               | Reduction             |
| -------------------- | ------------------------ | ---------------------------------------------- | --------------------- |
| Food Parsing         | ~5-10 (per food log)     | ~5-10 (unchanged, but structured output first) | Cheaper per call      |
| Dr. Poo Report       | 2-5 (per bowel log)      | 2-5 (unchanged, but smaller prompt)            | ~50% cheaper per call |
| Pane Summaries       | Up to 24 (4×6h)          | 2 (9am + 9pm, 1 call each)                     | **92% reduction**     |
| Coaching Snippet     | 10-20 (per habit action) | 0-1 (milestone only, heuristic-first)          | **95%+ reduction**    |
| Habit Detail Snippet | 5-10 (per sheet open)    | 0-5 (1/day/habit, cached)                      | **50%+ reduction**    |
| Settings Suggestions | 3-5 (per settings visit) | 0-1 (on-demand only)                           | **80%+ reduction**    |
| Weekly Summary       | 1 (correct)              | 1 (unchanged)                                  | —                     |
| **TOTAL**            | **50-75 calls/day**      | **~10-25 calls/day**                           | **~60-70% reduction** |

Plus the render loop fix eliminates the catastrophic 360-call floods entirely.
