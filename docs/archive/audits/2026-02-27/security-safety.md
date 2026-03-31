# Security & Safety Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Security Specialist

## Executive Summary

The staged changes significantly expand the health data model (adding detailed substance use, reproductive, and lifestyle information), introduce a new `deleteAllBySyncKey` mutation for bulk data deletion, add multiple new client-side OpenAI API integrations, and introduce a `v.any()` validator for `aiPreferences`. The existing syncKey-only authorization model -- previously flagged in prior reviews -- remains unchanged and becomes more critical as the scope of sensitive data widens. No new XSS vectors were introduced (no `dangerouslySetInnerHTML` usage found). The primary concerns are: (1) the syncKey-as-authentication model now guards more sensitive data including substance use and reproductive health, (2) the new `deleteAllBySyncKey` mutation enables complete data destruction with only a syncKey, and (3) additional `v.any()` validators weaken server-side schema enforcement.

---

## Critical Issues

### C-1: `deleteAllBySyncKey` Mutation Enables Full Account Wipe with Only a syncKey

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines 478-591)

**Description:** The new `deleteAllBySyncKey` mutation deletes ALL data across 10 tables (logs, aiAnalyses, conversations, foodAssessments, reportSuggestions, foodTrialSummary, weeklyDigest, weeklySummaries, profiles, foodLibrary) given only a syncKey string. There is no authentication, no rate limiting, and no secondary confirmation mechanism at the backend level.

```typescript
export const deleteAllBySyncKey = mutation({
  args: {
    syncKey: v.string(),
  },
  handler: async (ctx, args) => {
    const syncKey = sanitizeSyncKey(args.syncKey);
    // ... deletes from 10 tables
  },
});
```

**Impact:** Anyone who knows or guesses a user's syncKey can permanently delete all of their health tracking data, medical history, and AI analyses. The default syncKey is `"my-recovery-key"` (see `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts`), which means any user who has not changed it from the default has zero protection. The client-side `window.confirm` dialog in `AppDataForm.tsx` (line 202) provides no server-side protection.

**Recommendation:**

1. Implement proper authentication (Convex Auth with Clerk/Auth0) before exposing destructive operations.
2. As an interim measure, add a time-delayed soft-delete pattern rather than immediate hard deletion.
3. Require a secondary confirmation token generated server-side before executing bulk deletions.

### C-2: syncKey-Only Authorization Now Guards Expanded Sensitive Health Data

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (all query/mutation handlers)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts` (lines 169-327)
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (expanded `HealthProfile` type)

**Description:** The data model has been significantly expanded to include:

- Gender identity, age
- Detailed smoking history (cigarettes/day, years)
- Detailed alcohol use (amount, frequency, years at current level)
- Recreational drug use by category (stimulants, depressants, psychedelics) with per-category frequency and duration
- Expanded reproductive health (pregnancy weeks, breastfeeding, contraceptive details, menopause HRT)
- Lifestyle notes, dietary history, intolerances, supplements

All of this data continues to be protected only by a syncKey string with no authentication. This was flagged in prior reviews but has become more critical as the data surface has expanded from basic surgery tracking to a comprehensive substance use and reproductive health profile.

**Impact:** Exposure of any user's syncKey (e.g., through shared devices, shoulder surfing the URL parameter, or the default key) now exposes significantly more sensitive personal health information including substance use patterns that could have legal, employment, or social consequences.

**Recommendation:** This should be the highest-priority architectural improvement. Implement Convex Auth to gate all data access behind proper user identity verification.

---

## High Severity

### H-1: `aiPreferences` Uses `v.any()` Validator -- No Server-Side Schema Enforcement

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (line 392)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts` (line 205)

```typescript
// convex/logs.ts line 392
aiPreferences: v.optional(v.any()),

// convex/schema.ts line 205
aiPreferences: v.optional(v.any()),
```

**Description:** The newly added `aiPreferences` field uses `v.any()` for both the mutation argument validator and the schema definition. While `sanitizeUnknownStringsDeep` is called on the value before storage (line 440 of `convex/logs.ts`), the shape is entirely unconstrained. A malicious client could store arbitrarily large or deeply nested objects, JSON bombs, or unexpected field types.

**Impact:** Potential for:

- Storage of arbitrary data in the database under the `aiPreferences` key
- Denial-of-service through large payloads (limited only by Convex's own payload size limits)
- Unexpected runtime behavior when the client reads back data with an unexpected shape

**Recommendation:** Create a proper `aiPreferencesValidator` (similar to the existing `healthProfileValidator`) with explicit field validators for `preferredName`, `location`, `mealSchedule`, `aiModel`, `toneFriendliness`, etc. The types are already defined in `src/store.ts` as the `AiPreferences` interface -- mirror these as Convex validators.

### H-2: `storedProfileHabitsValidator` Uses `v.array(v.any())` for Schema Definition

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts` (line 56)

```typescript
export const storedProfileHabitsValidator = v.array(v.any());
```

**Description:** While the code comment notes this is for "legacy profile docs" and "mutations still validate habits strictly," the schema itself accepts any array contents. The mutation does use the strict `habitsValidator` for incoming writes (line 385 of `convex/logs.ts`), but the schema definition allows legacy data to remain unvalidated. The `normalizeStoredProfileHabit` function in `convex/logs.ts` (lines 99-189) performs runtime normalization on read, but malformed data could cause unexpected behavior in normalization edge cases.

**Impact:** Corrupted or malicious habit data stored before the schema migration could pass through normalization in unexpected ways. The `rawHabit as Record<string, unknown>` cast at line 105 enables unchecked access to potentially adversarial data shapes.

**Recommendation:** The read-time normalization approach is reasonable for backward compatibility, but add explicit length limits (e.g., max array size of 100 habits) and consider adding a Convex migration to clean up legacy data so the `v.any()` can eventually be removed.

### H-3: Expanded Client-Side OpenAI API Usage (6 Call Sites with `dangerouslyAllowBrowser: true`)

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 1170, 1391)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 47, 249, 389, 532)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` (line 258)

**Description:** The staged changes add 4 new client-side OpenAI API call sites in `habitCoaching.ts` (coaching snippets, habit snippets, pane summaries, settings suggestions). This expands the attack surface for API key interception from the original 3 call sites to 7 total. Each creates a new OpenAI client with `dangerouslyAllowBrowser: true`.

The API key continues to be stored in plaintext in IndexedDB via Zustand persistence (`src/store.ts`). This was previously flagged but the expansion of call sites increases the risk surface.

**Impact:** More network requests containing the API key visible in browser DevTools, more entry points for XSS-based key extraction, increased cost exposure from potential abuse.

**Recommendation:** Move OpenAI API calls to Convex server-side actions. As an interim measure, consider creating a single shared OpenAI client instance rather than instantiating a new client per call.

### H-4: User-Controlled AI Model Selection Without Validation

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (line 1284)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx` (lines 452-455)
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (`AiModel` type)

```typescript
// aiAnalysis.ts line 1284
model: prefs.aiModel,

// AppDataForm.tsx
<select ... onChange={(e) => setAiPreferences({ aiModel: e.target.value as AiModel })}>
```

**Description:** The user can select the AI model via a dropdown, and the value is cast with `as AiModel` without runtime validation. The `AiModel` type is `"gpt-5-mini" | "gpt-5.2"`, but since this value flows through IndexedDB persistence and the `v.any()` aiPreferences validator, there is no guarantee the stored value matches one of these two options. A tampered value could cause unexpected model usage or API errors.

**Impact:** If a user manually modifies IndexedDB to set `aiModel` to an expensive model name (assuming OpenAI accepts it), they could inadvertently or deliberately increase their own API costs. More importantly, there is no server-side validation path since `aiPreferences` uses `v.any()`.

**Recommendation:** Add runtime validation when reading `aiPreferences.aiModel`:

```typescript
const VALID_AI_MODELS = new Set(["gpt-5-mini", "gpt-5.2"]);
const model = VALID_AI_MODELS.has(prefs.aiModel)
  ? prefs.aiModel
  : DEFAULT_AI_MODEL;
```

---

## Medium Severity

### M-1: Sensitive Health Data Sent to AI System Prompt Without Filtering

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 368-662)

**Description:** The expanded `buildSystemPrompt` function now injects detailed substance use data (smoking patterns, alcohol frequency/amount/years, recreational drug categories and frequencies), reproductive health details (pregnancy status, breastfeeding, contraceptive notes, menopause HRT), and lifestyle notes directly into the OpenAI system prompt as plaintext.

```typescript
const smokingDetailLine =
  lifestyleSmoking === "yes" && smokingDetailParts.length > 0
    ? `- Smoking pattern: ${smokingDetailParts.join(" | ")}`
    : "";
// ...
const recreationalDetailLine =
  lifestyleRecreational === "yes" && recreationalDetailParts.length > 0
    ? `- Recreational pattern: ${recreationalDetailParts.join(" | ")}`
    : "";
```

**Impact:** This sensitive health data is transmitted to OpenAI's API servers. While this is the intended behavior for generating personalized health insights, users should be clearly informed that their substance use details, reproductive health information, and lifestyle data are being sent to a third-party AI service. The `AI_DISCLAIMER` mentions it is "not medical advice" but does not mention data processing by third parties.

**Recommendation:**

1. Add a clear data processing disclosure in the settings UI near where the API key is configured.
2. Consider allowing users to selectively exclude sensitive categories (substance use, reproductive) from AI analysis.
3. Ensure the OpenAI data processing agreement covers health data handling.

### M-2: `console.error` Logs Raw AI Response Data

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` (lines 281, 286)

```typescript
console.error(
  `Food parsing returned invalid JSON: ${rawContent.slice(0, 200)}`,
);
// ...
console.error(
  "Food parsing returned an unexpected response structure.",
  parsed,
);
```

**Description:** When food parsing fails, the raw AI response (up to 200 chars) and the parsed object are logged to `console.error`. These could contain food data, ingredient names, or other user input that was sent to the AI. In production, this data appears in the browser console where it could be captured by monitoring tools or browser extensions.

**Impact:** Minor information leakage through browser console logs. The 200-character limit on the JSON snippet mitigates the worst case.

**Recommendation:** In production builds, either suppress these logs or redact the content to show only the error type without raw data.

### M-3: `resetToFactorySettings` Does Not Clear AI Cache or Habit Logs

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 509-533)

**Description:** The `resetToFactorySettings` function correctly clears most state including `openAiApiKey`, `habitLogs`, `paneSummaryCache`, and `drPooReplies`. This is good security hygiene. However, the reset only affects local state -- cloud-synced data remains intact (which is documented). The `openAiApiKey` is cleared, which is correct.

**Impact:** Low. The implementation is correct in clearing the API key and local data. Noted here for completeness.

### M-4: syncKey Length Limit Increased from 128 to 512 Characters

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/lib/inputSafety.ts` (line 4)

```typescript
syncKey: 512,
```

**Description:** The `syncKey` maximum length was increased from 128 to 512 characters. While longer keys enable higher entropy (which is positive for security), this also increases the size of indexed data and could affect query performance on the `by_syncKey` index.

**Impact:** Positive for security (allows higher-entropy keys), minor concern for database performance with very long indexed strings.

**Recommendation:** The increase is reasonable. Ensure the UI guidance (seen in `AppDataForm.tsx` where it suggests generating a key) encourages users to actually use high-entropy keys.

### M-5: No Rate Limiting on AI API Calls from Client

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (4 async API call functions)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (2 API call functions)

**Description:** There is no client-side rate limiting or debouncing on the OpenAI API calls. A rapid series of user interactions could trigger many concurrent API requests. The coaching snippet (`generateCoachingSnippet`) is called from the Track page, the pane summary (`generatePaneSummary`) from the Patterns page, and the settings suggestions (`generateSettingsSuggestions`) from the Settings page.

The `paneSummaryCache` in the store (with a 6-hour TTL in `habitCoaching.ts` line 361) provides some protection for pane summaries, but other call sites have no caching.

**Impact:** Uncontrolled API cost accumulation, potential OpenAI rate limit errors that could degrade user experience.

**Recommendation:** Add client-side request throttling (e.g., one coaching snippet request per 30 seconds) and request deduplication for concurrent identical requests.

---

## Low Severity / Informational

### L-1: Client-Side Input Sanitization Lacks Length Limits

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/inputSafety.ts` (client-side copy)

**Description:** The client-side `inputSafety.ts` (in `src/lib/`) provides `sanitizePlainText` and `sanitizeUnknownStringsDeep` but, unlike its server-side counterpart in `convex/lib/inputSafety.ts`, does not enforce `maxStringLength` limits. The server-side version does enforce these limits, so this is defense-in-depth concern only.

**Impact:** Low -- the server-side validation catches oversized strings.

### L-2: HabitConfig `color` Field Has No Validation

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (line 172, `normalizeStoredProfileHabit`)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts` (habitConfigValidator uses `v.string()` for color)

```typescript
color: asTrimmedString(raw.color) ?? "violet",
```

**Description:** The `color` field on `HabitConfig` is validated only as `v.string()` with no allowlist. While colors are rendered as CSS class names / variable references (not injected as raw CSS), an overly long or specially crafted color string could cause unexpected behavior.

**Impact:** Very low. React's JSX rendering escapes values used in `style` attributes and `className`. The `sanitizeUnknownStringsDeep` call on the server enforces a 5000-character generic limit.

### L-3: `formatUsageFrequency` Default Case Returns Raw Input

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 195-211, `formatFrequency` helper)

```typescript
const formatFrequency = (value: string): string => {
  switch (value) {
    // ... known cases
    default:
      return value;
  }
};
```

**Description:** The `formatFrequency` helper in the system prompt builder has a default case that returns the raw input value. If an unexpected frequency string is stored in the health profile, it would be injected verbatim into the AI system prompt.

**Impact:** Very low. The value is a string that goes into a prompt sent to OpenAI, not rendered as HTML. The worst case is prompt pollution with an unexpected string, which would only affect the quality of AI output for that user's own session.

### L-4: Confirmation Dialogs Use `window.confirm` Instead of Custom Modal

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx` (lines 133, 192, 202)

**Description:** Destructive operations (Load Profile, Factory Reset, Delete Account Data) use `window.confirm()` for confirmation. While functional, these are not customizable and cannot enforce delays or secondary confirmation steps. The Delete Account Data action in particular is irreversible and relies only on a single browser-native confirmation dialog.

**Impact:** Low. `window.confirm()` is synchronous and blocks the UI thread, preventing accidental double-clicks. However, it cannot enforce a "type to confirm" pattern that would better protect against accidental destructive actions.

**Recommendation:** For the Delete Account Data action specifically, consider a custom modal that requires the user to type a confirmation phrase (e.g., "DELETE MY DATA").

### L-5: No XSS Vectors Found in New Components

**Files:** All new components (`AICoachStrip.tsx`, `QuickCapture.tsx`, `QuickCaptureTile.tsx`, `HabitDetailSheet.tsx`, `TodayStatusRow.tsx`, `DigestiveCorrelationGrid.tsx`, `AiSuggestionsCard.tsx`, `responsive-shell.tsx`)

**Description:** Verified that no new components use `dangerouslySetInnerHTML`, `innerHTML`, or any other raw HTML injection pattern. All dynamic content is rendered through React's JSX interpolation (`{variable}`) which auto-escapes HTML entities. This is good.

### L-6: AI-Generated Content Rendered Safely as Plain Text

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/AICoachStrip.tsx` (line 43, `{message}`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx` (line 216, `{s.suggestion}`)

**Description:** AI-generated coaching messages and suggestions are rendered as plain text through React JSX. No `dangerouslySetInnerHTML` is used. This properly mitigates the risk of AI-generated XSS payloads.

---

## Files Reviewed

| File                                                   | Status | Security Notes                                                                                                                                           |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/lib/inputSafety.ts`                            | M      | syncKey limit increased 128->512. All sanitization functions intact. Good.                                                                               |
| `convex/logs.ts`                                       | M      | **Critical**: New `deleteAllBySyncKey` mutation. New `aiPreferences: v.any()`. Profile normalization on read is well-implemented.                        |
| `convex/migrations.ts`                                 | M      | Defensive type checking added for habit lookup. Safe.                                                                                                    |
| `convex/schema.ts`                                     | M      | New `v.any()` for `aiPreferences`, `storedProfileHabitsValidator` uses `v.array(v.any())`.                                                               |
| `convex/validators.ts`                                 | M      | Good: expanded health profile validator with explicit enums for new fields. `storedProfileHabitsValidator` and removal of old category validators noted. |
| `src/components/DailyProgress.tsx`                     | M      | No security concerns. UI-only changes.                                                                                                                   |
| `src/components/archive/DrPooReport.tsx`               | M      | Switched from static to dynamic disclaimer. Safe.                                                                                                        |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | A      | No security concerns. Pure presentation. Date inputs are properly typed.                                                                                 |
| `src/components/patterns/FactorInsights.tsx`           | M      | No security concerns. Switched from emoji to Lucide icons.                                                                                               |
| `src/components/patterns/WeightTracker.tsx`            | M      | No security concerns. Renamed component.                                                                                                                 |
| `src/components/settings/AiSuggestionsCard.tsx`        | A      | Calls OpenAI API. AI-generated text rendered safely. No XSS.                                                                                             |
| `src/components/settings/AppDataForm.tsx`              | M      | **High**: Delete all data button. Uses `window.confirm` for destructive ops. Good: error handling added for profile save.                                |
| `src/components/settings/HealthForm.tsx`               | M      | Expanded with substance use forms. Input validation present. No XSS.                                                                                     |
| `src/components/settings/ReproForm.tsx`                | M      | Expanded reproductive health forms. Input validation present.                                                                                            |
| `src/components/settings/SettingsTile.tsx`             | M      | No security concerns. UI refactoring only.                                                                                                               |
| `src/components/settings/TrackingForm.tsx`             | M      | No security concerns. Habit management UI.                                                                                                               |
| `src/components/track/AICoachStrip.tsx`                | A      | AI text rendered safely as `{message}`. No XSS.                                                                                                          |
| `src/components/track/ActivitySection.tsx`             | M      | Sleep logging removed (moved to QuickCapture). Cleaner.                                                                                                  |
| `src/components/track/BowelSection.tsx`                | M      | No security concerns.                                                                                                                                    |
| `src/components/track/HabitDetailSheet.tsx`            | A      | AI snippet rendering is safe. No XSS vectors.                                                                                                            |
| `src/components/track/QuickCapture.tsx`                | A      | Weight input sanitized (`sanitizeWeightInput`). Custom habit form input validated.                                                                       |
| `src/components/track/QuickCaptureTile.tsx`            | A      | Pure presentation. No security concerns.                                                                                                                 |
| `src/components/track/TodayLog.tsx`                    | M      | No security concerns.                                                                                                                                    |
| `src/components/track/TodayStatusRow.tsx`              | A      | No security concerns.                                                                                                                                    |
| `src/components/ui/responsive-shell.tsx`               | A      | No security concerns. UI shell component.                                                                                                                |
| `src/hooks/useAiInsights.ts`                           | M      | Reads from paneSummaryCache (store). No direct security concern.                                                                                         |
| `src/hooks/useCelebration.ts`                          | M      | No security concerns.                                                                                                                                    |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | M      | No security concerns.                                                                                                                                    |
| `src/lib/aiAnalysis.ts`                                | M      | **Medium**: Expanded health data in system prompt. Model selection from preferences. User-facing.                                                        |
| `src/lib/celebrations.ts`                              | A      | No security concerns. Pure logic.                                                                                                                        |
| `src/lib/deprecatedHabits.ts`                          | A      | Safe filtering logic. No security concerns.                                                                                                              |
| `src/lib/digestiveCorrelations.ts`                     | A      | Pure computation. No security concerns.                                                                                                                  |
| `src/lib/foodParsing.ts`                               | M      | console.error logs raw AI response (truncated). Minor info leakage.                                                                                      |
| `src/lib/habitAggregates.ts`                           | A      | Pure computation. No security concerns.                                                                                                                  |
| `src/lib/habitCoaching.ts`                             | A      | **High**: 4 new OpenAI API call sites with `dangerouslyAllowBrowser: true`. No rate limiting.                                                            |
| `src/lib/habitConstants.ts`                            | M      | No security concerns. Constants only.                                                                                                                    |
| `src/lib/habitHistoryCompat.ts`                        | A      | Backward-compatibility layer. No security concerns.                                                                                                      |
| `src/lib/habitIcons.tsx`                               | M      | No security concerns. Icon mapping.                                                                                                                      |
| `src/lib/habitTemplates.ts`                            | M      | No security concerns. Type definitions and templates.                                                                                                    |
| `src/lib/streaks.ts`                                   | M      | No security concerns. Gamification logic.                                                                                                                |
| `src/lib/sync.ts`                                      | M      | New `useDeleteAllSyncedData` hook exposes delete mutation. `filterDeprecatedHabits` applied correctly.                                                   |
| `src/pages/Archive.tsx`                                | M      | No security concerns.                                                                                                                                    |
| `src/pages/Patterns.tsx`                               | M      | No security concerns.                                                                                                                                    |
| `src/pages/Settings.tsx`                               | M      | No security concerns. Layout changes.                                                                                                                    |
| `src/pages/Track.tsx`                                  | M      | No security concerns.                                                                                                                                    |
| `src/routeTree.tsx`                                    | M      | No security concerns. Route definitions.                                                                                                                 |
| `src/store.ts`                                         | M      | **Medium**: Expanded sensitive data types. `resetToFactorySettings` correctly clears API key. No encryption on IndexedDB.                                |
| `src/index.css`                                        | M      | No security concerns. Styling only.                                                                                                                      |
| `public/app-data-img.png`                              | A      | Static asset. No security concern.                                                                                                                       |
| `public/health-surgery-img.png`                        | A      | Static asset. No security concern.                                                                                                                       |
| `public/reproductive-health-img.png`                   | A      | Static asset. No security concern.                                                                                                                       |
| `public/tracking-personalisation-img.png`              | A      | Static asset. No security concern.                                                                                                                       |
| `scripts/ship/review-findings.json`                    | M      | Metadata file. No security concern.                                                                                                                      |

---

## Summary of Findings by Severity

| Severity | Count | Key Themes                                                                               |
| -------- | ----- | ---------------------------------------------------------------------------------------- |
| Critical | 2     | Unauthenticated bulk data deletion, syncKey-only auth guarding expanded sensitive data   |
| High     | 4     | `v.any()` validators, expanded client-side API key exposure, unvalidated model selection |
| Medium   | 5     | Health data in AI prompts, console logging, rate limiting, syncKey length                |
| Low/Info | 6     | Input sanitization depth-of-defense, color validation, safe rendering practices          |

The codebase demonstrates good practices in several areas: consistent use of `sanitizeUnknownStringsDeep` on server-side writes, no `dangerouslySetInnerHTML` usage, proper React JSX escaping for all dynamic content, and defensive input validation in new UI components. The critical issues are architectural (authentication model) rather than code-level vulnerabilities.
