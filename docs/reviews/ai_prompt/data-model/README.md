# Dr. Poo AI Analysis — Data Model Documentation

> **Note (2026-03-14):** This documentation was written against the state of the codebase on 2026-02-24.
> Several things have changed since then — see the "What Has Changed" section below before relying on
> specific details.

This directory contains comprehensive documentation of the Dr. Poo AI analysis data model, including:

- **Table schemas** — Convex database structure
- **Data types** — Field definitions for logs, analyses, and configurations
- **Data flow** — How data moves from user input to AI analysis to display
- **Searchability** — What can be queried and filtered
- **Data gaps** — Current limitations and opportunities

## What Has Changed Since This Was Written (2026-03-14)

### Schema: `syncKey` → `userId`

The user identifier field was renamed from `syncKey` to `userId` throughout all Convex tables and indexes. References to `syncKey` in these docs are stale.

### Archive page is implemented

`/archive` page (`src/pages/secondary_pages/Archive.tsx`) and the `DrPooReport` shared component (`src/components/archive/DrPooReport.tsx`) are built and live. The "Planned" status in these docs is outdated.

### Food trial tracking now exists in DB

The schema now has `foodAssessments` and `foodTrialSummary` tables. The "no persistent food trial aggregation" data gap listed here is resolved.

### Conversation persistence now exists

The `conversations` table in the schema replaces the proposed `drPooConversations` table. User messages to Dr. Poo are now persisted.

### `AiNutritionistInsight` schema has new fields (v2/v3 prompt)

The insight object now includes: `directResponseToUser`, `clinicalReasoning`, `educationalInsight`, `lifestyleExperiment`. See `docs/dr-poo-architecture-ideas-and prompt-versioning/` for the current schema.

### Additional tables in schema

The current schema also contains: `ingredientExposures`, `ingredientOverrides`, `ingredientProfiles`, `reportSuggestions`, `weeklyDigest`, `weeklySummaries`, `waitlistEntries`, `stripe`-related tables.

## Files

### `dr-poo-ai-analysis-data-model.md` (Primary Reference)

Complete technical documentation. Start here for:

- In-depth schema definitions
- All log data types
- AiNutritionistInsight structure
- Step-by-step data flow (user logs → sync → AI → storage → display)
- Current and planned searchability
- Data gaps and enhancement opportunities
- Storage patterns for request/response
- Frontend state management
- Usage examples

**Length:** ~850 lines, comprehensive

### `QUICK-REFERENCE.md` (Cheat Sheet)

Visual quick-lookup guide. Use this for:

- Table overview diagrams
- Log type templates
- AiNutritionistInsight template
- Data flow diagram (ASCII)
- Function reference tables (Convex + hooks)
- Key fields and types
- Common queries
- Limits and pagination

**Length:** ~380 lines, skimmable

## Quick Summary

### Tables

> Note: indexes use `by_userId` (not `by_syncKey`) — the field was renamed. See "What Has Changed" above.

| Table                | Purpose                                                            | Notes                                |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `logs`               | User activity (food, fluid, digestion, habits, activities, weight) | Core log table                       |
| `aiAnalyses`         | AI-generated insights + request/response metadata                  | Includes `starred` field             |
| `profiles`           | User settings, habits, health profile, gamification state          |                                      |
| `foodLibrary`        | Canonical food items for autofill/normalization                    |                                      |
| `foodAssessments`    | Per-report food verdicts (culprit/safe) with causal role           | Added post-2026-02-24                |
| `foodTrialSummary`   | Aggregated food trial status per user per food                     | Resolves the "no trial DB" gap       |
| `conversations`      | Persisted Dr. Poo conversation messages                            | Resolves the "ephemeral replies" gap |
| `ingredientProfiles` | Nutritional/digestive profiles per ingredient                      | Added post-2026-02-24                |
| `reportSuggestions`  | Per-report suggestion tracking                                     | Added post-2026-02-24                |
| `weeklySummaries`    | AI-generated weekly digest summaries                               | Added post-2026-02-24                |

### Data Flow

> **Updated 2026-03-15:** App is cloud-only (ADR-0001). Convex is the sole persistence layer. IndexedDB holds only the OpenAI API key. Zustand is ephemeral display state only. AI calls are client-initiated BYOK.

```
User Logs → Zustand (ephemeral display state)
                         ↓
               Convex mutations (immediate write)
                         ↓
                   Convex DB (logs table)
                         ↓
              [User Triggers Analysis]
              [OpenAI key loaded from IndexedDB]
                         ↓
    Fetch 72h logs + health profile + conversation history
                         ↓
                  OpenAI API (client-side BYOK)
                  [GPT-5.2 with system prompt]
                         ↓
          Parse AiNutritionistInsight JSON
                         ↓
         Store via Convex (aiAnalyses table)
                         ↓
           Convex reactive query → Display Report
```

### Key Insights

**Strengths:**

- Flexible opaque storage (request/response/insight as v.any())
- Local-first resilience via IndexedDB + Zustand
- Conversation context via previous reports
- Well-defined insight structure despite flexible DB storage
- Clean separation of concerns

**Weaknesses (as of original write — some resolved, see "What Has Changed"):**

- No full-text search at DB level (still true)
- No persistent food trial aggregation — **resolved**: `foodAssessments` + `foodTrialSummary` tables added
- User replies not persisted (ephemeral) — **resolved**: `conversations` table added
- Limited pagination (50 reports) (still true)
- Client-side API key (security concern) (still true — BYOK model is intentional)
- No audit trail for data changes (still true)

### What's Currently Searchable

**In-memory, client-side only (Archive page):**

- `summary`, `suggestions[]`, `suspectedCulprits[].food`, `likelySafe[].food`, `mealPlan[].meal`, `nextFoodToTry.food`, `miniChallenge.challenge`
- By date (date picker)
- By starred status (toggle)

**NOT searchable:**

- Full-text search at database level
- Cross-document correlations
- Food trial history aggregation
- Statistics (most common culprits, safest foods, etc.)

### Data Gaps (as of 2026-02-24 — some now resolved)

1. **User messages not persisted** — **Resolved**: `conversations` table added
2. **No food trial aggregation** — **Resolved**: `foodAssessments` + `foodTrialSummary` tables added
3. **No suggestion engagement tracking** — `reportSuggestions` table added (partial resolution)
4. **No mini challenge completion tracking** — Still unresolved
5. **Limited history depth** — Only loads 50 reports; still true
6. **No audit trail** — Still unresolved

## Usage by Page

### Track Page (`/`)

- Displays latest AI insight via `useAiAnalysisHistory(50)`
- Loads logs via `useSyncedLogs(300)` for display
- Shows summary + suggestions + collapsible report + reply input
- Stores pending replies in local state (`drPooReplies`)

### Archive Page (`/archive`) — Implemented

- Lives at `src/pages/secondary_pages/Archive.tsx`
- Loads up to 50 reports via `useAiAnalysisHistory(50)`
- Provides date picker, keyword search (client-side), star filter
- Displays full report with prev/next navigation
- Star toggle via `useToggleReportStar()`
- All filtering happens in-memory

### Patterns Page (`/patterns`)

- Shows ReportArchive preview (recent 5 reports)
- Links to `/archive` for full history

### Settings Page (`/settings`)

- Loads/saves profile via `useProfileSync()`
- Updates habits, health profile, preferences

## AI Analysis Process

1. **Collect data:** Last 72 hours of logs + health profile + pending replies
2. **Format payload:** Structured JSON with food logs, bowel events, habits, fluids, activities
3. **Add context:** System prompt + previous reports (for conversation continuity)
4. **Call AI model (configurable):** Client-side API call — model is user-configurable, not hardcoded to GPT-5.2
5. **Parse response:** Extract AiNutritionistInsight fields
6. **Store result:** Save request + raw response + parsed insight to `aiAnalyses` table
7. **Update UI:** Zustand store + display report

### System Prompt Philosophy

Dr. Poo is a clinical nutritionist who:

- Leads with wins — always acknowledges what's going well first
- Uses deductive reasoning — correlates food to output using dynamic transit estimation
- Applies 3-trial rule — evaluates food safety based on last 3 outcomes
- Never repeats — avoids repeating observations from previous reports
- Expands diet creatively — suggests new foods within safe tolerance
- Personalizes advice — adjusts for lifestyle modifiers (stimulants, sleep, stress)
- Is warm and practical — speaks like a caring specialist, not a robot

## Performance Considerations

- **Pagination:** Load 50 reports at a time; client-side filtering keeps memory low
- **Debounce:** Keyword search debounced 300ms to prevent excessive re-filtering
- **Indexes:** All queries use `by_userId` or `by_userId_timestamp` indexes (field renamed from `syncKey`)
- **Architecture:** Cloud-only (ADR-0001). Convex = source of truth. IndexedDB = API key only. No local-first sync.

## Security

- **User isolation:** `userId` in all queries; no cross-user data leakage
- **API key:** Stored client-side (BYOK model — intentional design for this product)
- **Validation:** Convex validators on all inserts/updates
- **Authorization:** userId verified in handler before any mutation

## Related Files

**Backend:**

- `/convex/schema.ts` — Table definitions
- `/convex/aiAnalyses.ts` — AI analysis queries/mutations
- `/convex/logs.ts` — Log CRUD + profile
- `/convex/validators.ts` — Shared validators

**Frontend:**

- `/src/store.ts` — Zustand store with AI state
- `/src/lib/sync.ts` — Convex sync hooks
- `/src/lib/aiAnalysis.ts` — AI prompt + analysis logic (v3 prompt as of 2026-03-14)
- `/src/components/track/AiInsightsSection.tsx` — Track page AI display
- `/src/components/archive/DrPooReport.tsx` — Shared report rendering
- `/src/pages/secondary_pages/Archive.tsx` — Archive page (implemented)

**Plans:**

- `/docs/plans/2026-02-24-dr-poo-archive-design.md` — Archive feature UX/design
- `/docs/plans/2026-02-24-dr-poo-archive-plan.md` — Archive feature implementation (6 tasks)

## Next Steps

### Short Term (Immediate)

Use these docs to understand the current data model and implementation.

### Medium Term (Archive Feature) — COMPLETE as of 2026-03-14

All 6 archive tasks are done. Archive page is live at `src/pages/secondary_pages/Archive.tsx`.

### Long Term (Enhancements) — Partially resolved as of 2026-03-14

- Persistent food trial tracking — **Done**: `foodAssessments` + `foodTrialSummary` tables
- User message archival — **Done**: `conversations` table
- Suggestion engagement tracking — **Partial**: `reportSuggestions` table added
- Side quest/mini challenge completion tracking — Still open
- Historical trend analysis — Still open
- Data audit trail — Still open
- Backend API key proxy — BYOK model is intentional; not planned
- Full-text search or Convex search indexes — Still open

## Questions?

Refer to:

1. **For schema details:** `dr-poo-ai-analysis-data-model.md`
2. **For quick lookups:** `QUICK-REFERENCE.md`
3. **For code examples:** Check actual files in `/convex` and `/src`
4. **For implementation:** See `/docs/plans/2026-02-24-dr-poo-archive-plan.md`
