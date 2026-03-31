# Dr. Poo Data Model — Quick Reference

> **Staleness note (2026-03-14):** This cheat sheet was written against the 2026-02-24 codebase.
> Key things that have changed: `syncKey` → `userId` throughout; Archive page is implemented;
> additional tables added (`foodAssessments`, `foodTrialSummary`, `conversations`, `ingredientProfiles`,
> `reportSuggestions`, `weeklySummaries`); `AiNutritionistInsight` has new fields (`directResponseToUser`,
> `clinicalReasoning`, `educationalInsight`, `lifestyleExperiment`); AI model is user-configurable.
> See `README.md` for a full change summary.

## Tables at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LOGS TABLE                    AIANALYSES TABLE                 │
│  ─────────────────            ──────────────────                │
│  syncKey (index)              syncKey (index)                   │
│  timestamp (range)            timestamp (range)                 │
│  type (food|fluid|...)        request (opaque)                  │
│  data (typed by type)         response (opaque)                 │
│                               insight (AiNutritionistInsight)   │
│                               model (gpt-5.2)                   │
│                               durationMs                        │
│                               inputLogCount                     │
│                               error (optional)                  │
│                               starred (optional) ← NEW          │
│                                                                 │
│  PROFILES TABLE               FOODLIBRARY TABLE                 │
│  ──────────────               ─────────────────                 │
│  syncKey (index)              syncKey (index)                   │
│  unitSystem                   canonicalName (index)             │
│  habits (HabitConfig[])       type (ingredient|composite)       │
│  gamification (optional)      ingredients (string[])            │
│  sleepGoal (optional)         createdAt                         │
│  fluidPresets (optional)                                        │
│  updatedAt                                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Log Types & Data Structure

```
FOOD LOG
├─ items[]
│  ├─ name: "banana"
│  ├─ canonicalName: "Banana (peeled)"
│  ├─ quantity: 1
│  └─ unit: "piece"
└─ notes: "felt full quickly"

FLUID LOG
├─ items[]
│  ├─ name: "water"
│  ├─ quantity: 250
│  └─ unit: "ml"

DIGESTION LOG
├─ bristolCode: 5
├─ urgencyTag: "low"
├─ effortTag: "normal"
├─ consistencyTag: "soft"
├─ volumeTag: "normal"
├─ accident: false
├─ episodesCount: 1
└─ notes: ""

HABIT LOG
├─ habitId: "habit-1"
├─ name: "Cigarettes"
├─ habitType: "cigarettes"
├─ quantity: 2
└─ action: "morning"

ACTIVITY LOG
├─ activityType: "walk"
├─ durationMinutes: 30
└─ feelTag: "energetic"

WEIGHT LOG
└─ weightKg: 72.5
```

## AiNutritionistInsight Structure

```
{
  summary: "Great week! Your gut is stabilizing...",

  suggestions: [
    "Try adding a pinch of salt...",
    "Keep hydrating regularly..."
  ],

  suspectedCulprits: [
    {
      food: "guacamole",
      confidence: "high",
      reasoning: "Correlated with Bristol 7 output within 3 hours of consumption..."
    }
  ],

  likelySafe: [
    {
      food: "banana",
      reasoning: "Last 3 trials all produced Bristol 3-5..."
    }
  ],

  mealPlan: [
    {
      meal: "Breakfast",
      items: ["porridge", "banana", "water"],
      reasoning: "Proven safe combination; easy to digest..."
    },
    {
      meal: "Lunch",
      items: ["white rice", "boiled chicken", "steamed carrot"],
      reasoning: "Gentle proteins with binding carbs..."
    },
    {
      meal: "Dinner",
      items: ["pasta", "mild tomato sauce", "plain chicken"],
      reasoning: "Lighter than lunch; avoid acidic overload..."
    }
  ],

  nextFoodToTry: {
    food: "soft scrambled egg",
    reasoning: "Protein source not yet tested; gentle texture...",
    timing: "Try at tomorrow's breakfast around 08:00..."
  },

  miniChallenge: {
    challenge: "Stay under 3 cigarettes today",
    duration: "24 hours"
  } | null,
}
```

## Data Flow Diagram

```
USER LOGS DATA
│
├─ [Log Form: Food/Fluid/Digestion/Habit/Activity/Weight]
│  │
│  └─> Zustand Store (local-first)
│      ├─ latestLogs[]
│      ├─ latestAiInsight
│      ├─ drPooReplies[] (pending)
│      └─ IndexedDB (persist)
│
├─ [Background Sync]
│  │
│  └─> Convex `logs.add()` mutation
│      └─> DB: logs table
│
├─ [User Triggers Analysis]
│  │
│  ├─ Fetch recent logs (72h) via `logs.listBySyncKeyRange()`
│  ├─ Fetch profile via `logs.getProfile()`
│  ├─ Include pending replies (drPooReplies)
│  │
│  └─> Convex `logs.listBySyncKey(200)`
│      └─> DB: logs table
│
├─ [OpenAI API Call] ← CLIENT SIDE
│  │
│  ├─ System Prompt: Clinical Dr. Poo instructions (4000+ tokens)
│  ├─ Previous Reports: Last N analyses (for context)
│  ├─ Current Data: Logs + habits + health profile
│  │
│  └─> GPT-5.2: Generate AiNutritionistInsight JSON
│
├─ [Store Analysis Result]
│  │
│  ├─> Zustand: setAiInsight(insight) + setAiAnalysisStatus("done")
│  │
│  └─> Convex `aiAnalyses.add()` mutation
│      └─> DB: aiAnalyses table
│
├─ [Display Report]
│  │
│  └─> React Component: AiInsightsSection
│      ├─ Summary (Dr. Poo's message)
│      ├─ Suggestions (bulleted)
│      ├─ Reply Input (for next analysis)
│      └─ Collapsible Full Report
│           ├─ Suspected Culprits (with confidence)
│           ├─ Likely Safe Foods
│           ├─ Meal Plan (3 meals)
│           ├─ Next Food to Try
│           ├─ Mini Challenge
│           └─ Disclaimer
│
└─ [Archive / History]
   │
   └─> `/archive` page (planned)
       ├─ Load 50 reports via `aiAnalyses.listBySyncKey(50)`
       ├─ Date filter → jump to specific day
       ├─ Keyword search (client-side)
       ├─ Star filter → toggle `starred` field
       └─> Display full report with prev/next navigation
```

## Convex Functions

### Logs

| Function             | Args                              | Returns         | Purpose                             |
| -------------------- | --------------------------------- | --------------- | ----------------------------------- |
| `listBySyncKey`      | syncKey, limit?                   | LogEntry[]      | All user's logs (recent first)      |
| `listBySyncKeyRange` | syncKey, startMs, endMs, limit?   | LogEntry[]      | Logs in date range (for AI context) |
| `add`                | syncKey, timestamp, type, data    | string (ID)     | Insert new log                      |
| `remove`             | id, syncKey                       | void            | Delete log                          |
| `update`             | id, syncKey, timestamp, data      | void            | Update log                          |
| `getProfile`         | syncKey                           | Profile \| null | User profile + habits               |
| `replaceProfile`     | syncKey, unitSystem, habits, etc. | string (ID)     | Upsert user profile                 |

### AI Analyses

| Function        | Args                                                                                     | Returns                | Purpose                       |
| --------------- | ---------------------------------------------------------------------------------------- | ---------------------- | ----------------------------- |
| `add`           | syncKey, timestamp, request, response, insight, model, durationMs, inputLogCount, error? | string (ID)            | Store analysis result         |
| `listBySyncKey` | syncKey, limit?                                                                          | AnalysisRecord[]       | Recent analyses (for archive) |
| `latest`        | syncKey                                                                                  | AnalysisRecord \| null | Single most recent            |
| `toggleStar`    | id, syncKey                                                                              | boolean                | Toggle starred status (NEW)   |

## Frontend Hooks (`src/lib/sync.ts`)

| Hook                                       | Returns                  | Used For                   |
| ------------------------------------------ | ------------------------ | -------------------------- |
| `useSyncKey()`                             | string                   | Get current user's syncKey |
| `useSyncedLogs(limit?)`                    | LogEntry[]               | Recent logs on Track page  |
| `useSyncedLogsByRange(start, end, limit?)` | LogEntry[]               | 72h logs for AI analysis   |
| `useAddSyncedLog()`                        | (payload) => Promise     | Insert new log             |
| `useRemoveSyncedLog()`                     | (id) => Promise          | Delete log                 |
| `useUpdateSyncedLog()`                     | (payload) => Promise     | Update log                 |
| `useAddAiAnalysis()`                       | (payload) => Promise     | Store analysis result      |
| `useAiAnalysisHistory(limit?)`             | AnalysisRecord[]         | Track + Archive pages      |
| `useToggleReportStar()`                    | (id) => Promise          | Star/unstar report (NEW)   |
| `useProfileSync()`                         | { profile, saveProfile } | Settings page + AI context |

## Key Fields & Types

### syncKey

- **Type:** string
- **Origin:** Clerk auth or session identifier
- **Used:** Every query/mutation to isolate user data
- **Validation:** Required, checked in all handlers

### timestamp

- **Type:** number (milliseconds since epoch)
- **Format:** Unix time ms
- **Range:** Any valid date
- **Used:** Sorting, range queries, AI context window

### insight (AiNutritionistInsight)

- **Type:** v.any() in schema (validated on frontend)
- **Schema:** Defined in `src/store.ts`
- **Source:** Parsed from GPT-5.2 JSON response
- **Fields:** summary, suggestions, suspectedCulprits, likelySafe, mealPlan, nextFoodToTry, miniChallenge

### starred

- **Type:** v.optional(v.boolean())
- **Default:** false (or undefined)
- **Added:** For archive feature (Task 1)
- **Mutation:** `toggleStar()` flips current value

## Search & Filter Capabilities

### Searchable Fields (Archive Page)

```
- insight.summary
- insight.suggestions[]
- insight.suspectedCulprits[].food
- insight.likelySafe[].food
- insight.mealPlan[].meal
- insight.nextFoodToTry.food
- insight.miniChallenge.challenge
```

### Filterable Fields

```
- timestamp (via date picker)
- starred (toggle)
- keyword match (client-side, debounced 300ms)
```

### NOT Searchable

```
- Full-text search at DB level (no Elasticsearch)
- Cross-document correlations
- Food trial history aggregation
- Suggestion engagement metrics
```

## Security & Isolation

- **User Isolation:** `syncKey` in all queries; no cross-user leakage
- **API Key:** Stored client-side (consider backend proxy for production)
- **Validation:** Convex validators on all inserts/updates
- **Mutation Auth:** syncKey verified in handler before mutations

## Limits & Pagination

| Query                    | Default | Max   | Use Case           |
| ------------------------ | ------- | ----- | ------------------ |
| logs.listBySyncKey       | 300     | 1000  | Daily tracking     |
| logs.listBySyncKeyRange  | 5000    | 20000 | AI context (72h)   |
| aiAnalyses.listBySyncKey | 50      | 200   | Archive history    |
| useAiAnalysisHistory     | 50      | —     | Track page display |

## Context Windows & Cutoffs

| Setting            | Value      | Why                                    |
| ------------------ | ---------- | -------------------------------------- |
| AI Context Window  | 72 hours   | Captures food→output correlation cycle |
| Archive Pagination | 50 reports | Balance between memory usage and UX    |
| Keyword Debounce   | 300ms      | Smooth search without performance hit  |
| Log Limit (Track)  | 300        | Sufficient for 1-2 weeks of data       |

## Common Queries

### Get latest Dr. Poo report

```typescript
const latest = await ctx.db
  .query("aiAnalyses")
  .withIndex("by_syncKey_timestamp", (q) => q.eq("syncKey", args.syncKey))
  .order("desc")
  .first();
```

### Get all logs for 72-hour context

```typescript
const cutoff = Date.now() - 72 * 60 * 60 * 1000;
const logs = await ctx.db
  .query("logs")
  .withIndex("by_syncKey_timestamp", (q) =>
    q.eq("syncKey", syncKey).gte("timestamp", cutoff),
  )
  .order("desc")
  .take(5000);
```

### Search archived reports (client-side)

```typescript
const keyword = "guacamole".toLowerCase();
const matches = reports.filter(
  (r) =>
    r.insight.summary.toLowerCase().includes(keyword) ||
    r.insight.suspectedCulprits.some((c) =>
      c.food.toLowerCase().includes(keyword),
    ),
);
```

## What's Stored vs. What's Not

| Item                                                    | Stored   | Notes                                   |
| ------------------------------------------------------- | -------- | --------------------------------------- |
| User logs (food/fluid/digestion/habits/activity/weight) | ✓        | Persisted to DB                         |
| AI analysis insights                                    | ✓        | Full insight object                     |
| AI request & response                                   | ✓        | Raw JSON for audit trail                |
| User replies/messages                                   | ✗        | Only in local state (ephemeral)         |
| Food trial outcomes                                     | Implicit | Extracted from insights, not aggregated |
| Suggestion engagement                                   | ✗        | Not tracked                             |
| Side quest completion                                   | ✗        | Not tracked                             |
| Data change history                                     | ✗        | No audit trail                          |

## Next Steps (If Implementing Archive)

1. Add `starred` field to schema
2. Implement `toggleStar` mutation
3. Extract shared `DrPooReport` component
4. Create `/archive` page route
5. Add archive links to Track & Patterns
6. Test, format, commit

See `/docs/plans/2026-02-24-dr-poo-archive-plan.md` for implementation details.
