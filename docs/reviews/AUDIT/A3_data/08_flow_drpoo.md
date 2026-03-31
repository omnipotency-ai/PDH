# Flow Trace: Dr. Poo Report Generation

## Trigger

There are **two entry points** that initiate a Dr. Poo report:

### 1. Automatic trigger: Bowel movement log (background)

- **Component:** `src/pages/Track.tsx` line 321
- **Action:** User submits a bowel movement via `handleLogBowel()`. After the log is saved, if the `bmTriggersAnalysis` toggle is true, `triggerAnalysis(timestamp)` is called.
- **Debounce:** `triggerAnalysis` (line 318 of `src/hooks/useAiInsights.ts`) performs a data-aware debounce: it skips the call if no new bowel data exists since the last analysis AND less than 60 seconds (`DEBOUNCE_MS`) have elapsed. If there IS new data, it proceeds to `runAnalysis()`.

### 2. Manual trigger: "Send now" button or asking Dr. Poo

- **Component:** `src/components/track/dr-poo/ReplyInput.tsx` line 31 -- user types a message and presses Enter or taps Send. This calls `addReply(trimmed)` which writes a `conversations` row (role `"user"`, no `aiAnalysisId` yet) via Convex mutation `api.conversations.addUserMessage`.
- **Component:** `src/components/track/dr-poo/ReplyInput.tsx` line 71 -- if pending replies exist, a "Send now" button appears. Clicking it calls `onSendNow()`.
- **Wiring:** `onSendNow` is passed from `Track.tsx` line 549 (`<AiInsightsSection onSendNow={sendNow} />`) through to `ConversationPanel` (line 109 in `AiInsightsSection.tsx`) and down to `ReplyInput` (line 184 in `ConversationPanel.tsx`).
- **Resolution:** `sendNow` is `runAnalysis` returned from `useAiInsights()` at `Track.tsx` line 102.

---

## Happy Path

### Step 1: `useAiInsights()` hook gathers reactive data

**File:** `src/hooks/useAiInsights.ts` (lines 58-344)

The hook subscribes to all data needed for the report via Convex reactive queries and Zustand state:

| Data source          | Hook/query                                 | Purpose                                                                  |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| API key              | `useApiKeyContext()` line 59               | User's OpenAI key from IndexedDB                                         |
| Convex action        | `useAction(api.ai.chatCompletion)` line 60 | Relay for OpenAI calls                                                   |
| Logs                 | `useSyncedLogsContext()` line 69           | All user log entries (food, bowel, habit, fluid, activity, reproductive) |
| Analysis history     | `useAiAnalysisHistory(500)` line 72        | Last 500 reports for educational insight dedup                           |
| Latest success       | `useLatestSuccessfulAiAnalysis()` line 73  | For debounce comparison                                                  |
| Food trials          | `useAllFoodTrials()` line 84               | Food trial summaries from `foodTrialSummary` table                       |
| Weekly digests       | `useWeeklyDigests(4)` line 86              | Last 4 weeks of aggregate stats                                          |
| Conversation history | `useConversationsByDateRange()` line 99    | Current half-week messages                                               |
| Recent suggestions   | `useSuggestionsByDateRange()` line 102     | Suggestion spaced-repetition tracking                                    |
| Weekly summary       | `useLatestWeeklySummary()` line 104        | Prior half-week narrative recap                                          |
| Health profile       | `useHealthProfile()` line 63               | Surgery date, conditions, meds, lifestyle, reproductive health           |
| AI preferences       | `useAiPreferences()` line 64               | Tone, length, format, model, meal schedule                               |
| Baseline averages    | Zustand `state.baselineAverages` line 65   | Today vs. historical baselines for habits/fluids                         |
| Pending replies      | `usePendingReplies()` line 62              | Unclaimed user messages in `conversations` table                         |
| Pane summaries       | Zustand `state.paneSummaryCache` line 170  | Habit-digestion correlation insights                                     |

All these are kept in a `dataRef` (lines 113-138) so the `runAnalysis` callback always reads the freshest values.

### Step 2: `runAnalysis()` starts (line 140)

1. **Guard checks** (lines 141-143): bail if no API key or if a request is already in flight (`loadingRef`).
2. **Abort controller** (lines 146-149): creates a new `AbortController`, sets `loadingRef.current = true`.
3. **Status update** (line 151): `setAiAnalysisStatus("sending")` -- Zustand store updates, UI shows `AnalysisProgressOverlay` with "Sending logs to AI..." spinner.
4. **Snapshot pending replies** (line 154): captures current pending reply text before the delay.
5. **Reactive delay** (line 157): waits 1500ms (`REACTIVE_DELAY_MS`) for Convex reactive queries to include the just-logged entry.
6. **Fresh data read** (lines 160-167): reads `dataRef.current.logs`. Checks that either bowel context exists OR the user asked a question. If neither, sets status to `"error"` with message and exits.
7. **Habit correlation extraction** (lines 170-187): reads `paneSummaryCache` from Zustand for water/walk/sleep/destructive correlation insights.
8. **Build previous reports** (lines 190-198): filters analysis history to only successful reports with non-null insights, maps to `PreviousReport[]`.

### Step 3: Call `fetchAiInsights()` (line 204)

**File:** `src/lib/aiAnalysis.ts` (line 1631)

**Signature:**

```typescript
fetchAiInsights(
  callAi: ConvexAiCaller,
  apiKey: string,
  logs: LogEntry[],
  previousReports: PreviousReport[],
  patientMessages: DrPooReply[],
  healthProfile: HealthProfile,
  enhancedContext?: EnhancedAiContext,
  aiPreferences?: AiPreferences,
): Promise<AiAnalysisResult>
```

**Sub-steps:**

1. **Rate limit check** (line 1641): `checkRateLimit()` from `src/lib/aiRateLimiter.ts`. Currently a no-op (MIN_CALL_INTERVAL_MS = 0), kept as a hook for future token-budget throttling.

2. **Input sanitization** (lines 1642-1659): All inputs pass through `sanitizeUnknownStringsDeep()` from `src/lib/inputSafety.ts` to enforce max string lengths and strip dangerous content.

3. **Build log context** (line 1661): `buildLogContext(safeLogs)` (line 323) filters logs to last 72 hours (`CONTEXT_WINDOW_HOURS`), then separates and formats into typed arrays: `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `activityLogs`, `reproductiveLogs`. Each includes human-readable timestamps.

4. **Model validation** (line 1680): `getValidInsightModel(prefs.aiModel)` resolves the user's chosen model (default: `"gpt-5.4"`) with legacy alias support.

5. **Build system prompt** (line 1682): `buildSystemPrompt(safeHealthProfile, prefs)` (line 622) constructs a massive system prompt (~1200 lines in the source) containing:
   - Patient profile (surgery type/date, demographics, weight/height/BMI, comorbidities, medications, supplements, allergies, intolerances, lifestyle factors including smoking/alcohol/recreational detail, reproductive health)
   - Tone matrix selection based on `approach` x `register` preferences (9 combinations: supportive/personal/analytical x everyday/mixed/clinical)
   - Preferred name usage
   - Response priority rules
   - User request override (highest priority -- fulfil patient questions even if they conflict with format/length constraints)
   - The "Prime Directive": Dr. Poo is a clinical detective, not a calculator
   - Baseline comparison usage instructions
   - Deductive reasoning framework (7 sections: modifier assessment, safe/trigger matrix, weighted food evidence model, food naming contract, weekly trends, conversation awareness, satiety/expansion)
   - Bristol stool interpretation for post-anastomosis patients
   - Stalled transit detection
   - Meal planning rules (optional, de-emphasised)
   - Autonomy & Trade-Off Engine (8 rules for lifestyle-gut balance)
   - Mini challenge gamification rules
   - Habit-digestion correlation insight integration
   - Time awareness
   - Complete JSON output schema with field-by-field rules
   - Structure and length preference directives

6. **Build conversation history** (lines 1692-1703): Appends up to 20 most recent messages from the current half-week as alternating user/assistant messages. No fallback to old periods -- the weekly summary in the user payload provides historical context.

7. **Build user message payload** (line 1746): `buildUserMessage()` (line 1275) constructs a JSON payload containing:
   - `currentTime`, `daysPostOp`
   - `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `activityLogs`
   - `cycleHormonalLogs` (if reproductive tracking enabled)
   - `reproductiveHealthContext` (cycle day, gestational age, etc.)
   - `patientMessages` (user replies, or explicit "NONE" marker)
   - `recentSuggestionHistory` (grouped by text with repeat counts)
   - `foodTrialDatabase` (up to 50 most recently assessed foods with status, tendency, confidence, transit calibration)
   - `weeklyTrends` (last 4 weeks of aggregate data)
   - `previousWeekRecap` (last weekly summary narrative, key foods, carry-forward notes)
   - `habitCorrelationInsights` (water/walk/sleep/destructive correlations)
   - `baselineComparison` (today vs. historical averages for habits and fluids)

8. **Token estimate warning** (lines 1768-1778): Estimates tokens (~chars/4) and logs a warning if over 50,000.

9. **API call** (lines 1780-1793): Calls `callAi()` which is `useAction(api.ai.chatCompletion)` -- a Convex action.

### Step 4: Convex action `chatCompletion` relays to OpenAI

**File:** `convex/ai.ts` (lines 17-67)

1. **Auth check** (line 36): `requireAuth(ctx)` verifies the Convex user identity.
2. **API key validation** (line 37): Regex check (`/^sk-[A-Za-z0-9_-]{20,}$/`) -- rejects malformed keys.
3. **OpenAI client** (lines 41-42): Dynamically imports `openai`, creates client with the transiently-provided key (never stored server-side).
4. **Chat completion** (lines 44-54): Calls `client.chat.completions.create()` with the model, messages, temperature, max_tokens, and `response_format: { type: "json_object" }`.
5. **Return** (lines 56-65): Returns `{ content, usage }` to the client.

### Step 5: Response parsing and enrichment (back in `fetchAiInsights`)

**File:** `src/lib/aiAnalysis.ts` (lines 1794-1829)

1. **Duration measurement** (line 1794): `performance.now()` delta.
2. **JSON parse** (lines 1796-1801): Parses `rawContent`. Throws if invalid JSON.
3. **Structured parse** (line 1803): `parseAiInsight(parsed)` (line 1441) validates and normalizes every field of the AI response into a typed `AiNutritionistInsight`. Missing/malformed fields get safe defaults (e.g., default "Plain white rice" for `nextFoodToTry`).
4. **Force null directResponse** (lines 1809-1812): If no patient messages were pending, forces `directResponseToUser = null` regardless of what the model returned.
5. **Educational insight dedup** (line 1814): `enforceNovelEducationalInsight()` checks against all previous reports' educational insights. If the model returned a duplicate, picks a fallback from the local `FALLBACK_EDUCATIONAL_INSIGHTS` bank (10 entries covering meal volume, hydration timing, gastrocolic reflex, stool form, sleep, food re-testing, fat load, fiber transitions, context matters, pattern confidence).
6. **Truncation for storage** (lines 1816-1821): Messages are truncated to `INPUT_SAFETY_LIMITS.aiPayloadString` length for Convex storage.
7. **Return** (lines 1823-1829): Returns `{ insight, request, rawResponse, durationMs, inputLogCount }`.

### Step 6: Store results in Convex (back in `runAnalysis`)

**File:** `src/hooks/useAiInsights.ts` (lines 256-292)

1. **Mark baseline consumed** (line 258): `markInsightRun()` -- Zustand records that the current baseline data has been used.
2. **Save analysis** (line 261): `addAiAnalysis()` calls `api.aiAnalyses.add` mutation.

**File:** `convex/aiAnalyses.ts` (lines 11-47)

- Inserts into `aiAnalyses` table: `userId`, `timestamp`, `request`, `response`, `insight`, `model`, `durationMs`, `inputLogCount`.
- Returns the new document `Id<"aiAnalyses">`.
- **Async extraction** (lines 38-44): Schedules `internal.extractInsightData.extractFromReport` to run immediately (non-blocking). This extracts:
  - **Food assessments** into `foodAssessments` table (canonical names, verdicts, confidence, reasoning).
  - **Suggestions** into `reportSuggestions` table (text, normalized text, position).
  - Then schedules `computeAggregates.updateFoodTrialSummary` and `computeAggregates.updateWeeklyDigest`.

### Step 7: Claim pending replies (line 271)

`claimPendingReplies({ aiAnalysisId })` calls `api.conversations.claimPendingReplies` mutation.

**File:** `convex/conversations.ts` (lines 158-178)

Finds all recent user messages with no `aiAnalysisId` and patches them to link to this analysis. This is how pending replies get "consumed" and stop appearing in the pending list.

### Step 8: Save assistant messages (lines 273-281)

If the insight has a `summary`, saves it as an assistant conversation message linked to the analysis ID. If it has a `directResponseToUser`, saves that as a second assistant message. Both use `api.conversations.addAssistantMessage`.

### Step 9: Status update to "done" (line 284)

`setAiAnalysisStatus("done")` -- Zustand updates, UI shows checkmark for 2 seconds (managed by `AiInsightsSection` lines 41-51) then resets to idle.

### Step 10: Display

The `AiInsightsSection` component (line 18) reactively reads the latest successful analysis via `useLatestSuccessfulAiAnalysis()`. When a new successful analysis appears:

1. **Summary + conversation** appear in `ConversationPanel` (messages timeline with assistant/user bubbles rendered as Markdown).
2. **Full report** appears in `AiInsightsBody` which renders `DrPooReportDetails` inside a collapsible.

**`DrPooReportDetails`** (`src/components/archive/DrPooReport.tsx` line 84) renders 9 sections in order:

1. Clinical reasoning (collapsible)
2. Suspected culprits + likely safe (side-by-side accordions with confidence badges)
3. Meal ideas (if populated; default empty)
4. Next food to try
5. Did You Know? (educational insight)
6. Suggestions (markdown)
7. Mini challenge (if present)
8. AI disclaimer
9. Lifestyle experiment status (adapted/broken/testing/rewarding)

**Archive page** (`src/pages/secondary_pages/Archive.tsx`) shows historical reports with pagination, star/filter controls, and `DrPooFullReport` which adds the summary and `directResponseToUser` above the details.

---

## Error/Fallback Branches

### At Step 2 (line 141): No API key

- `runAnalysis` returns immediately. No error shown -- the UI already shows the "Add your OpenAI API key in Settings" empty state (AiInsightsSection lines 116-122).

### At Step 2 (line 143): Request already in flight

- `runAnalysis` returns immediately (loadingRef guard). Silent skip.

### At Step 2 (lines 163-167): No bowel data AND no user question

- Sets `aiAnalysisStatus` to `"error"` with message "Log a bowel movement or send a question first."
- `AnalysisProgressOverlay` renders the error with Dismiss and Try Again buttons.

### At Step 4 (convex/ai.ts line 37): Invalid API key format

- Throws `"Invalid OpenAI API key format."` -- caught at Step 5 catch block.

### At Step 4 (convex/ai.ts line 36): Not authenticated

- Throws `"Not authenticated"` -- caught at Step 5 catch block.

### At Step 4 (OpenAI API error): API call failure

- `callAi()` throws -- caught at `fetchAiInsights` line 1791, re-thrown as `"AI nutritionist request failed: <message>"`.

### At Step 5 (line 1800): Invalid JSON from AI

- Throws `"AI nutritionist returned invalid JSON: <first 200 chars>"`.

### At Step 5 (line 1806): Unexpected response structure

- `parseAiInsight` returns null, throws `"AI nutritionist returned an unexpected response structure."`.

### At Step 6 (lines 294-311): Main catch block in `runAnalysis`

- Logs error to console.
- Sets `aiAnalysisStatus` to `"error"` with the error message.
- **Saves error record to Convex** (lines 301-310): Inserts an `aiAnalyses` row with `insight: null`, `request: null`, `response: null`, and the `error` string. This preserves the failure in history. Note: `extractInsightData` is NOT scheduled for error reports (guarded at `aiAnalyses.ts` line 38).

### At Step 6 (lines 286-292): Save failure after successful AI call

- Catches separately -- logs `"Failed to save analysis"`, sets status to `"error"`, shows toast notification via `sonner`.

### At Step 9 (AiInsightsSection line 34-37): Retry on error

- `handleRetry()` resets status to idle and calls `onSendNow()` again.

---

## Data Flow

### Input

- **Log entries** (last 72 hours): food, bowel, habit, fluid, activity, reproductive -- from `logs` table via Convex reactive query.
- **Health profile**: surgery details, demographics, conditions, medications, lifestyle, reproductive health -- from user profile in Convex.
- **AI preferences**: approach (supportive/personal/analytical), register (everyday/mixed/clinical), output format (narrative/mixed/structured), output length (concise/standard/detailed), model selection, meal schedule, preferred name, location/timezone.
- **Food trial database**: up to 50 most recently assessed foods with verdicts, confidence, transit calibration.
- **Conversation history**: current half-week user/assistant messages from `conversations` table.
- **Previous reports**: up to 500 past analyses for educational insight dedup.
- **Weekly digests**: last 4 weeks of aggregate stats (avg Bristol, BM count, accidents, food variety).
- **Weekly summary**: narrative recap of prior half-week conversations with key foods and carry-forward notes.
- **Pending user replies**: unclaimed messages in `conversations` table.
- **Baseline averages**: today vs. historical habit/fluid averages with deltas.
- **Habit correlation insights**: water/walk/sleep/destructive correlation summaries from pane summary cache (Zustand).
- **Recent suggestions**: from `reportSuggestions` table, grouped by text with repeat counts for spaced-repetition tracking.

### Processing

1. Logs filtered to 72-hour window and categorized by type.
2. All inputs sanitized via `sanitizeUnknownStringsDeep()`.
3. System prompt constructed (~4000+ words) with patient context, clinical rules, tone matrix, and JSON schema.
4. Conversation history (up to 20 messages) added as chat turns.
5. User message payload assembled as JSON with all data sources.
6. Sent to OpenAI (default gpt-5.4) via Convex action relay with `response_format: json_object`.
7. Response parsed into `AiNutritionistInsight` with safe defaults for missing fields.
8. Educational insight deduplication against 500 previous reports.
9. `directResponseToUser` forced to null when no patient messages existed.

### Output (stored in Convex `aiAnalyses` table)

- `timestamp`: when the analysis was created.
- `request`: the full system + user + conversation messages (truncated).
- `response`: raw AI JSON response (truncated).
- `insight`: parsed `AiNutritionistInsight` object with all structured fields.
- `model`: which OpenAI model was used.
- `durationMs`: wall-clock time for the API call.
- `inputLogCount`: number of log entries sent.

### Async extraction (from `extractInsightData.extractFromReport`)

- `foodAssessments` table: individual food verdicts (canonicalized names, verdicts, confidence, causal role, change type, modifier summary, reasoning).
- `reportSuggestions` table: individual suggestion strings (text, normalized, position).
- Triggers `computeAggregates.updateFoodTrialSummary` and `computeAggregates.updateWeeklyDigest`.

### Conversation records

- `conversations` table: assistant messages (summary and/or directResponseToUser) linked to the analysis ID.
- Pending user replies patched with the analysis ID via `claimPendingReplies`.

---

## Files Involved

### UI Layer (React components)

| File                                                             | Purpose                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Track.tsx`                                            | Page host. Wires `useAiInsights`, passes `sendNow` and calls `triggerAnalysis` after BM logs.                                 |
| `src/components/track/dr-poo/AiInsightsSection.tsx`              | Dr. Poo card. Shows progress overlay, conversation panel, report body, and empty states.                                      |
| `src/components/track/dr-poo/ConversationPanel.tsx`              | Scrollable message timeline. Renders user/assistant messages with markdown, period summaries, and optimistic pending replies. |
| `src/components/track/dr-poo/ReplyInput.tsx`                     | Text input for user messages. "Send now" button. Character limit (2500).                                                      |
| `src/components/track/dr-poo/AiInsightsBody.tsx`                 | Collapsible report details wrapper with copy and archive links.                                                               |
| `src/components/archive/DrPooReport.tsx`                         | `DrPooReportDetails` (9-section report renderer) and `DrPooFullReport` (Archive page variant).                                |
| `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx` | Inline progress indicator (sending/receiving/done/error).                                                                     |
| `src/components/archive/ai-insights/MealIdeaCard.tsx`            | Individual meal idea card renderer.                                                                                           |
| `src/pages/secondary_pages/Archive.tsx`                          | Report archive page with pagination, star filter, date picker.                                                                |

### Hooks and State

| File                             | Purpose                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useAiInsights.ts`     | Orchestrates the entire flow. `triggerAnalysis` (debounced) and `sendNow` (immediate).                                                 |
| `src/hooks/usePendingReplies.ts` | Convex-backed pending replies (unclaimed user messages).                                                                               |
| `src/hooks/useApiKey.ts`         | Loads/saves OpenAI API key from IndexedDB.                                                                                             |
| `src/contexts/ApiKeyContext.tsx` | React context wrapper for `useApiKey`.                                                                                                 |
| `src/store.ts`                   | Zustand store: `aiAnalysisStatus`, `aiAnalysisError`, `setAiAnalysisStatus`, `markInsightRun`, `baselineAverages`, `paneSummaryCache`. |

### AI / Business Logic

| File                        | Purpose                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/aiAnalysis.ts`     | Core AI module (~1830 lines). System prompt construction, user message payload building, log context parsing, response parsing (`parseAiInsight`), educational insight dedup, `fetchAiInsights` main export.                      |
| `src/lib/aiModels.ts`       | Model configuration. `INSIGHT_MODEL_OPTIONS` (gpt-5.4, gpt-5-mini), validation, legacy aliases.                                                                                                                                   |
| `src/lib/aiRateLimiter.ts`  | Rate limit guard (currently disabled, kept for future token-budget throttling).                                                                                                                                                   |
| `src/lib/convexAiClient.ts` | TypeScript type definition for the Convex AI action caller.                                                                                                                                                                       |
| `src/lib/apiKeyStore.ts`    | IndexedDB persistence for OpenAI API key (get/set/clear via `idb-keyval`).                                                                                                                                                        |
| `src/lib/inputSafety.ts`    | Input sanitization with configurable max lengths.                                                                                                                                                                                 |
| `src/lib/sync.ts`           | Convex reactive query wrappers: `useAddAiAnalysis`, `useAiAnalysisHistory`, `useLatestSuccessfulAiAnalysis`, `useAddAssistantMessage`, `useConversationsByDateRange`, `useSuggestionsByDateRange`, `useLatestWeeklySummary`, etc. |

### Convex Backend

| File                           | Purpose                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/ai.ts`                 | `chatCompletion` action -- thin relay to OpenAI. Auth + key validation, dynamic import, returns content + usage.                                          |
| `convex/aiAnalyses.ts`         | `add` mutation (insert + schedule extraction), `list`/`latest`/`latestSuccessful` queries, `toggleStar` mutation.                                         |
| `convex/conversations.ts`      | `addUserMessage`, `addAssistantMessage`, `claimPendingReplies`, `pendingReplies`, `listByDateRange`, `listByReport`, `search`.                            |
| `convex/extractInsightData.ts` | `extractFromReport` internal mutation. Extracts food assessments and suggestions into normalized tables, schedules aggregate updates.                     |
| `convex/schema.ts`             | Table definitions: `aiAnalyses` (lines 138-151), `conversations` (lines 153-167), `foodAssessments` (lines 169-203), `reportSuggestions` (lines 205-218). |
| `convex/lib/auth.ts`           | `requireAuth` helper -- extracts `userId` from Convex auth identity.                                                                                      |
| `convex/validators.ts`         | Convex validators for `aiRequestValidator`, `aiResponseValidator`, `aiInsightValidator`.                                                                  |

### Types

| File                  | Purpose                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/domain.ts` | `AiNutritionistInsight` (lines 326-357), `AiAnalysisStatus` (line 373), `StructuredFoodAssessment` (lines 363-371), `LifestyleExperimentStatus`, `DrPooReply`, `AiPreferences`, `HealthProfile`, `LogEntry`, `BaselineAverages`, etc. |

---

## Observations

### Architecture strengths

1. **BYOK pattern executed well.** The API key is stored in IndexedDB (never in Convex), passed transiently through the Convex action, validated server-side with a regex, and used to instantiate a fresh OpenAI client per call. The key never touches persistent storage on the server.
2. **Comprehensive prompt engineering.** The system prompt is a substantial clinical reasoning framework (~1200 source lines) with tone/length/format customization, deductive reasoning rules, lifestyle trade-off engine, and gamification. This is genuinely domain-expert-level prompt craft.
3. **Robust response parsing.** `parseAiInsight` provides safe defaults for every field, making the system resilient to LLM output variation. The belt-and-suspenders null-forcing for `directResponseToUser` and educational insight dedup show defensive coding.
4. **Async extraction pipeline.** Food assessments and suggestions are extracted into normalized tables asynchronously, feeding the food trial summary and weekly digest aggregation. This cleanly separates the hot path (report generation) from the cold path (data mining).
5. **Conversation memory model.** The half-week boundary system plus weekly summaries provides a practical memory window without unbounded context growth.

### Concerns and complexity

1. **`aiAnalysis.ts` is 1830 lines.** The system prompt alone is ~600 lines of template literals. While all in one file makes the prompt traceable, it's approaching the point where prompt sections, patient profile building, and the fetch/parse logic could be split for maintainability.
2. **No explicit abort/cancellation UI.** The `AbortController` is created but there's no user-facing cancel button during the potentially long API call. The only escape is navigating away.
3. **Reactive delay is a fixed 1500ms.** The `REACTIVE_DELAY_MS` wait assumes Convex will have the new log within 1.5s. If Convex is slow, the analysis could miss the latest data. No verification that the expected data actually appeared.
4. **Rate limiter is disabled.** `MIN_CALL_INTERVAL_MS = 0` means rapid repeated clicks on "Send now" are only guarded by the `loadingRef` lock. This is sufficient but the rate limiter module is dead code.
5. **Error record saves are fire-and-forget.** The error path (lines 301-310) saves an error analysis record to Convex but uses `.catch()` to swallow save failures. If the error save itself fails, there's no record of the failure.
6. **Token estimation is rough.** The `chars/4` estimate (line 1770) is a crude heuristic. With the amount of structured JSON data being sent, actual token counts could vary significantly.
7. **50,000 token warning threshold is high.** Given GPT-5.4's likely context window, this may be fine, but the prompt + 72 hours of logs + 50 food trials + 20 conversation messages + weekly digests could approach or exceed model limits for active users.
8. **`parseAiInsight` accepts any valid JSON structure.** If the AI returns fields with correct types but semantically wrong content, there's no validation beyond type checking. The `summary` field defaults to "No summary available." on failure, which could be displayed as a real report.
