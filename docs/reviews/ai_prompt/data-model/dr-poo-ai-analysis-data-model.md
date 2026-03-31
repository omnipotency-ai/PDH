# Dr. Poo AI Analysis — Complete Data Model

**Last Updated:** 2026-02-24
**Status:** Partially stale as of 2026-03-14 — see `README.md` "What Has Changed" section before using this document.

Key staleness points:

- `syncKey` field renamed to `userId` throughout all tables and indexes
- Archive page is implemented (not planned)
- `foodAssessments`, `foodTrialSummary`, `conversations`, `ingredientProfiles`, `reportSuggestions`, `weeklySummaries` tables added
- `AiNutritionistInsight` schema now includes `directResponseToUser`, `clinicalReasoning`, `educationalInsight`, `lifestyleExperiment`
- AI model is user-configurable (not hardcoded to `gpt-5.2`)

---

## Executive Summary

The Dr. Poo AI analysis system stores user health data, generates clinical nutritionist insights via OpenAI API, and maintains conversation history for iterative refinement. The system is built on:

- **Backend:** Convex database with `logs`, `aiAnalyses`, `profiles`, and `foodLibrary` tables
- **Frontend:** React/Zustand local-first state with IndexedDB sync to Convex
- **AI:** GPT-5.2 with sophisticated system prompt and conversation history
- **Data Flow:** User logs food/fluid/habits/activities/digestion → Convex sync → OpenAI analysis → Convex storage → UI rendering

---

## Table Schemas

### 1. `logs` Table

Stores all user activity logs (food, fluid, habits, activities, digestion events, weight).

#### Schema

```typescript
logs: defineTable({
  syncKey: v.string(), // User identifier (from Clerk/auth)
  timestamp: v.number(), // When the event was logged (ms)
  type: v.union(
    v.literal("food"),
    v.literal("fluid"),
    v.literal("habit"),
    v.literal("activity"),
    v.literal("digestion"),
    v.literal("weight"),
  ),
  data: logDataValidator, // Typed by type (see below)
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"]);
```

#### Log Data Types

**Food Log Data**

```typescript
{
  items: Array<{
    name: string;                 // e.g., "banana", "chicken breast"
    canonicalName?: string;       // Parsed/normalized name from food library
    quantity: number | null;      // e.g., 100, 1.5
    unit: string | null;          // e.g., "g", "piece", "ml"
  }>;
  notes?: string;                 // User notes on the meal
}
```

**Fluid Log Data**

```typescript
{
  items: Array<{
    name: string; // e.g., "water", "coffee", "tea"
    quantity: number; // Always required
    unit: string; // e.g., "ml"
  }>;
}
```

**Digestion Log Data** (Bristol Stool Scale entry)

```typescript
{
  bristolCode: number;            // 1-7 on Bristol Stool Scale
  urgencyTag?: string;            // e.g., "immediate", "moderate", "none"
  effortTag?: string;             // e.g., "straining", "normal", "easy"
  consistencyTag?: string;        // e.g., "hard", "lumpy", "smooth", "watery"
  volumeTag?: string;             // e.g., "small", "normal", "large"
  accident?: boolean;             // Unplanned event (post-op tracking)
  episodesCount?: number | string; // Number of events in the window
  windowMinutes?: number;         // Time window for the events
  notes?: string;
}
```

**Habit Log Data**

```typescript
{
  habitId: string;                // Reference to habit config in profile
  name: string;                   // e.g., "Cigarettes", "Medication"
  habitType: string;              // "cigarettes" | "medication" | "rec_drugs" | "caffeine" | "confectionery" | "custom" ...
  quantity?: number;              // e.g., 2 cigarettes, 5mg medication
  action?: string;                // Additional context (e.g., "morning", "after meal")
}
```

**Activity Log Data**

```typescript
{
  activityType: string;           // e.g., "walk", "gym", "yoga"
  durationMinutes?: number;       // Duration of activity
  feelTag?: string;               // e.g., "energetic", "tired", "neutral"
}
```

**Weight Log Data**

```typescript
{
  weightKg: number;
}
```

#### Indexes

- `by_syncKey`: Fast lookup of all logs for a user
- `by_syncKey_timestamp`: Range queries and sorting by time (used for 72-hour lookbacks)

#### Current Usage

- **`listBySyncKey(syncKey, limit=300)`** — Returns up to 300 most recent logs
- **`listBySyncKeyRange(syncKey, startMs, endMs, limit=5000)`** — Returns logs in a date range (used by AI analysis for 72-hour context)
- **`add(syncKey, timestamp, type, data)`** — Insert a new log
- **`remove(id, syncKey)`** — Delete a log (with syncKey validation)
- **`update(id, syncKey, timestamp, data)`** — Update a log

---

### 2. `aiAnalyses` Table

Stores AI-generated reports and metadata about analysis requests/responses.

#### Schema

```typescript
aiAnalyses: defineTable({
  syncKey: v.string(), // User identifier
  timestamp: v.number(), // When report was generated (ms)

  // Request & response opaque blobs — intentionally untyped
  request: v.any(), // { model, messages: [...] }
  response: v.any(), // Raw JSON response from OpenAI
  insight: v.any(), // Parsed insight (see AiNutritionistInsight)

  model: v.string(), // e.g., "gpt-5.2"
  durationMs: v.number(), // API round-trip time
  inputLogCount: number, // How many logs were included in context
  error: v.optional(v.string()), // Error message if analysis failed

  starred: v.optional(v.boolean()), // User-marked favorite reports
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"]);
```

#### Current Usage

- **`add(syncKey, timestamp, request, response, insight, model, durationMs, inputLogCount, error?)`** — Store a new analysis result
- **`listBySyncKey(syncKey, limit=50)`** — Get most recent analyses (used by Track page and Archive)
- **`latest(syncKey)`** — Get the single most recent analysis (used for initial load)
- **`toggleStar(id, syncKey)`** — Star/unstar a report (for archive favorites feature)

#### Insight Data Structure

The `insight` field stores a validated `AiNutritionistInsight` object:

```typescript
interface AiNutritionistInsight {
  // Foods that correlate with bad outputs
  suspectedCulprits: Array<{
    food: string; // e.g., "guacamole", "nuts"
    confidence: "high" | "medium" | "low";
    reasoning: string; // Clinical explanation
  }>;

  // Foods confirmed safe via 3-trial rule
  likelySafe: Array<{
    food: string;
    reasoning: string;
  }>;

  // Next 3 meals recommended
  mealPlan: Array<{
    meal: string; // e.g., "Breakfast", "Lunch", "Dinner"
    items: string[]; // Suggested foods for meal
    reasoning: string; // Why these foods at this time
  }>;

  // One specific food to try next
  nextFoodToTry: {
    food: string;
    reasoning: string;
    timing: string; // e.g., "at tomorrow's lunch around 15:00"
  };

  // Optional gamified challenge
  miniChallenge: {
    challenge: string; // e.g., "Stay under 3 cigarettes today"
    duration: string; // e.g., "24 hours"
  } | null;

  // Actionable next steps
  suggestions: string[];

  // Main message from Dr. Poo
  summary: string;
}
```

---

### 3. `profiles` Table

Stores user settings, health profile info, and preferences.

#### Schema

```typescript
profiles: defineTable({
  syncKey: v.string(),

  unitSystem: "metric" | "imperial",
  habits: HabitConfig[],          // User's configured habits to track

  // Legacy fields (for backwards compatibility)
  calibrations?: v.any(),
  fluidPresets?: string[],

  // Gamification state (streaks, badges)
  gamification?: GamificationState,

  // Sleep goal tracking
  sleepGoal?: SleepGoal,

  updatedAt: v.number(),
})
  .index("by_syncKey", ["syncKey"])
```

#### Health Profile Data (in frontend Zustand store)

```typescript
interface HealthProfile {
  surgeryType: string; // e.g., "Ileostomy reversal", "Colostomy reversal"
  surgeryTypeOther?: string; // If "Other" selected
  surgeryDate: string; // ISO date (used for post-op day calculation)

  heightCm: number | null;
  currentWeightKg: number | null;

  healthConditions: string[]; // Selected conditions (e.g., "Diabetes", "IBS")
  healthConditionsOther?: string; // Custom condition text

  medications: string; // Text field of current medications
}
```

---

### 4. `foodLibrary` Table

Stores canonical food items for autofill and normalization.

#### Schema

```typescript
foodLibrary: defineTable({
  syncKey: v.string(),
  canonicalName: v.string(),      // e.g., "Banana (peeled)"
  type: "ingredient" | "composite",
  ingredients: string[],          // For composite foods
  createdAt: v.number(),
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_name", ["syncKey", "canonicalName"])
```

---

### 5. `profiles` — Habits Configuration

Users can configure habits to track (stored in `profiles.habits`):

```typescript
interface HabitConfig {
  id: string;
  name: string; // e.g., "Cigarettes"
  emoji?: string;
  category: "Health" | "Hygiene" | "Wellness" | "Recovery" | "Disruptive";
  dailyGoal: number; // e.g., 0 for "limit", 5 for "target"
  goalMode: "target" | "limit"; // Are we aiming FOR this number or trying to LIMIT it?
  habitType: string; // "cigarettes", "medication", "rec_drugs", "caffeine", etc.
  color: string; // CSS color value
}
```

---

## Data Flow: From User Input to Report Generation

### Step 1: User Logs Data (Client)

User logs food, fluid, digestion, habits, activities, or weight.

**Frontend State:**

- Stored in Zustand store (local-first)
- Persisted to IndexedDB

**Action:**

```typescript
useAddSyncedLog()({
  timestamp: Date.now(),
  type: "food",
  data: { items: [...], notes: "..." }
})
```

### Step 2: Sync to Convex

Zustand hooks call Convex mutations to persist data to cloud.

**Convex Mutation:**

```typescript
ctx.db.insert("logs", {
  syncKey,
  timestamp,
  type,
  data,
});
```

### Step 3: Trigger Analysis (Manual or Automatic)

User initiates analysis (currently manual via "Send to Dr. Poo" button).

**Frontend:**

1. Calls `useAiAnalysisHistory()` to fetch recent analyses
2. Calls `useSyncedLogsByRange()` to get 72-hour log history
3. Retrieves health profile from `useProfileSync()`
4. Calls `fetchAiInsights()` (client-side API call to OpenAI)

### Step 4: AI Analysis (Client-Side)

**Input to GPT-5.2:**

```json
{
  "currentTime": "Monday, February 24, 2026, 14:32",
  "daysPostOp": 128,
  "update": "Here are my latest logs since we last spoke.",
  "foodLogs": [
    {
      "timestamp": 1708703400000,
      "time": "Mon 24 Feb · 13:45",
      "items": [
        {
          "name": "banana",
          "canonicalName": "Banana (peeled)",
          "quantity": 1,
          "unit": "piece"
        }
      ],
      "notes": ""
    }
  ],
  "bowelEvents": [
    {
      "timestamp": 1708703800000,
      "time": "Mon 24 Feb · 13:56",
      "bristolCode": 5,
      "consistency": "soft",
      "urgency": "low",
      "effort": "normal",
      "volume": "normal",
      "accident": false,
      "episodes": 1,
      "notes": ""
    }
  ],
  "habitLogs": [...],
  "fluidLogs": [...],
  "activityLogs": [...],
  "patientMessages": [
    {
      "message": "I felt bloated after lunch today",
      "sentAt": "Mon 24 Feb · 14:00"
    }
  ]
}
```

**System Prompt:**

A detailed clinical prompt that tells GPT-5.2 to act as "Dr. Poo," a post-operative gut recovery specialist. Includes:

- Patient surgery type, date, BMI, health conditions, medications
- 3-trial rolling rule for food safety assessment
- Deductive reasoning framework for correlating foods to outputs
- Meal planning principles (small portions, prove-safe foods + 1 new item)
- Lifestyle modifier logic (stimulants, sleep, stress affect transit time)
- Character: warm, practical, lead with wins, never repeat observations from last report
- JSON output format with exact schema

**Output from GPT-5.2:**

JSON matching `AiNutritionistInsight` schema (with `miniChallenge` field for mini challenges).

### Step 5: Store Analysis Result

Result is sent back to Convex via `useAddAiAnalysis()`:

```typescript
ctx.db.insert("aiAnalyses", {
  syncKey,
  timestamp: Date.now(),
  request: { model, messages: [...] },
  response: rawJsonResponse,
  insight: parsedInsight,
  model: "gpt-5.2",
  durationMs,
  inputLogCount,
  error: errorMessageIfAny
})
```

### Step 6: Display Latest Report

Frontend updates:

1. Zustand store: `setAiInsight(insight)` + `setAiAnalysisStatus("done")`
2. Triggers re-render of `AiInsightsSection` component
3. Shows summary, suggestions, collapsible full report, and reply input
4. User can add replies (pending local state) to be included in next analysis

---

## Current Searchability & Aggregation

### What's Currently Searchable

**In-memory, client-side only (via Archive page):**

- `insight.summary` — text search
- `insight.suggestions[]` — text search
- `insight.suspectedCulprits[].food` — food names
- `insight.likelySafe[].food` — food names
- `insight.mealPlan[].meal` — meal names
- `insight.nextFoodToTry.food` — food name
- `insight.miniChallenge.challenge` — challenge text

**By timestamp:**

- Can filter by date via date picker on Archive page
- Can range-query logs via `listBySyncKeyRange(startMs, endMs)`

**By star status:**

- Toggle/filter on `starred` boolean field (new in archive feature)

### What's NOT Searchable

**No full-text search at database level:**

- No Elasticsearch or Convex search indexes
- Archive relies entirely on loading up to 50 reports into memory

**No aggregation queries:**

- Cannot query "all reports with 'guacamole' as suspected culprit" at DB level
- Cannot query "reports with Bristol 7 outputs"
- Cannot correlate food mentions across multiple reports
- Cannot generate statistics (e.g., "foods most frequently safe" or "most common culprits")

**No cross-document relationships:**

- `logs` table is independent; no links to `aiAnalyses`
- Cannot query "logs that led to this report" directly
- Cannot trace food trial outcomes across multiple reports without client-side logic

---

## Data Gaps & Opportunities

### 1. User Messages / Replies Not Persisted

**Current:**

- `drPooReplies` stored only in local Zustand state
- Included in next AI analysis payload but never saved to DB
- Lost on page refresh or logout

**Gap:**

- No conversation history archive
- Cannot search past replies
- Cannot correlate user questions to specific reports

**Solution:**
Create `drPooConversations` table:

```typescript
drPooConversations: defineTable({
  syncKey: v.string(),
  aiAnalysisId: v.id("aiAnalyses"),  // Link to the report being discussed
  timestamp: v.number(),
  role: "user" | "assistant",
  content: string,
  metadata?: v.any(),
})
  .index("by_syncKey", ["syncKey"])
  .index("by_aiAnalysisId", ["aiAnalysisId"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"])
```

### 2. No Structured Food Trial History

**Current:**

- Food assessments live only in `insight.suspectedCulprits` and `insight.likelySafe`
- "3-trial rule" is applied by AI logic but not tracked in DB
- Cannot query "what's the status of almonds across all reports?"

**Gap:**

- Cannot build a "food safety database" view without analyzing all reports
- Cannot show user when they tried a food or its outcomes

**Solution:**
Create `foodTrials` table:

```typescript
foodTrials: defineTable({
  syncKey: v.string(),
  canonicalFoodName: string,
  status: "testing" | "safe" | "safe_loose" | "safe_hard" | "watch" | "risky",
  confidenceScore: number, // 0-1
  lastTrialTimestamp: v.number(),
  trialCount: number,
  last3Outcomes: Array<{
    timestamp: number;
    bristolCode: number;
    notes?: string;
  }>,
  updatedAt: v.number(),
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_foodName", ["syncKey", "canonicalFoodName"])
  .index("by_status", ["syncKey", "status"]);
```

### 3. No Suggestion History or Engagement Tracking

**Current:**

- Suggestions are generated fresh each report
- No tracking of whether user followed suggestions
- No data on which suggestions were most helpful

**Gap:**

- Cannot measure engagement or efficacy
- Cannot personalize suggestions based on past adoption

### 4. No Mini Challenge Completion Tracking

**Current:**

- `miniChallenge` exists but completion is not tracked
- No way to know if user attempted or completed a challenge

**Solution:**
Add `completionStatus` to insight or create separate tracking table.

### 5. Limited Historical Analysis

**Current:**

- Only loads 50 most recent reports
- Cannot trend-analyze over weeks or months
- Cannot build time-series visualizations

**Gap:**

- Lost opportunity for "your 30-day progress" views
- Cannot detect seasonal patterns (e.g., worse digestion in winter)

### 6. No Audit Trail for Data Changes

**Current:**

- Logs can be edited/deleted but changes are not tracked
- No way to know what was originally logged vs. corrected

**Gap:**

- Potential data integrity issues for long-term patterns
- Cannot show user their exact historical entries

---

## Stored Request/Response Format

### Request Field

```typescript
{
  model: "gpt-5.2",
  messages: Array<{
    role: "system" | "assistant" | "user",
    content: string
  }>
}
```

**System message:** ~4000 tokens of clinical instructions and character definition

**Previous reports:** Included as `{ role: "assistant", content: JSON.stringify(insight) }` for conversation context

**Current user payload:** Structured JSON with logs, health profile, and pending replies

### Response Field

Raw JSON response from OpenAI:

```typescript
{
  // Schema matching AiNutritionistInsight
  suspectedCulprits: [...],
  likelySafe: [...],
  mealPlan: [...],
  nextFoodToTry: {...},
  miniChallenge: {...} | null,
  suggestions: [...],
  summary: "..."
}
```

---

## Frontend State Management

### Zustand Store (`src/store.ts`)

**AI Insight State:**

```typescript
latestAiInsight: AiNutritionistInsight | null;
latestAiInsightAt: number | null;
aiAnalysisStatus: "idle" | "sending" | "receiving" | "done" | "error";
aiAnalysisError: string | null;

setAiInsight(insight): void;
setAiAnalysisStatus(status, error?): void;
```

**Dr. Poo Replies (Pending):**

```typescript
drPooReplies: Array<{
  text: string;
  timestamp: number;
}>;

addDrPooReply(text: string): void;
clearDrPooReplies(): void;
```

**Why Local-First:**

- Low-latency UI updates
- Works offline
- Batch syncs to Convex on demand

---

## API Key & Configuration

**OpenAI API Key:**

- Stored in Zustand: `openAiApiKey: string`
- Persisted to localStorage/IndexedDB
- **Security note:** Stored client-side (not ideal for production—should use backend proxy)

**Model Used:**

- `gpt-5.2` (hardcoded constant in `aiAnalysis.ts`)

**Context Window:**

- 72 hours of logs included per analysis
- `CONTEXT_WINDOW_HOURS = 72`

---

## Pagination & Limits

| Query                        | Limit                       | Purpose                         |
| ---------------------------- | --------------------------- | ------------------------------- |
| `listBySyncKey` (logs)       | 300 (configurable 1-1000)   | Daily logs on Track page        |
| `listBySyncKeyRange` (logs)  | 5000 (configurable 1-20000) | 72-hour context for AI analysis |
| `listBySyncKey` (aiAnalyses) | 50 (configurable 1-200)     | Archive page history            |
| `useAiAnalysisHistory`       | 50                          | Track page latest report        |

---

## File Structure

```
convex/
  schema.ts                 # Table definitions
  aiAnalyses.ts             # AI analysis queries & mutations
  logs.ts                   # Log CRUD + profile
  profiles.ts               # (implicitly in logs.ts)
  foodLibrary.ts            # Food library CRUD
  validators.ts             # Shared validators
  migrations.ts             # Schema migrations (if needed)

src/
  store.ts                  # Zustand store with AI state
  lib/
    sync.ts                 # Frontend hooks for Convex sync
    aiAnalysis.ts           # GPT-5.2 prompt & analysis logic
    analysis.ts             # (legacy or complementary?)

  components/
    AiInsightsSection.tsx   # Track page AI display + reply input
    shared/
      DrPooReport.tsx       # Extracted report rendering components
    patterns/
      ReportArchive.tsx     # Patterns page recent reports preview
    archive/                # (Planned)
      ArchiveToolbar.tsx
      ArchiveReportCard.tsx

  pages/
    Track.tsx               # Main tracking page
    Archive.tsx             # (Planned) Full report archive + search
    landing/
    Settings.tsx
```

---

## Planned Enhancements (Archive Feature)

**Status:** In design/planning phase (6 implementation tasks)

### Changes to Schema

- Add `starred` field to `aiAnalyses` (optional boolean)
- No breaking changes

### New Convex Functions

- `toggleStar(id, syncKey)` — Star/unstar a report

### Frontend Changes

- New `/archive` route with full report browser
- Date picker → jump to specific day
- Keyword search (client-side, debounced)
- Star filter toggle
- Prev/next navigation with keyboard shortcuts
- Extract shared `DrPooReport` component
- Add archive links from Track and Patterns pages

### Client-Side Filtering

- Loads up to 50 reports, filters in-memory
- Searches: summary, suggestions, culprit foods, safe foods, meals, next food, mini challenge

---

## Key Insights About Current Design

### Strengths

1. **Flexible opaque storage** — `request`, `response`, `insight` as `v.any()` allows AI schema evolution without migrations
2. **Local-first resilience** — Works offline via IndexedDB + Zustand
3. **Conversation context** — Previous reports included in next analysis for continuity
4. **Rich structured insight** — `AiNutritionistInsight` is well-defined despite flexible storage
5. **Clean separation** — Logs, analyses, and user config are separate concerns

### Weaknesses

1. **No full-text search** — Cannot query insights at database level
2. **No food trial aggregation** — "3-trial rule" is stateless; no persistent food safety DB
3. **No reply persistence** — User messages to Dr. Poo are ephemeral
4. **Limited pagination** — Archive only loads 50 reports; cannot browse years of history
5. **Client-side API key** — Security risk; should use backend proxy
6. **No audit trail** — Cannot track data corrections or changes

---

## Usage Examples

### Example 1: Run AI Analysis

```typescript
// Frontend (src/lib/aiAnalysis.ts)
const result = await fetchAiInsights(
  apiKey,
  logs, // Last 72 hours of LogEntry[]
  previousReports, // Array<{ timestamp, insight }>
  patientMessages, // Array<{ text, timestamp }> (pending replies)
  healthProfile, // HealthProfile with surgery date, BMI, etc.
);

// Result: { insight, request, rawResponse, durationMs, inputLogCount }

// Store via Convex
await useAddAiAnalysis()({
  timestamp: Date.now(),
  request: result.request,
  response: result.rawResponse,
  insight: result.insight,
  model: "gpt-5.2",
  durationMs: result.durationMs,
  inputLogCount: result.inputLogCount,
});
```

### Example 2: Load Latest Report

```typescript
const latest = useQuery(api.aiAnalyses.latest, { syncKey });
// Returns: { id, timestamp, insight, starred, error, ... }

if (latest?.insight) {
  const insight = parseAiInsight(latest.insight);
  // Use insight.summary, suspectedCulprits, mealPlan, etc.
}
```

### Example 3: Archive Search

```typescript
// Client-side in Archive page
const matchesKeyword = (insight, keyword) => {
  const lower = keyword.toLowerCase();
  return (
    insight.summary.toLowerCase().includes(lower) ||
    insight.suggestions.some((s) => s.toLowerCase().includes(lower)) ||
    insight.suspectedCulprits.some((c) => c.food.toLowerCase().includes(lower))
    // ... etc
  );
};

const filtered = reports.filter(
  (r) =>
    matchesKeyword(r.insight, searchTerm) &&
    (!starFilter || r.starred) &&
    (!dateFilter || isSameDay(r.timestamp, dateFilter)),
);
```

---

## Summary Table

| Aspect               | Current                     | Planned                 | Notes                                              |
| -------------------- | --------------------------- | ----------------------- | -------------------------------------------------- |
| **Schema Stability** | Stable                      | Minimal changes         | Adding `starred` field only                        |
| **Search**           | Client-side in-memory       | No server-side yet      | Archive design allows future Convex search indexes |
| **Food Trials**      | In AI insight only          | Should add table        | 3-trial rule is stateless                          |
| **Replies**          | Local state only            | Should persist          | Currently lost on refresh                          |
| **History Depth**    | 50 reports                  | Unlimited (paginated)   | Archive page will load more on demand              |
| **Conversation**     | Previous reports in context | Could add message table | Current design supports incremental conversation   |
| **Timestamps**       | Unix ms                     | Consistent              | All time fields are ms since epoch                 |
| **User Isolation**   | Via `syncKey`               | Strong                  | All queries filtered by syncKey                    |
| **Data Validation**  | Convex validators           | Comprehensive           | Covers all log types and config                    |

---

## Next Steps (If Implementing Archive Feature)

1. **Task 1:** Add `starred` field to schema + `toggleStar` mutation
2. **Task 2:** Add `useToggleReportStar` hook in frontend
3. **Task 3:** Extract `DrPooReport` shared component
4. **Task 4:** Create `/archive` page with filtering and navigation
5. **Task 5:** Add archive links to Track and Patterns pages
6. **Task 6:** Polish, test, and merge

See `/docs/plans/2026-02-24-dr-poo-archive-plan.md` for detailed implementation steps.
