# Security & Performance Audit — Group 3

**Date:** 2026-04-06
**Scope:** 60 source files across App, archive/ai-insights, patterns/database, patterns/hero, settings, track components.

---

## Findings

---

### [HIGH] AI Error Message Leaked Directly to UI Without Sanitisation

**Category:** Security
**Files:** `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx:L40-L57`

**Description:**
The `error` prop is rendered verbatim in the UI without any sanitisation or redaction:

```tsx
const displayedError =
  isTruncated && !showFullError ? `${error.slice(0, ERROR_TRUNCATE_LENGTH)}...` : error;
// ...
<p className="text-[11px] font-medium text-[var(--section-food)]">
  {displayedError}
```

The value of `error` originates from the AI pipeline. If an upstream API returns a response that contains sensitive context (e.g. a verbose error that includes the payload sent to OpenAI, partial health data, a raw API key fragment from a misconfigured key), that string will be shown directly to the user in the UI. React escapes for XSS, so HTML injection is not a risk here, but sensitive information exposure is.

There is also a "Show more" toggle that exposes the full error string up to no practical cap (only `ERROR_TRUNCATE_LENGTH = 300` characters are hidden by default, but the full string is then displayed when expanded).

**Suggested Fix:**
Sanitise error messages before they reach the UI. At the point where the AI action throws (or returns an error string), normalise it through `getErrorMessage()` and strip anything that looks like a key (`sk-…`) or a JSON payload. Consider a dedicated `formatAiError(err)` helper that collapses verbose API error bodies to a user-friendly string before they enter Zustand state.

---

### [HIGH] Backup Import Parsed and Trusted Without Deep Validation of Contents

**Category:** Security
**Files:** `src/components/settings/app-data-form/useAppDataFormController.ts:L40-L58, L130-L150`

**Description:**
`validateBackupPayload` checks the top-level shape (`version`, `exportedAt`, `data` object), but it does **not** validate the content of `data.logs`. The function accepts any object inside `data` and passes it directly to `importBackup()`:

```ts
validateBackupPayload(parsed);
const result = await importBackup(parsed);
```

If a user (or attacker with access to the session, e.g. via a compromised device) imports a crafted backup JSON with unexpected `type` values, future timestamps, or malformed `data` blobs, those records will be written to Convex without client-side pre-screening. The Convex mutation should be the ultimate gatekeeper, but if the mutation's validators are permissive (accepting `v.any()` for the `data` field on logs), this creates a path for injecting bad records.

The risk is scoped to the logged-in user's own data (no cross-user attack vector), but a crafted backup could corrupt the user's dataset in ways that are hard to recover from, or could trigger unexpected code paths in the analysis pipeline.

**Suggested Fix:**
Add a second validation pass over `data.logs` before calling `importBackup`. Check that each log entry has a known `type` string from the allowed set, a numeric `timestamp`, and a `data` field that is at minimum an object. Reject the import if any log fails validation rather than silently dropping bad rows.

---

### [HIGH] `FoodMatchingModal` Queries Unbounded Result Sets at 160 Items Without Rate Limiting

**Category:** Performance
**Files:** `src/components/track/FoodMatchingModal.tsx:L95-L103`

**Description:**
When the modal opens with no search query and no active bucket, it immediately issues a Convex `useQuery` that requests 160 results:

```ts
limit: deferredSearchQuery.length > 0 ? 40 : activeBucketKey ? 80 : 160,
```

This query fires every time the modal opens. Because it is a live `useQuery` subscription (not a one-shot fetch), Convex will push updates to this query result whenever the underlying food table changes. Subscribing to 160 food registry entries is a non-trivial subscription cost, and it fires even when the user has no intention of interacting with the search box (e.g. if the modal auto-opens on queue mode).

**Suggested Fix:**
Use `"skip"` for the initial no-query, no-bucket state and only fire the query once the user has actually typed at least 1 character, or has selected a bucket. The existing guard `open ? ... : "skip"` already skips when the modal is closed, but does not skip the unfocused default state. A simple `deferredSearchQuery.length === 0 && !activeBucketKey ? "skip" : {...}` pattern would eliminate this cold-open over-fetch.

---

### [MODERATE] AI-Generated Markdown Rendered Without Content Length Guard in DrPooReportDetails

**Category:** Security
**Files:** `src/components/archive/DrPooReport.tsx:L93, L129, L169, L183`

**Description:**
AI-generated content (`clinicalReasoning`, `item.reasoning`, `educationalInsight.fact`, `suggestion`) is rendered via `<Markdown components={AI_MARKDOWN_COMPONENTS}>`. React-Markdown renders to React elements (not raw HTML), so standard XSS is not the concern. However, there is no cap on the size of these strings before they reach the DOM. A runaway AI response (or a corrupted `insight` record) with a very large payload (e.g. a megabyte of text) will render the entire string, causing UI jank or browser slowness.

The `MealIdeaCard` already guards against this at the tag-extraction level (`items.slice(0, 20)`), but the reasoning blocks have no equivalent.

**Suggested Fix:**
Add a character limit constant (e.g. `MAX_AI_CONTENT_CHARS = 4000`) and slice the string before passing to `<Markdown>`. Log a warning when content is truncated so it is detectable in production.

---

### [MODERATE] `RelativeTime` Component Creates One `setInterval` Per Visible Table Row

**Category:** Performance
**Files:** `src/components/patterns/database/columns.tsx:L141-L153`

**Description:**
The `RelativeTime` component is rendered inside every row of `DatabaseTable` for the "Last eaten" column:

```tsx
function RelativeTime({ timestamp }: { timestamp: number }) {
  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatRelativeTime(timestamp));
    }, RELATIVE_TIME_REFRESH_MS); // 60 seconds
    return () => clearInterval(id);
  }, [timestamp]);
```

With the default page size of 25 rows, this creates 25 simultaneous `setInterval` timers running every 60 seconds. At the maximum page size of 100 rows, that is 100 timers. Each interval also causes a setState call and re-render of that row. This compounds with TanStack Table's own reactivity.

Because the relative time only needs to update once a minute, and the values are coarse (minutes/hours/days), a single global timer would be far more efficient.

**Suggested Fix:**
Replace the per-instance `setInterval` with a global `useCurrentMinute()` hook (or a Zustand slice that holds the current-minute timestamp, updated by a single global interval). Each `RelativeTime` instance reads the current minute from the hook and computes the label inline — no local state, no local timer.

---

### [MODERATE] Smart View Names Are Stored to `localStorage` Without Length Validation

**Category:** Security
**Files:** `src/components/patterns/database/FilterSheet.tsx:L199-L205`

**Description:**
The "Save as view" form allows arbitrary text input and passes it directly to `onSaveView`:

```tsx
const handleSaveViewConfirm = useCallback(() => {
  const trimmed = viewName.trim();
  if (trimmed.length === 0) return;
  onSaveView(trimmed);
  // ...
```

There is no maximum length check on the view name. Upstream, the calling component stores the view object (including the name) into `localStorage` under `patterns-smart-views-v1`. An unusually long string (e.g. 100KB of text) would be stored in localStorage without complaint. While this cannot affect other users, it could degrade the user's own app performance through bloated localStorage and could cause UI rendering issues in the SmartViews pill bar.

**Suggested Fix:**
Add `maxLength={80}` to the `<input>` element in the save-view form, and add a `trimmed.length > 80` guard in `handleSaveViewConfirm` that shows a validation error and returns early.

---

### [MODERATE] `computeDailyAverages` in `BristolTrendTile` Uses `Date.now()` Twice in Same Render, Causing Potential Skew

**Category:** Performance
**Files:** `src/components/patterns/hero/BristolTrendTile.tsx:L84, L139-L142`

**Description:**
`computeDailyAverages` is called inside a `useMemo` with `Date.now()` at line 84, and separately the `currentAverage`/`previousAverage` memo also calls `Date.now()` at line 139-142. Both `useMemo` blocks are computed in the same render cycle, but JavaScript execution is not guaranteed to be instantaneous — in a low-end device under load, the two `Date.now()` calls could return different milliseconds, leading to a log entry near a 7-day boundary being counted in one block but not the other.

More importantly, neither memo has a stable `Date.now()` input — they will only re-run when `digestionData` changes. If the component stays mounted for a long time (the app is always-on), the day boundaries will drift silently without update.

**Suggested Fix:**
Accept a `nowMs` prop (like `TodayStatusRow` does) passed from a parent that controls the clock, or use a single `useCurrentMinute()` / `useCurrentDay()` hook that drives both memos from the same stable timestamp. This eliminates both the skew and the staleness issues.

---

### [MODERATE] Backup JSON Export Serialised With Full Log Data — No Size Guard

**Category:** Security / Performance
**Files:** `src/components/settings/app-data-form/useAppDataFormController.ts:L86-L89`

**Description:**
The full backup payload is serialised to JSON with 2-space indentation and directly turned into a Blob:

```ts
blob = new Blob([JSON.stringify(backup, null, 2)], {
  type: "application/json",
});
```

The `backup` object contains all synced logs. For a user with a long history, this could be a very large JSON file. The `null, 2` pretty-print option makes the file significantly larger than necessary. More importantly, there is no memory usage warning or size estimation before the operation. On a mobile device with limited RAM, serialising a large object and creating a Blob from it in the main thread could cause a noticeable jank or out-of-memory condition.

**Suggested Fix:**
Use `JSON.stringify(backup)` (no indentation) for the download blob to reduce file size. For developer readability, the pretty-print is unnecessary in the binary output. Optionally, estimate the log count and warn the user if it exceeds a threshold before proceeding.

---

### [MODERATE] `AiSuggestionsCard` Passes Raw `openAiApiKey` String to `generateSettingsSuggestions`

**Category:** Security
**Files:** `src/components/settings/AiSuggestionsCard.tsx:L36, L65-L68`

**Description:**
The raw API key string is retrieved from `useApiKeyContext()` and passed directly to `generateSettingsSuggestions(callAi, openAiApiKey, ...)`. If `generateSettingsSuggestions` logs its arguments for debugging (which would be a common developer mistake), the key would appear in the browser console. The key is also held in React component state throughout the component's lifetime.

The key should be treated as ephemeral and used only within the Convex action boundary. Passing it as a function argument through multiple layers of client-side code increases the surface area for accidental logging.

**Suggested Fix:**
Check that `generateSettingsSuggestions` and the underlying `callAi` wrapper never log the `apiKey` parameter. Prefer keeping the key retrieval as close to the Convex action call boundary as possible, rather than threading it through intermediate functions.

---

### [MODERATE] `FoodMatchingModal` — Food Request Ticket Includes Raw User Input Without Explicit Length Cap in Textarea

**Category:** Security
**Files:** `src/components/track/FoodMatchingModal.tsx:L618-L627`

**Description:**
The ticket submission textarea has `maxLength={300}` which is fine, but the food name being reported (`foodName`, line 599) is not sanitised or capped before being included in the submitted `submitFoodRequest` mutation:

```tsx
<p>"{foodName}" will be reviewed and added to the registry.</p>
```

The `foodName` is derived from AI parsing output or user-entered raw text (`currentFoodItem?.parsedName ?? currentFoodItem?.userSegment ?? "Food"`). If the AI parser returns an unusually long or specially formatted name, that string flows unmodified into the Convex mutation. The mutation validator is the authoritative guard here, but if the `foodRequests` schema accepts `v.string()` without a maxLength, long food names will be stored.

This is a defence-in-depth concern rather than an exploitable vulnerability.

**Suggested Fix:**
Verify that `api.foodRequests.submitRequest` uses `v.string()` with a reasonable `maxLength` validator, or add a client-side clamp: `const cappedFoodName = currentFoodName.slice(0, 200)` before passing it to the mutation.

---

### [MODERATE] `DrPooPreviewComponents.tsx` — `PreviewTextField` Key Uses Text Content as `key` Prop

**Category:** Performance
**Files:** `src/components/settings/tracking-form/DrPooPreviewComponents.tsx:L60-L63`

**Description:**
The bullet list items use the trimmed text as the React key:

```tsx
<li key={trimmed} className="...">
```

If two bullet points have the same text (e.g. two repeated suggestions in a preview), this will cause a React key collision, silently rendering only one of them. This is a correctness issue masquerading as a minor performance concern — duplicate keys cause React to reconcile incorrectly.

**Suggested Fix:**
Use a positional key: `key={index}` (or `key={`bullet-${index}`}`) since the list is purely presentational, static preview text and does not reorder.

---

### [MODERATE] `DatabaseTable` — `getFilteredRowModel().rows.length` Called on Every Render for Pagination Count

**Category:** Performance
**Files:** `src/components/patterns/database/DatabaseTable.tsx:L101`

**Description:**

```tsx
const totalRows = table.getFilteredRowModel().rows.length;
```

`getFilteredRowModel()` recomputes the full filtered row set and is called on every render of `DatabaseTable` to derive `totalRows`. TanStack Table memoises `getFilteredRowModel()` internally, so this is generally safe, but it is still called unconditionally. If filters are frequently changing (e.g. through a subscription-driven parent), this could trigger unnecessary recalculation.

More directly, `totalRows` is derived information that TanStack Table already exposes via `table.getFilteredRowCount()` (or equivalent), which avoids materialising the full row array.

**Suggested Fix:**
Replace `table.getFilteredRowModel().rows.length` with the table's built-in count accessor if available, or memoize the value: `const totalRows = useMemo(() => table.getFilteredRowModel().rows.length, [table])`. The latter ensures it only recomputes when the filtered model actually changes.

---

### [NICE-TO-HAVE] `ThemeProvider` Reads `localStorage` Synchronously During SSR-Incompatible Initialisation

**Category:** Security
**Files:** `src/components/theme-provider.tsx:L41-L43`

**Description:**
The `useState` initialiser directly calls `localStorage.getItem(storageKey)` at module load time:

```ts
const [theme, setTheme] = useState<Theme>(() => {
  const stored = localStorage.getItem(storageKey);
```

This is safe in this SPA (no SSR), but it means there is no guard against `localStorage` being unavailable (e.g. in a restricted browser privacy mode, or in an iframe with storage blocked). If `localStorage.getItem` throws, the component will crash without a fallback. This is a robustness concern, not a security one, but in a healthcare app where the user may be on a managed device with storage restrictions, it is worth guarding.

**Suggested Fix:**
Wrap the `localStorage.getItem` call in a try-catch and fall back to `defaultTheme` on failure.

---

### [NICE-TO-HAVE] `ArtificialIntelligenceSection` — Misleading Privacy Copy

**Category:** Security
**Files:** `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx:L49-L52`

**Description:**
The helper text reads: _"Your API key is stored securely on our servers and used to make requests on your behalf."_

However, based on the codebase, the API key is stored in **IndexedDB on the client device** (`useApiKeyContext` pulls from IndexedDB), not on a server. The `CloudProfileSection` more accurately describes the encryption: _"Your OpenAI API key is stored securely on our servers using AES-256-GCM encryption."_

If the key is encrypted server-side, the copy should match; if it is stored locally (IndexedDB only), the "our servers" claim is incorrect and misleading to users — a material concern for GDPR transparency.

**Suggested Fix:**
Audit whether the API key is stored locally (IndexedDB) or server-side (Convex), and update the copy to match reality. If it is locally stored, say "stored only on this device" — which is actually a stronger privacy claim.

---

### [NICE-TO-HAVE] `BmFrequencyTile` — `computeDailyCounts` Creates Date Objects in a Loop Without Memoisation

**Category:** Performance
**Files:** `src/components/patterns/hero/BmFrequencyTile.tsx:L36-L45`

**Description:**

```ts
for (let i = days - 1; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
  dateKeys.push(getDateKey(d.getTime()));
}
```

This runs inside `computeDailyCounts`, which is called from inside a `useMemo`. The function creates `SPARKLINE_DAYS` (7) `Date` objects on each computation. This is trivially cheap, but it also creates a new `Date()` to get `now`, meaning the reference time is captured at `computeDailyCounts` invocation time, not from a stable prop. If the parent re-renders at midnight, the date boundaries will shift unexpectedly mid-render. `BristolTrendTile` has the same pattern.

**Suggested Fix:**
Accept a `nowMs: number` parameter and derive the date from it, matching the pattern used in `TodayStatusRow`. This gives callers control over the reference time and makes the function deterministic.

---

## Summary

| Severity     | Count |
| ------------ | ----- |
| CRITICAL     | 0     |
| HIGH         | 3     |
| MODERATE     | 7     |
| NICE-TO-HAVE | 3     |

### High-Priority Items

1. **F1 — AI Error Exposure** (`AnalysisProgressOverlay`): Raw API error strings rendered directly in UI without redaction.
2. **F2 — Backup Import Validation Gap** (`useAppDataFormController`): Log content inside imported backups is not validated before being sent to Convex.
3. **F3 — Unbounded Cold-Open Query** (`FoodMatchingModal`): 160-item live subscription fires immediately on every modal open regardless of user intent.

### Notes for Convex Backend

The following were **not audited** (client-only scope), but are recommended follow-up checks:

- `api.foodRequests.submitRequest` — confirm `foodName` and `note` fields have `v.string()` length constraints.
- `api.foodParsing.searchFoods` — confirm `limit` parameter is bounded server-side (the client can currently request up to 160 items; verify the Convex function enforces a ceiling).
- `api.ai.chatCompletion` — confirm the `apiKey` parameter is never logged in Convex function logs.
