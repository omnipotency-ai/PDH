# Data Model & Business Logic Review

**Date:** 2026-02-24
**Reviewer:** Claude Opus 4.6 (automated domain review)
**Scope:** All source files in `src/`, `convex/` -- data model, business logic, AI integration, sync, analytics

---

## Executive Summary

Caca Traca is a thoughtfully designed ostomy recovery tracker with a well-considered domain model and an unusually sophisticated food-to-digestion correlation engine. The core correlation algorithm in `analysis.ts` implements a medically plausible transit-time-based food trial resolution system that accounts for variable transit speeds, and the AI integration through "Dr. Poo" provides clinically informed dietary guidance.

The architecture follows a pragmatic offline-first approach: Zustand + IndexedDB for local state, Convex for cloud persistence and cross-device sync. However, the system has several structural issues that affect data integrity and reliability. The most significant concern is the use of `v.any()` for log data fields in the Convex schema, which eliminates server-side validation for the most critical data in the application. Additionally, the AI analysis module contains hardcoded patient constants that will break for any user other than the original developer, and there is no true conflict resolution strategy for the offline-first sync model.

**Overall Risk Level:** Medium -- the application works well for a single user in its current form, but has architectural gaps that would surface as bugs or data corruption at scale or with extended use.

---

## Data Model Diagram

```
+------------------+        +-------------------+
|     profiles     |        |       logs        |
+------------------+        +-------------------+
| syncKey (idx)    |        | syncKey (idx)     |
| unitSystem       |        | timestamp (idx)   |
| habits[]         |        | type (enum)       |
| fluidPresets[]?  |        | data (any)        |
| gamification?    |        +-------------------+
| sleepGoal?       |             |
| calibrations?    |             | type discriminant
| updatedAt        |             |
+------------------+        +----+----+----+----+----+----+
                            |food|fluid|habit|activity|digestion|weight|
                            |    |     |     |        |         |      |
                            | items[]  |items[]|habitId |activityType|weightKg|
                            | notes    |       |name    |durationMin |        |
                            |          |       |habitType|feelTag    |        |
                            |          |       |quantity |           |        |
                            +----+----+----+---+---------+----------+--------+

+------------------+        +-------------------+
|   aiAnalyses     |        |   foodLibrary     |
+------------------+        +-------------------+
| syncKey (idx)    |        | syncKey (idx)     |
| timestamp (idx)  |        | canonicalName(idx)|
| request (any)    |        | type (enum)       |
| response (any)   |        | ingredients[]     |
| insight (any)    |        | createdAt         |
| model            |        +-------------------+
| durationMs       |
| inputLogCount    |
| error?           |
+------------------+

+-------------------+                    +-------------------+
|  Zustand Store    |                    |  HealthProfile    |
| (IndexedDB)       |                    |  (local only)     |
+-------------------+                    +-------------------+
| syncKey           |                    | surgeryType       |
| openAiApiKey      |                    | surgeryDate       |
| unitSystem        |                    | heightCm          |
| habits[]          |                    | startingWeightKg  |
| fluidPresets[]    |                    | currentWeightKg   |
| gamification      |                    | healthConditions[]|
| sleepGoal         |                    | medications       |
| healthProfile ----+------------------->| allergies         |
| latestAiInsight   |                    +-------------------+
| drPooReplies[]    |
+-------------------+
```

---

## Findings

### CRITICAL

#### C1. `v.any()` used for log `data` field -- no server-side validation

**Location:** `convex/schema.ts:81`, `convex/logs.ts:134`
**Description:** The `data` field on the `logs` table uses `v.any()`, meaning Convex performs zero validation on the most important payload in the application. Any client can write any shape of data to this field. Food logs, digestion logs, habit logs, fluid logs, and activity logs all share this single untyped field.
**Impact:** Corrupted or malformed data can silently enter the database. The entire analysis engine (`analysis.ts`) and AI pipeline (`aiAnalysis.ts`) depend on specific data shapes that are never enforced at the persistence layer. A single malformed log entry could cause the correlation engine to silently produce incorrect results (e.g., a digestion log without `bristolCode` defaults to `null`, which produces `NaN` in some code paths).
**Recommendation:** Define discriminated union validators for each log type:

```typescript
const foodDataValidator = v.object({
  items: v.array(
    v.object({
      name: v.string(),
      canonicalName: v.optional(v.string()),
      quantity: v.union(v.number(), v.null()),
      unit: v.union(v.string(), v.null()),
    }),
  ),
  notes: v.optional(v.string()),
});
```

Create a per-type validator and use `v.union()` or runtime validation in the mutation handler.

#### C2. Hardcoded patient constants in AI analysis module

**Location:** `src/lib/aiAnalysis.ts:12-14`

```typescript
const PATIENT_SURGERY_DATE = "2026-02-13";
const PATIENT_WEIGHT_KG = 103;
const PATIENT_HEIGHT_CM = 186;
```

**Description:** The AI system prompt uses hardcoded patient-specific values for surgery date, weight, height, and BMI. The `HealthProfile` exists in the Zustand store and is editable in Settings, but the AI analysis module does not read from it. The `getDaysPostOp()` and `getBmi()` functions use these constants instead of the user's actual profile data.
**Impact:** The AI gives advice calibrated to a specific person. If the user updates their health profile, the AI analysis still uses the hardcoded values. For any other user of this application, the AI would give clinically incorrect advice (wrong days post-op, wrong BMI, wrong surgery type).
**Recommendation:** Pass `HealthProfile` into `fetchAiInsights()` and interpolate the system prompt dynamically. The template already uses string interpolation -- just replace the constants with profile fields.

#### C3. AI system prompt contains highly specific patient medical details

**Location:** `src/lib/aiAnalysis.ts:229-232`
**Description:** The system prompt hardcodes: HIV+ status, specific medication (Biktarvy), specific recreational drug use patterns (methamphetamine usage with exact daily counts), specific cigarette counts, and ADHD diagnosis. These are baked into the prompt, not derived from any configurable profile data.
**Impact:** Beyond the hardcoding issue in C2, this means the entire AI experience is designed for exactly one patient. No configuration mechanism exists to adapt the clinical persona to a different user's medical profile. Additionally, if the `HealthProfile.medications` or `HealthProfile.healthConditions` fields are populated, they are never sent to the AI, making those settings screen features effectively non-functional for AI advice purposes.
**Recommendation:** Build the system prompt dynamically from `HealthProfile` data. Extract patient-specific details into configurable fields (conditions, medications, lifestyle baselines). Keep the clinical framework and reasoning structure but parameterise the patient-specific sections.

---

### HIGH

#### H1. No conflict resolution in offline-first sync model

**Location:** `src/lib/sync.ts` (entire file), `convex/logs.ts`
**Description:** The application uses Convex as its cloud backend with the Convex React hooks for real-time subscriptions. However, there is no true offline-first architecture -- there is no local write-ahead log, no optimistic updates with rollback, and no conflict detection. When offline, mutations will simply fail (Convex mutations require connectivity). The Zustand store persists preferences to IndexedDB, but log entries go directly to Convex.
**Impact:** If the user loses connectivity while logging a meal or bowel movement, the entry is lost with only a toast error message. There is no retry queue, no local staging of entries, and no reconciliation when connectivity returns. For a health tracking app where timely logging is critical, this is a significant reliability gap.
**Recommendation:** Implement a local write-ahead log in IndexedDB. Stage log entries locally first, then sync to Convex in the background. Use the `syncKey + timestamp` composite index for idempotent upserts to handle duplicate writes on reconnection.

#### H2. `syncKey` is the only access control mechanism

**Location:** `convex/schema.ts:71`, `convex/logs.ts:79-96`
**Description:** All data access is gated by a string `syncKey` that defaults to `"my-recovery-key"`. There is no authentication, no user accounts, no access tokens. Anyone who knows or guesses a sync key can read and write all health data for that key.
**Impact:** This is a shared secret model with a predictable default. Health data is sensitive (Bristol stool records, medication logs, body weight, HIV status in AI analyses). The default sync key means any user who does not change it shares a data namespace.
**Recommendation:** At minimum: (1) Generate a cryptographically random default sync key. (2) Add Convex authentication (Clerk, Auth0, or Convex's built-in auth). (3) For the current sync-key model, consider hashing the key server-side so it is not stored in plaintext.

#### H3. OpenAI API key stored in plaintext in IndexedDB

**Location:** `src/store.ts:219`
**Description:** The OpenAI API key is stored as a plaintext string in the Zustand store, which persists to IndexedDB. It is also sent to OpenAI with `dangerouslyAllowBrowser: true` (`src/lib/foodParsing.ts:191`, `src/lib/aiAnalysis.ts:529`).
**Impact:** The API key is exposed in browser dev tools, can be extracted by any browser extension, and is stored unencrypted on disk. The `dangerouslyAllowBrowser` flag exists because OpenAI explicitly warns against client-side API key usage.
**Recommendation:** Route API calls through a Convex action (server-side function) that holds the API key. Store the key in Convex environment variables, not in the client. This also eliminates the CORS and key-exposure risks.

#### H4. Food correlation algorithm assigns ALL pending foods to each bowel event

**Location:** `src/lib/analysis.ts:259-301`
**Description:** The `resolveAllCorrelations` function iterates through bowel events chronologically and assigns every unresolved food trial (eaten at least 55 minutes before the bowel event) to that bowel event. This means if a user eats 5 different foods over 6 hours and then has a single bowel movement, all 5 foods are correlated with that single output with identical outcomes.
**Impact:** This conflation problem is fundamental to the correlation engine. If the user eats rice (safe) and chili (risky) and then has diarrhea, both foods get a "bad" outcome. Over time, the 3-trial rolling window helps, but in early use the signal-to-noise ratio is poor. The algorithm cannot distinguish which specific food caused the issue.
**Recommendation:** This is a known limitation of food-symptom correlation without controlled elimination diets. Document this limitation clearly in the UI. Consider implementing a "single-food trial mode" that prompts the user to eat only one new food per observation window. The AI ("Dr. Poo") already advises this approach -- integrate it as a formal mode. Also consider weighting correlations: foods eaten closer to the bowel event (but still past transit minimum) could receive higher correlation weight than those eaten many hours before.

#### H5. `habitType` validator missing `"sweets"` in `logs.ts` but present in `schema.ts`

**Location:** `convex/schema.ts:20` vs `convex/logs.ts:30-34`
**Description:** The `habitTypeValidator` in `schema.ts` includes `v.literal("sweets")` but the duplicate validator in `logs.ts` does not. The validators are redefined rather than shared.
**Impact:** If a habit log is created with `habitType: "sweets"`, it will pass the schema validation but the `replaceProfile` mutation's validator (defined in `logs.ts`) would reject it, or vice versa depending on which code path is hit. This is a latent inconsistency that will surface as a Convex validation error.
**Recommendation:** Define validators in a single shared file (e.g., `convex/validators.ts`) and import them into both `schema.ts` and `logs.ts`. Never duplicate validator definitions.

---

### MEDIUM

#### M1. Bristol code `1` mapped inconsistently

**Location:** `src/lib/analysis.ts:783-784`

```typescript
if (code >= 7) return "diarrhea";
if (code === 6) return "loose";
if (code <= 1) return "constipated"; // Bristol 1 only
if (code === 2) return "hard";
return "firm"; // Bristol 3, 4, 5
```

vs `src/pages/Track.tsx:47-50`:

```typescript
function bristolToConsistency(code: number): "firm" | "loose" | "diarrhea" {
  if (code >= 7) return "diarrhea";
  if (code >= 5) return "loose";
  return "firm";
}
```

**Description:** There are two separate Bristol-to-category mapping functions that produce different results:

- `normalizeDigestiveCategory` in `analysis.ts`: Bristol 1 = constipated, 2 = hard, 3-5 = firm, 6 = loose, 7 = diarrhea
- `bristolToConsistency` in `Track.tsx`: Bristol 1-4 = firm, 5-6 = loose, 7 = diarrhea

When a bowel movement is logged, `bristolToConsistency` in `Track.tsx` determines the `consistencyTag` stored in the log. But when the analysis engine reads it back, `normalizeDigestiveCategory` in `analysis.ts` first checks the `consistencyTag`, then falls back to `bristolCode`. Since `bristolToConsistency` maps Bristol 5 to "loose" but the analysis engine considers Bristol 5 "firm", the inconsistency means:

- Bristol 5 is logged with `consistencyTag: "loose"` but the analysis engine sees it as "loose" from the tag (not "firm" from the code)
- Bristol 2 is logged as "firm" but analysis would map it to "hard" if it used the code
  **Impact:** Bristol 5 stools are treated as "loose" in the stored data, which may inflate the "loose" count for foods. Bristol 2 is stored as "firm" rather than "hard", underreporting hard stools. This skews the food safety status calculations.
  **Recommendation:** Align the mapping functions. The medically correct mapping for post-anastomosis patients is: 1 = constipated, 2 = hard, 3-5 = firm/normal, 6 = loose, 7 = diarrhea. Use the `normalizeDigestiveCategory` logic everywhere and remove the simplified `bristolToConsistency` function in `Track.tsx`.

#### M2. Timezone-naive day boundaries in factor analysis

**Location:** `src/lib/analysis.ts:513-515`

```typescript
const date = new Date(log.timestamp);
const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
```

**Description:** The `analyzeFactors` function uses `new Date(timestamp)` to determine which calendar day a log belongs to, using the browser's local timezone. This means the same log could belong to different days on different devices if they are in different timezones. The timestamp is stored as UTC milliseconds, but day bucketing uses local time.
**Impact:** For a user traveling between timezones, or accessing the app from devices in different timezones, the day-level correlations (walking, smoking, sleep, fluid vs. Bristol scores) could be bucketed differently. Late-night logs near midnight are particularly susceptible.
**Recommendation:** Store the user's timezone in their profile and use it consistently for day-boundary calculations. Use `date-fns-tz` for timezone-aware day boundaries, or store the ISO date string alongside the timestamp in each log.

#### M3. No data retention or deletion mechanism

**Location:** All Convex queries and mutations
**Description:** There is no mechanism to delete old data, export and purge, or set retention policies. The `logs` table grows unboundedly. The `aiAnalyses` table stores full request/response payloads (including the entire system prompt with sensitive medical details) for every AI analysis run.
**Impact:** (1) Over months of use, query performance will degrade as the log count grows. The `useSyncedLogs(1200)` call fetches up to 1200 records every time, which is already a large payload. (2) The `aiAnalyses` table stores complete AI conversations including sensitive health data. There is no way to purge this data. (3) For GDPR/health data compliance, users should have a "delete all my data" capability.
**Recommendation:** Add a "Delete All Data" button in Settings. Add a Convex mutation that deletes all records for a given `syncKey`. Consider adding an automatic retention policy (e.g., archive logs older than 6 months into a separate summary table). Reduce what is stored in `aiAnalyses` -- store only the insight, not the full request/response with the system prompt.

#### M4. AI analysis debounce logic has race condition

**Location:** `src/hooks/useAiInsights.ts:37-113`
**Description:** The `runAnalysis` function uses `loadingRef.current` as a mutex, but the `triggerAnalysis` wrapper calls `runAnalysis()` directly (which is async). If two rapid calls to `triggerAnalysis` occur before the first one sets `loadingRef.current = true`, both will pass the guard. The `abortRef` partially mitigates this by aborting the previous request, but the abort signal is not checked until after the `REACTIVE_DELAY_MS` wait.
**Impact:** Rapid food + bowel logging (which both call `triggerAnalysis`) could cause two concurrent AI requests, wasting API credits and potentially causing the second request to overwrite the first with stale data.
**Recommendation:** Set `loadingRef.current = true` synchronously at the very start of `runAnalysis`, before any `await`. Or use a proper debounce/throttle utility that queues requests.

#### M5. `findStalledFoods` function defined but never exported or used in UI

**Location:** `src/lib/analysis.ts:493-508`
**Description:** The `findStalledFoods` function detects foods eaten 8+ hours ago with no subsequent bowel movement. It is used within `buildInsightText` for generating text alerts, but the function is not exported and the stalled food detection is not integrated into the ObservationWindow component or any real-time alert system.
**Impact:** The stalled transit detection only appears in a text string within the analysis result. Users do not receive proactive alerts when transit stalls, despite the function being ready for this purpose.
**Recommendation:** Export `findStalledFoods` and integrate it into the ObservationWindow component as a "stalled transit" warning card.

#### M6. Food library grows without bounds and has no deduplication for case variants

**Location:** `convex/foodLibrary.ts:42-60`
**Description:** The `addEntry` mutation checks for exact `canonicalName` matches to prevent duplicates, but the food parsing LLM may produce slight case or spacing variations (e.g., "white rice" vs "White Rice" vs "white rice"). The `canonicalName` comparison is exact-match only via the Convex index.
**Impact:** Over time, the food library accumulates near-duplicate entries. When the library is sent to the LLM for food parsing (`existingNames` parameter), duplicates waste tokens and may confuse the matching logic.
**Recommendation:** Normalize canonical names before insertion (lowercase, trim, collapse whitespace). Add a periodic cleanup mutation that merges near-duplicates.

#### M7. Health profile not synced to Convex

**Location:** `src/store.ts:128-129`, `convex/schema.ts:100-110`
**Description:** The `HealthProfile` (surgery type, surgery date, height, weight, conditions, medications, allergies) is stored only in the Zustand/IndexedDB local store. It is not included in the Convex `profiles` table and is not part of the `replaceProfile` mutation.
**Impact:** Health profile data is lost if the user clears browser storage or switches devices. The "Cross-Device Sync" feature in Settings syncs habits, fluid presets, gamification, and sleep goals, but not the health profile. This is particularly problematic because the health profile is the most clinically important configuration data.
**Recommendation:** Add health profile fields to the Convex `profiles` schema and include them in the sync flow.

---

### LOW

#### L1. Default sync key `"my-recovery-key"` is publicly visible

**Location:** `src/store.ts:209`
**Description:** The default sync key is a predictable string that all new users start with.
**Impact:** Low in practice for a single-user app, but if deployed publicly, all users who do not change their sync key would share data.
**Recommendation:** Generate a random UUID as the default sync key on first launch.

#### L2. `data: any` type on `LogEntry` interface

**Location:** `src/store.ts:89`

```typescript
data: any; // Will refine based on type
```

**Description:** The comment acknowledges this needs refinement. The `any` type propagates through the entire codebase, requiring defensive runtime checks everywhere.
**Impact:** TypeScript provides no compile-time safety for log data access. Every consumer must use runtime type guards (`typeof`, `Array.isArray`, etc.), which they do inconsistently.
**Recommendation:** Define discriminated union types:

```typescript
type LogEntry =
  | { id: string; timestamp: number; type: "food"; data: FoodLogData }
  | {
      id: string;
      timestamp: number;
      type: "digestion";
      data: DigestionLogData;
    };
// ... etc
```

#### L3. AI model references may become stale

**Location:** `src/lib/foodParsing.ts:3` (`gpt-5-mini`), `src/lib/aiAnalysis.ts:6` (`gpt-5.2`)
**Description:** Model identifiers are hardcoded string constants. When OpenAI deprecates or renames models, these will break with no fallback.
**Impact:** The application will throw API errors when the models are retired.
**Recommendation:** Make the model configurable in Settings, with sensible defaults. Add fallback model logic in the API call catch blocks.

#### L4. `readText` function returns `"undefined"` or `"null"` for missing data

**Location:** `src/lib/analysis.ts:902-904`

```typescript
function readText(value: unknown): string {
  return String(value ?? "").trim();
}
```

**Description:** If `value` is explicitly `undefined` or `null`, the `??` operator correctly returns `""`. However, if `value` is the string `"undefined"` (which can happen with `String(undefined)` in other code paths), it passes through. More importantly, if `value` is `0` or `false`, it is converted to `"0"` or `"false"`, which may not be the intended behavior for a function named `readText`.
**Impact:** Low -- the function is used correctly in practice for string fields.
**Recommendation:** Add explicit type narrowing: `if (typeof value !== 'string') return "";`

#### L5. Week averages in DaySummaryCard divide by 7 regardless of available data

**Location:** `src/components/patterns/DaySummaryCard.tsx:176-228`
**Description:** The "7d avg" view divides totals by 7 even if the user has fewer than 7 days of data. A new user with 2 days of data would see artificially low averages.
**Impact:** Misleading metrics for new users or after gaps in logging.
**Recommendation:** Count the actual number of days with log entries in the 7-day window and divide by that count.

#### L6. Episode spreading uses arbitrary 2-minute offset

**Location:** `src/lib/analysis.ts:168`

```typescript
timestamp: log.timestamp + index * 2 * 60 * 1000,
```

**Description:** When a digestion log has `episodesCount > 1`, each episode is spread 2 minutes apart from the original timestamp. This is an approximation that affects transit time calculations.
**Impact:** For a log with 5 episodes, the last episode's timestamp is shifted 8 minutes from the actual log time. This marginally affects transit time calculations but is generally acceptable for the precision level of this system.
**Recommendation:** Acceptable as-is. Document the approximation.

#### L7. Export limited to 600 most recent logs

**Location:** `src/pages/Settings.tsx:43`

```typescript
const logs = useSyncedLogs(600);
```

**Description:** The Settings page fetches only 600 logs for the export feature, while the Track page fetches 1200. A user with more than 600 entries cannot export their full history.
**Impact:** Data export is incomplete for power users.
**Recommendation:** Use a dedicated export mutation that fetches all records, or implement pagination in the export flow.

---

## Domain Logic Correctness Assessment

### Food-Digestion Correlation Engine (`analysis.ts`)

The correlation engine is the most critical business logic in the application. Assessment:

**Transit time model:** The 55-minute minimum transit time with progressive buckets (0-8h normal, 8-14h slow, 14-18h very slow, 18h+ abnormal) is medically reasonable for post-anastomosis patients. The minimum of 55 minutes correctly prevents gastrocolic reflex events from being attributed to just-eaten food.

**Resolution algorithm:** The "first bowel event resolves all pending food trials" approach (C4 above) is a practical simplification but introduces systematic bias. Foods eaten in combination are always correlated together, making it impossible to isolate individual triggers without controlled single-food trials.

**3-trial rolling window:** The status graduation system (testing -> safe/watch/risky based on last 3 resolved trials) is well-designed. The threshold of 2 resolved trials before graduation prevents premature classification. The BRAT baseline foods starting as "safe" is clinically appropriate.

**Factor correlation analysis:** The walking, smoking, sleep, and fluid correlation analysis uses median-split comparisons with a minimum of 3 days per group and a 10% difference threshold. This is methodologically sound for detecting gross patterns but lacks statistical rigor (no confidence intervals, no p-values). For a consumer health app, this is appropriate.

### AI Integration Logic (`aiAnalysis.ts`, `foodParsing.ts`)

**Food parsing:** The LLM-based food decomposition prompt is well-structured with clear rules for quantity extraction, unit normalization, composite food detection, and existing food library matching. The fallback to comma-split text parsing when the API fails is robust.

**Dr. Poo analysis:** The system prompt is exceptionally detailed and clinically informed. The reasoning framework (assess modifiers, trace outputs to inputs, rolling 3-trial rule, satiety and expansion) demonstrates deep domain knowledge. The patient-specific calibration is the key issue (C2, C3).

**Response validation:** Both AI integrations include JSON validation, fallback results, and error handling. The `applyFallbacks` function gracefully handles missing or malformed AI response fields. The `sideQuest`/`miniChallenge` field name mismatch between the prompt (`sideQuest`) and the interface (`miniChallenge`) is handled with a fallback check.

### Streak and Gamification Logic (`streaks.ts`)

The streak system is well-implemented with a "streak shield" mechanic (allows one missed day per week without breaking the streak). The badge progression system is straightforward and correct. The `differenceInCalendarDays` usage from `date-fns` correctly handles midnight boundaries.

### Habit Tracking (`habitTemplates.ts`)

The habit system is flexible with template-based defaults, custom habits, type inference, and goal mode (target vs. limit). The `normalizeHabitConfig` function is a good pattern for handling partial data during migration and user input. The `mergeRequiredHabits` function ensures critical habits are always available.

---

## Strengths

1. **Deep domain expertise in the AI prompt engineering.** The Dr. Poo system prompt demonstrates genuine understanding of post-anastomosis recovery, gut motility, the gastrocolic reflex, and dietary reintroduction principles. The instruction to "lead with wins" and the non-judgmental approach to lifestyle factors is clinically and psychologically sophisticated.

2. **Robust food parsing with graceful degradation.** The food parsing pipeline tries LLM decomposition first, validates the response structure, and falls back to simple comma-split parsing. The food library acts as a growing knowledge base that improves parsing over time.

3. **Well-designed transit time model.** The multi-bucket transit time system with configurable windows is medically reasonable and accounts for the variable transit times seen in post-surgical patients.

4. **Thoughtful gamification for ADHD users.** The streak shields, badges, sound effects, and confetti celebrations are designed to maintain engagement for users with ADHD, which is explicitly called out as a user need.

5. **Comprehensive bowel event capture.** The BowelSection component captures Bristol type, urgency, effort, volume, episode count, and accident status, which provides rich data for the correlation engine and AI analysis.

6. **Clean separation of concerns.** The codebase cleanly separates data access (`sync.ts`), analysis logic (`analysis.ts`), AI integration (`aiAnalysis.ts`, `foodParsing.ts`), state management (`store.ts`), and presentation components.

7. **Data export capability.** The CSV/JSON export in Settings provides basic data portability, which is important for health data.

8. **Observation Window UI.** The real-time food observation window with transit progress bars gives users immediate feedback on which foods are currently being "tested," which is both engaging and practically useful for timing bowel event logs.

---

## Overall Data & Business Logic Assessment

**Architecture: 7/10** -- The Zustand + Convex architecture is pragmatic and well-executed for a single-user prototype. The main gap is the lack of true offline support and the `v.any()` schema weakness.

**Domain Logic: 8/10** -- The correlation engine, Bristol scale handling, and transit time model are medically sound. The all-foods-per-event conflation is a known limitation that is partially mitigated by the 3-trial rolling window.

**AI Integration: 7/10** -- Excellent prompt engineering and response handling, severely limited by hardcoded patient constants. The food parsing pipeline is production-quality.

**Data Integrity: 5/10** -- The untyped `data` field, lack of server-side validation, and no conflict resolution are the weakest aspects of the system. The Bristol mapping inconsistency (M1) directly affects the accuracy of food safety classifications.

**Security & Privacy: 3/10** -- The sync-key-only access model, plaintext API key storage, and client-side AI calls create significant privacy risks for sensitive health data.

**Scalability: 6/10** -- The system works well for a single active user with moderate data volume. The 1200-log fetch limit and in-memory analysis will become bottlenecks with extended use.

**Priority actions for improving data reliability:**

1. Fix the Bristol mapping inconsistency (M1) -- this directly affects data accuracy
2. Replace `v.any()` with typed validators (C1) -- prevents data corruption
3. Parameterize the AI system prompt (C2, C3) -- enables multi-user support
4. Add conflict resolution / offline support (H1) -- prevents data loss
5. Sync health profile to Convex (M7) -- prevents profile data loss
