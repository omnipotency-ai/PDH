# Dr. Poo AI Analysis Data Model — Comprehensive Guide

**Last Updated:** 2026-02-24
**Project:** Caca Traca (Ostomy Recovery Tracker)

---

## Table of Contents

1. [Data Model Overview](#data-model-overview)
2. [Convex Schema](#convex-schema)
3. [AI Report Structure](#ai-report-structure)
4. [Message/Reply Storage](#messagereply-storage)
5. [Analysis Request/Response Formats](#analysis-requestresponse-formats)
6. [Current Searchability & Indexing](#current-searchability--indexing)
7. [Data Gaps & Recommendations](#data-gaps--recommendations)

---

## Data Model Overview

Dr. Poo is a conversational AI nutritionist that analyzes food/digestion logs and generates personalized recovery guidance. The system operates on a **3-layer architecture**:

```
┌──────────────────────────────────────────────────────────┐
│ FRONTEND: Zustand Store (IndexedDB persistent)           │
│  • drPooReplies[]     — Pending user messages            │
│  • aiInsight          — Latest report displayed          │
│  • aiAnalysisStatus   — "sending" | "receiving" | "done" │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ AI SERVICE: OpenAI GPT-5.2                               │
│  • Receives 72-hour log history                          │
│  • Accesses previous 5 reports for context               │
│  • Includes pending user replies                         │
│  • Returns structured JSON insight                       │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│ BACKEND: Convex Database (Cloud Sync)                    │
│  • aiAnalyses table   — All reports + metadata            │
│  • logs table         — Food, digestion, habits, etc.    │
│  • profiles table     — Health profile & habits          │
└──────────────────────────────────────────────────────────┘
```

---

## Convex Schema

### aiAnalyses Table

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts` (lines 27–41)

```typescript
aiAnalyses: defineTable({
  syncKey: v.string(), // User ID (per-session unique key)
  timestamp: v.number(), // When report was generated (ms)
  request: v.any(), // Full API request sent to OpenAI
  response: v.any(), // Raw JSON response from OpenAI
  insight: v.any(), // Parsed AiNutritionistInsight
  model: v.string(), // "gpt-5.2"
  durationMs: v.number(), // API call duration
  inputLogCount: v.number(), // Count of food + digestion logs analyzed
  error: v.optional(v.string()), // Error message if analysis failed
  starred: v.optional(v.boolean()), // Favorite flag (for archive)
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"]);
```

**Key Observations:**

- `request`, `response`, and `insight` are opaque (`v.any()`) — no schema validation inside them
- Single composite index `by_syncKey_timestamp` enables efficient newest-first queries
- `starred` field already exists for the upcoming archive feature (see `/docs/plans/2026-02-24-dr-poo-archive-design.md`)

**Related Tables** (for context):

```typescript
logs: defineTable({
  syncKey: v.string(),
  timestamp: v.number(),
  type: "food" | "fluid" | "habit" | "activity" | "digestion" | "weight",
  data: logDataValidator,  // Type-specific data payload
})
  .index("by_syncKey", ["syncKey"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"])

profiles: defineTable({
  syncKey: v.string(),
  unitSystem: "metric" | "imperial",
  habits: HabitConfig[],
  fluidPresets: string[],
  gamification: GamificationState,
  sleepGoal: SleepGoal,
  updatedAt: v.number(),
}).index("by_syncKey", ["syncKey"])
```

---

## AI Report Structure

### AiNutritionistInsight Type

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 65–77)

```typescript
export interface AiNutritionistInsight {
  suspectedCulprits: Array<{
    food: string; // e.g., "guacamole"
    confidence: "high" | "medium" | "low"; // Based on correlation strength
    reasoning: string; // Why this food is suspect
  }>;

  likelySafe: Array<{
    food: string; // e.g., "plain rice"
    reasoning: string; // Why this food is safe
  }>;

  mealPlan: Array<{
    meal: string; // e.g., "Breakfast (around 07:00)"
    items: string[]; // ["boiled egg", "toast", "banana"]
    reasoning: string; // Why these items for this meal
  }>;

  nextFoodToTry: {
    food: string; // Next recommended food to trial
    reasoning: string; // Clinical reasoning
    timing: string; // When to try it (e.g., "at lunch tomorrow")
  };

  miniChallenge: {
    // Optional mini challenge (gamification)
    challenge: string; // e.g., "bring smoke back to baseline for 3 days"
    duration: string; // e.g., "3 days"
  } | null;

  suggestions: string[]; // 1-5 actionable tips, e.g., [
  //   "Grab some water before lunch",
  //   "Try the new herb you mentioned"
  // ]

  summary: string; // Conversational summary (the main message)
}
```

### Request Payload Structure

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 465–505)

The user message sent to OpenAI is a JSON string containing:

```typescript
interface UserPayload {
  currentTime: string; // e.g., "Monday, February 24, 14:32"
  daysPostOp?: number; // Calculated from surgery date (if set)
  update: string; // "Here are my latest logs..." or "First check-in..."

  foodLogs: Array<{
    timestamp: number;
    time: string; // Formatted human-readable time
    items: Array<{
      name: string;
      canonicalName: string | null; // Mapped food from food library
      quantity: number | null;
      unit: string | null; // e.g., "g", "ml"
    }>;
    notes: string;
  }>;

  bowelEvents: Array<{
    timestamp: number;
    time: string;
    bristolCode: number | null; // Bristol Stool Scale 1-7
    consistency: string; // e.g., "mushy", "hard"
    urgency: string; // e.g., "high", "low"
    effort: string; // e.g., "straining", "easy"
    volume: string; // e.g., "large", "small"
    accident: boolean;
    episodes: number; // How many episodes
    notes: string;
  }>;

  // Optional sections (only included if data exists)
  habitLogs?: Array<{
    timestamp: number;
    time: string;
    habitId: string;
    name: string;
    habitType: string; // "cigarettes" | "medication" | "rec_drugs" | etc.
    quantity: number;
  }>;

  fluidLogs?: Array<{
    timestamp: number;
    time: string;
    fluidType: string;
    amountMl: number | null;
  }>;

  activityLogs?: Array<{
    timestamp: number;
    time: string;
    activityType: string;
    durationMinutes: number | null;
    feeling: string | null;
  }>;

  patientMessages?: Array<{
    message: string; // User's reply text
    sentAt: string; // Formatted time
  }>;
}
```

**Important:** Only the **last 72 hours** of logs are included (`CONTEXT_WINDOW_HOURS = 72` in aiAnalysis.ts).

### Chat Completion Message Chain

The full message history sent to OpenAI includes:

```typescript
ChatCompletionMessageParam[] = [
  {
    role: "system",
    content: <MASSIVE SYSTEM PROMPT>  // ~461 lines of clinical reasoning rules
  },
  // Previous reports (if any) — oldest first
  {
    role: "assistant",
    content: JSON.stringify({ report 1 insight })
  },
  {
    role: "assistant",
    content: JSON.stringify({ report 2 insight })
  },
  // ...up to 5 previous reports...
  // Current user data
  {
    role: "user",
    content: JSON.stringify(userPayload)
  }
]
```

**Context Window:** The system builds conversation context from the **last 5 successful reports** (filters out errors). This gives Dr. Poo awareness of trends and prevents repeating the same advice.

---

## Message/Reply Storage

### Pending Replies (Client-Side Only)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 205–207)

```typescript
// In Zustand store (IndexedDB persistence)
drPooReplies: DrPooReply[];      // Array of pending user messages
addDrPooReply: (text: string) => void;
clearDrPooReplies: () => void;
```

```typescript
export interface DrPooReply {
  text: string;
  timestamp: number;
}
```

**Lifecycle:**

1. User types a reply in the `ReplyInput` component (`AiInsightsSection.tsx` lines 91–151)
2. Reply is added to `drPooReplies[]` immediately (shows in a preview list)
3. When user triggers analysis (automatically or via "Send now"), replies are included in the request payload
4. After successful analysis, `clearDrPooReplies()` wipes the array
5. Replies are **NOT persisted to Convex** — only included in the current analysis request

**UI Representation:**

- Pending replies shown as small cards above the input field
- Each card displays timestamp and text
- "Will be included in the next report" notice
- "Send now" button to trigger immediate analysis

### Archived Messages (Not Currently Stored)

**Gap Identified:** User messages are NOT persisted after the analysis completes. This means:

- ✗ No conversation history available
- ✗ Cannot see what the user asked in past reports
- ✗ Cannot search past messages
- ✗ No audit trail for medical compliance

**Recommendation:** See [Data Gaps](#data-gaps--recommendations) section.

---

## Analysis Request/Response Formats

### What Gets Stored in Convex

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/aiAnalyses.ts` (lines 4–29)

```typescript
export const add = mutation({
  args: {
    syncKey: v.string(),
    timestamp: v.number(),
    request: v.any(), // Full ChatCompletionCreateParams
    response: v.any(), // Raw response string from OpenAI
    insight: v.any(), // Parsed AiNutritionistInsight
    model: v.string(), // "gpt-5.2"
    durationMs: v.number(),
    inputLogCount: v.number(),
    error: v.optional(v.string()),
  },
  // Stores exactly as provided
});
```

### Request Object Structure

What's stored in `request` field:

```typescript
{
  model: "gpt-5.2",
  messages: [
    {
      role: "system" | "assistant" | "user",
      content: string  // Full text (JSON for structured payloads)
    }
  ]
}
```

**Note:** The `request` includes full message history (system prompt + previous reports + current logs).

### Response Object Structure

What's stored in `response` field:

Raw JSON string from OpenAI's API response, e.g.:

```json
{
  "suspectedCulprits": [
    {
      "food": "guacamole",
      "confidence": "high",
      "reasoning": "Eaten 4 hours before Bristol 7 event, high fat content..."
    }
  ],
  "likelySafe": [...],
  "mealPlan": [...],
  "nextFoodToTry": {...},
  "miniChallenge": null,
  "suggestions": [...],
  "summary": "Great progress this week..."
}
```

---

## Current Searchability & Indexing

### What's Indexed

| Table        | Index                  | Strategy                                   |
| ------------ | ---------------------- | ------------------------------------------ |
| `aiAnalyses` | `by_syncKey`           | Fast user-specific lookup                  |
| `aiAnalyses` | `by_syncKey_timestamp` | **Enables efficient newest-first queries** |
| `logs`       | `by_syncKey`           | User-specific lookup                       |
| `logs`       | `by_syncKey_timestamp` | Range queries for time windows             |

### Current Query Capabilities

**Convex Functions** (`/Users/peterjamesblizzard/projects/caca_traca/convex/aiAnalyses.ts`):

```typescript
// Query: Get N most recent reports
listBySyncKey(syncKey: string, limit?: number)
  // Returns: { id, timestamp, model, durationMs, inputLogCount, insight, error, starred }
  // Uses by_syncKey_timestamp index, orders desc (newest first)
  // Max 200, default 50

// Query: Get single latest report
latest(syncKey: string)
  // Returns: Latest report (or null if none)

// Mutation: Toggle star
toggleStar(id: Id<"aiAnalyses">, syncKey: string)
  // Updates starred field

// Mutation: Store new analysis
add({ syncKey, timestamp, request, response, insight, ... })
```

### What's NOT Searchable

| Data                   | Current State   | Issue                                                                |
| ---------------------- | --------------- | -------------------------------------------------------------------- |
| Food names in reports  | Not indexed     | Advice contains foods from `suspectedCulprits.food` but no FTS index |
| Suggestions            | Not indexed     | Can't search "try new herb" across reports                           |
| Summary text           | Not indexed     | No full-text search on Dr. Poo's messages                            |
| User messages          | Not stored      | Messages don't persist at all                                        |
| Report errors          | Only by-syncKey | Can't query "all failed reports" globally                            |
| Report quality metrics | Not tracked     | No metrics like: word count, mood, etc.                              |

### Archive Feature Additions (Planned)

From `/docs/plans/2026-02-24-dr-poo-archive-design.md`:

```typescript
// New Convex function (to be added)
listPaginated(syncKey: string, cursor?: string, limit?: number)
  // Returns: { reports: [...], nextCursor: string | null }

// New hook (to be added)
useAiAnalysisHistoryPaginated(limit?: number)
  // Cursor-based pagination for archive page
```

**Client-side filtering** (no backend search):

- Keywords matched in: summary, suggestions, suspectedCulprits[].food, likelySafe[].food, mealPlan[].meal, nextFoodToTry.food, miniChallenge.challenge
- Debounced 300ms to avoid excessive filtering
- Star filter: separate toggle to show only ⭐ reports

---

## Data Gaps & Recommendations

### Gap 1: No Persistent Message History

**Current State:**

- User replies stored only in Zustand store (IndexedDB)
- Cleared after analysis
- Not sent to Convex

**Impact:**

- Can't review what the user asked in past reports
- No conversation thread visible in archive
- Medical audit trail incomplete

**Recommendation:**

```typescript
// Add new table: drPooMessages
drPooMessages: defineTable({
  syncKey: v.string(),
  analysisId: v.id("aiAnalyses"), // Foreign key to report
  role: "user", // Future: could support assistant replies too
  text: string,
  timestamp: v.number(),
  includedInAnalysis: v.boolean(), // Whether this message was in the request
})
  .index("by_syncKey", ["syncKey"])
  .index("by_analysis", ["analysisId"])
  .index("by_syncKey_timestamp", ["syncKey", "timestamp"]);
```

Then modify `useAddAiAnalysis()` to also store the messages.

---

### Gap 2: No Full-Text Search on Report Content

**Current State:**

- Only newest-first listing available
- Archive filtering is client-side only
- Can't query backend for "all reports mentioning pasta"

**Impact:**

- Users must manually browse reports to find patterns
- Can't build analytics on food triggers
- Archive page scales linearly with loaded report count

**Recommendation:**

```typescript
// Option A: Add searchable text field to aiAnalyses table
aiAnalyses: defineTable({
  // ... existing fields ...
  searchableText: v.string(), // Concatenated: foods + suggestions
})
  // Then index it:
  .index("by_syncKey_text", ["syncKey", "searchableText"]);

// Populate in add mutation:
searchableText: [
  ...insight.suspectedCulprits.map((c) => c.food),
  ...insight.likelySafe.map((s) => s.food),
  ...insight.suggestions,
  insight.summary,
  // Previous user messages (if stored)
]
  .join(" ")
  .toLowerCase();

// Query with prefix matching:
db.query("aiAnalyses").withIndex(
  "by_syncKey_text",
  (q) =>
    q
      .eq("syncKey", userSyncKey)
      .gt("searchableText", "pasta")
      .lt("searchableText", "pastaz"), // Prefix range
);
```

**Alternative:** Elasticsearch or Typesense for more powerful FTS (but adds complexity).

---

### Gap 3: No Report Metadata for Analytics

**Current State:**

- Only timestamps, durations, and error flags tracked
- No quality or content metrics

**Impact:**

- Can't identify patterns: "reports with high culprit count tend to have X"
- Can't measure report "drift" over time
- No way to track if recommendations are getting more specific

**Recommendation:**

```typescript
aiAnalyses: defineTable({
  // ... existing fields ...

  // Content metrics (computed at analysis time)
  culpritCount: v.number(), // insight.suspectedCulprits.length
  safeCount: v.number(),
  suggestionsCount: v.number(),
  mealPlanCount: v.number(),
  hasMiniChallenge: v.boolean(),
  summaryLength: v.number(), // Character count

  // Flags
  isFollowUp: v.boolean(), // Has previous reports?
  analysisInputTypes: v.array(v.string()), // ["food", "digestion", "habit"]
});
```

---

### Gap 4: No User Feedback on Reports

**Current State:**

- Starred flag exists but nothing else
- No way to track: "was this advice helpful?"
- No thumbs up/down, ratings, or follow-up questions

**Impact:**

- Can't measure report quality
- No feedback loop to improve prompt engineering
- Users can't annotate their own recovery journey

**Recommendation:**

```typescript
// Add table: reportFeedback
reportFeedback: defineTable({
  syncKey: v.string(),
  analysisId: v.id("aiAnalyses"),
  rating: v.union(
    v.literal(1), // "not helpful"
    v.literal(2), // "somewhat"
    v.literal(3), // "helpful"
    v.literal(4), // "very helpful"
    v.literal(5), // "transformative"
  ),
  feedback: v.string(), // Optional user comment
  timestamp: v.number(),
})
  .index("by_analysis", ["analysisId"])
  .index("by_syncKey", ["syncKey"]);
```

---

### Gap 5: No Tracking of Recommendation Outcomes

**Current State:**

- Dr. Poo suggests foods to try, but no way to see if the user actually tried them
- "Next food to try" is advisory only

**Impact:**

- Recommendations can't be validated against actual behavior
- No way to track which suggestions were followed

**Recommendation:**

```typescript
// Add table: foodTrials (or extend foodLibrary)
foodTrials: defineTable({
  syncKey: v.string(),
  suggestedInAnalysis: v.id("aiAnalyses"), // Which report suggested it
  suggestedFood: v.string(), // What was suggested
  actuallyTriedAt: v.optional(v.number()), // When (if) they tried it
  actualLog: v.optional(v.id("logs")), // Link to food log entry
  outcome: v.union(
    v.literal("not_tried"),
    v.literal("tried_safe"),
    v.literal("tried_triggered"),
    v.literal("pending"),
  ),
  notes: v.optional(v.string()),
})
  .index("by_syncKey", ["syncKey"])
  .index("by_analysis", ["suggestedInAnalysis"]);
```

---

### Gap 6: No Version Tracking for Prompt Changes

**Current State:**

- System prompt is hardcoded in aiAnalysis.ts
- If prompt changes, old reports can't be regenerated with new reasoning
- No way to A/B test prompt variations

**Recommendation:**

```typescript
// Add table: promptVersions
promptVersions: defineTable({
  versionId: v.string(), // e.g., "v1.2.3-2026-02-24"
  systemPrompt: v.string(), // Full prompt content
  description: v.string(), // "Added Bristol 6 nuance"
  createdAt: v.number(),
  isActive: v.boolean(),
})
  .index("by_versionId", ["versionId"])
  .index("by_active", ["isActive"]);

// In aiAnalyses, track which version was used:
aiAnalyses: defineTable({
  // ... existing fields ...
  promptVersion: v.string(), // FK to promptVersions.versionId
});
```

---

## Summary Table: What's Stored vs. Not Stored

| Data                    | Stored  | Where                                     | Searchable                   | Notes                         |
| ----------------------- | ------- | ----------------------------------------- | ---------------------------- | ----------------------------- |
| **Report Insight**      | ✓       | Convex `aiAnalyses.insight`               | Partially (client-side only) | Full structure, no validation |
| **User Messages**       | ✗       | —                                         | —                            | Gap: Lost after analysis      |
| **System Prompt**       | ✗       | aiAnalysis.ts (hardcoded)                 | —                            | Gap: No version tracking      |
| **API Request**         | ✓       | Convex `aiAnalyses.request`               | ✗                            | Audit trail only              |
| **API Response**        | ✓       | Convex `aiAnalyses.response`              | ✗                            | Raw JSON blob                 |
| **Food Suggestions**    | ✓       | Convex `aiAnalyses.insight.nextFoodToTry` | ✗                            | No outcome tracking           |
| **Meal Plans**          | ✓       | Convex `aiAnalyses.insight.mealPlan`      | ✗                            | No completion tracking        |
| **Suspects/Safe Foods** | ✓       | Convex `aiAnalyses.insight`               | Partially                    | No search index               |
| **User Feedback**       | Partial | Convex `aiAnalyses.starred`               | ✗                            | Only binary star; no ratings  |
| **Report Metadata**     | Partial | Convex (timestamp, model, duration)       | —                            | Missing quality metrics       |

---

## Architecture Diagram: Full Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER INTERFACE                             │
│  Track Page / Archive Page / Settings                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ZUSTAND STORE (IndexedDB)                      │
│                                                                   │
│  • logs: LogEntry[]           [local-first data]                 │
│  • profiles: SyncedProfile    [local config]                     │
│  • aiInsight: AiNutritionistInsight [latest report display]     │
│  • drPooReplies: DrPooReply[] [pending messages]                │
│  • aiAnalysisStatus: "idle" | "sending" | "receiving" | "error" │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SYNC LAYER (Convex Hooks)                     │
│                                                                   │
│  useAddSyncedLog()                                               │
│  useRemoveSyncedLog()                                            │
│  useUpdateSyncedLog()                                            │
│  useAddAiAnalysis()           ← Stores reports                   │
│  useAiAnalysisHistory()       ← Retrieves reports                │
│  useToggleReportStar()                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CONVEX BACKEND (Cloud DB)                     │
│                                                                   │
│  aiAnalyses                                                      │
│  ├─ id, syncKey, timestamp                                       │
│  ├─ request, response, insight                                   │
│  ├─ model, durationMs, inputLogCount                             │
│  ├─ error (optional)                                             │
│  └─ starred (optional) ← for archive feature                     │
│                                                                   │
│  logs                                                            │
│  ├─ id, syncKey, timestamp, type                                 │
│  └─ data (opaque type-specific payload)                          │
│                                                                   │
│  profiles, foodLibrary, waitlistEntries                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  OpenAI API  │   │  Google API  │   │   Clerk      │
│  (GPT-5.2)   │   │  (Image Anal)│   │  (Auth)      │
│  Nutrition   │   │              │   │              │
│  Analysis    │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

---

## File References

### Core Files

- **Schema:** `/convex/schema.ts`
- **AI Analyses API:** `/convex/aiAnalyses.ts`
- **Analysis Logic:** `/src/lib/aiAnalysis.ts`
- **Store Types & State:** `/src/store.ts`
- **Sync Hooks:** `/src/lib/sync.ts`
- **UI Components:**
  - `/src/components/AiInsightsSection.tsx` (main report display + reply input)
  - `/src/components/shared/DrPooReport.tsx` (report rendering shared component)
  - `/src/hooks/useAiInsights.ts` (analysis trigger logic)

### Migrations

- **Data Normalization:** `/convex/migrations.ts` (legacy log fixing)
- **Archive Design:** `/docs/plans/2026-02-24-dr-poo-archive-design.md`

---

## Key Takeaways

1. **Report Storage:** Full insights, requests, and responses stored in Convex as opaque JSON blobs. Highly flexible but not searchable.

2. **Message Storage:** User replies NOT persisted after analysis—only included in the request payload. This is a significant gap for conversation history.

3. **Searchability:** Only newest-first query available. Archive will add client-side search, but backend has no FTS.

4. **Context Window:** Each report references the last 5 previous reports + last 72 hours of logs. No deeper historical context.

5. **Gamification:** Side quests stored in the `miniChallenge` field, but no tracking of whether users complete them.

6. **Future Work:** Archive feature (planned) will add pagination, starring, and client-side filtering. Consider implementing persistent messages, FTS, outcome tracking, and feedback loop.
