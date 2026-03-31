# Current State Architecture

> Updated 2026-03-17. Reflects ADR-0001 (cloud-only), server-side food pipeline (complete), client-initiated LLM matching, and ADR-0008 scope decisions (reproductive health descoped but gating not yet implemented, transit map in scope, prompt management downgraded).

## 1. Canonical Source of Truth

Convex is the sole persisted source of truth for all app data. There is no bidirectional sync, no IDB data storage, and no persist middleware.

### Data ownership

| Data type                            | Canonical source | How it works                                                                  |
| ------------------------------------ | ---------------- | ----------------------------------------------------------------------------- |
| Logs (food, fluid, BM, weight, etc.) | Convex only      | Direct mutations via `src/lib/sync.ts`, no local copy, no offline writes      |
| Profile settings                     | Convex only      | Read via `ProfileContext` (reactive query), write via `patchProfile` mutation |
| AI reports                           | Convex only      | Client invokes Convex actions, which relay to OpenAI and save reports         |
| Food trial summaries                 | Convex only      | Server-derived from logs + AI assessments                                     |
| Ingredient exposures                 | Convex only      | Created server-side by `processEvidence` after 6-hour window                  |
| OpenAI API key                       | IDB only         | Device-local via `idb-keyval`, read via `ApiKeyContext`                       |

### Data drift rules

- No bidirectional sync exists. Settings are Convex-owned, read reactively, written via mutations.
- Logs cannot diverge because there is no local copy.
- The OpenAI API key is device-local only and never stored in Convex. It is sent transiently to Convex actions via TLS.

Writes are not optimistic. The UI waits for Convex reactive queries to re-fire.

No offline write buffer exists. If Convex is unreachable, logging fails. There is no pending mutation queue, no retry logic, and no reconnect handler.

## 2. What Zustand Owns

The store is in `src/store.ts`. It is **ephemeral only** — no persist middleware, no IDB blob, no version migrations.

### Store ownership breakdown

| Category     | Fields                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------- |
| Derived      | `habitLogs` (rebuilt from Convex logs), `baselineAverages` + hash                        |
| Transient UI | `aiAnalysisStatus`, `aiAnalysisError`, `paneSummaryCache`                                |
| Actions      | `addHabitLog`, `setHabitLogs`, `removeHabitLog`, `setAiAnalysisStatus`, `markInsightRun` |

Zustand holds **no settings, no profile data, no persisted state**. All settings (habits, fluid presets, unit system, health profile, AI preferences, food personalisation) are owned by Convex and accessed via `ProfileContext`. Pending Dr. Poo replies are stored in the Convex `conversations` table, not in local state.

## 3. What IndexedDB Owns

IDB stores exactly one thing: the user's OpenAI API key, via `idb-keyval`.

There is **no**:

- Zustand blob in IDB
- Persist middleware
- Settings cache
- Sync queue
- Migration metadata
- Version-gated data migrations

A one-time legacy migration function (`migrateLegacyStorage` in `src/lib/migrateLegacyStorage.ts`, invoked via the `LegacyMigration` component in `routeTree.tsx`) reads the old `"ostomy-tracker-storage"` IDB blob (if present), backfills only missing cloud profile fields, then deletes the legacy blob.

## 4. Provider and Context Stack

### Entry point (`src/main.tsx`)

```
ClerkProvider
  └── ConvexProviderWithClerk
        └── ThemeProvider
              └── TooltipProvider
                    └── App (RouterProvider)
```

### Authenticated app layout (`routeTree.tsx` → `AppLayout`)

```
Authenticated (Convex)
  └── ApiKeyProvider        — IDB-backed OpenAI API key
        └── ProfileProvider — Convex profile query (reactive)
              └── LegacyMigration (side-effect only)
              └── SyncedLogsProvider (route-conditional)
                    └── <Outlet />
```

`SyncedLogsProvider` is only mounted for routes that need domain logs (`/`, `/patterns`, `/settings`, `/menu`).

### Contexts

| Context             | Source         | Purpose                                                 |
| ------------------- | -------------- | ------------------------------------------------------- |
| `ProfileContext`    | Convex query   | All profile settings (habits, units, preferences, etc.) |
| `ApiKeyContext`     | `idb-keyval`   | OpenAI API key read/write                               |
| `SyncedLogsContext` | Convex queries | Domain logs for display and computation                 |

## 5. Routing

TanStack Router. Route tree defined in `src/routeTree.tsx`.

| Path             | Component                  |
| ---------------- | -------------------------- |
| `/home`          | `LandingPage` (public)     |
| `/terms`         | `TermsPage` (public)       |
| `/privacy`       | `PrivacyPage` (public)     |
| `/api-key-guide` | `ApiKeyGuidePage` (public) |
| `/`              | `Track` (auth required)    |
| `/patterns`      | `Patterns` (auth required) |
| `/settings`      | `Settings` (auth required) |
| `/archive`       | `Archive` (auth required)  |
| `/menu`          | `Menu` (auth required)     |
| `/habits`        | Redirect → `/`             |
| `/calibration`   | Redirect → `/settings`     |

All protected routes render inside `AppLayout` which gates on Clerk `<Authenticated>`.

## 6. Convex Schema Tables

| Table                 | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `logs`                | All user log entries (food, fluid, digestion, habit, weight, etc.) |
| `ingredientExposures` | One row per resolved ingredient per food log (server-created)      |
| `ingredientOverrides` | User-set manual verdicts: safe / watch / avoid                     |
| `ingredientProfiles`  | Nutritional + classification data per canonical ingredient         |
| `aiAnalyses`          | Full AI report snapshots                                           |
| `conversations`       | Dr. Poo chat messages (linked to reports)                          |
| `foodAssessments`     | Per-food AI verdicts extracted from reports                        |
| `reportSuggestions`   | Dr. Poo suggestions extracted from reports                         |
| `foodTrialSummary`    | Fused deterministic + AI food scores per user per canonical food   |
| `weeklyDigest`        | Server-computed aggregate stats per calendar week                  |
| `weeklySummaries`     | AI-generated weekly narrative summaries                            |
| `profiles`            | User profile: units, habits, fluid presets, AI preferences, etc.   |
| `foodLibrary`         | User food library: ingredient and composite entries                |
| `waitlistEntries`     | Pre-launch waitlist sign-ups (no auth required)                    |

## 7. Server-Side Food Pipeline

All food processing is server-side. The client saves raw text only.

### Data flow

```
User types raw input
  → logs.add mutation (saves rawInput, empty items[])
    → scheduler.runAfter(0) → processLogInternal
      → splits rawInput, matches against FOOD_REGISTRY
        → resolved items: resolvedBy="registry"
        → unresolved items: no resolvedBy, no canonicalName
      → scheduler.runAfter(6h) → processEvidence
        → unresolved items expired to resolvedBy="expired", canonicalName="unknown_food"
        → resolved items become ingredientExposure rows
```

### LLM matching (client-initiated, BYOK)

Between `processLog` and `processEvidence`, the client hook `useFoodLlmMatching.ts` detects unresolved items and dispatches a Convex action:

```
useFoodLlmMatching (client hook)
  → detects logs with items where canonicalName=null and resolvedBy=null
  → calls convex/foodLlmMatching.ts::matchUnresolvedItems action
    → calls OpenAI with user's API key (sent transiently, never stored)
    → calls applyLlmResults internalMutation → resolvedBy="llm"
```

### User manual resolution

`FoodMatchingModal.tsx` (client) lets users manually resolve unresolved items. Calls `resolveItem` mutation → `resolvedBy="user"`.

### Pipeline modules

| Module                                       | Role                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `convex/foodParsing.ts`                      | `processLog`, `processLogInternal`, `processEvidence`, `applyLlmResults`, `resolveItem` |
| `convex/foodLlmMatching.ts`                  | `matchUnresolvedItems` action (LLM binary match + web search)                           |
| `src/hooks/useFoodLlmMatching.ts`            | Client hook: detects unresolved logs, dispatches LLM action                             |
| `src/hooks/useFoodParsing.ts`                | Client hook: saves rawInput only, triggers server pipeline                              |
| `src/hooks/useUnresolvedFoodQueue.ts`        | Builds queue of pending items for modal                                                 |
| `src/hooks/useUnresolvedFoodToast.ts`        | Shows toast prompting user to review unresolved items                                   |
| `src/components/track/FoodMatchingModal.tsx` | User-facing manual resolution UI                                                        |

### Shared food utilities (`shared/`)

The `shared/` directory sits at repo root. Both `src/` and `convex/` import from it. Path alias: `@shared/*`.

| Module                           | Purpose                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`         | `FOOD_REGISTRY` static data, lookup functions by canonical name                          |
| `shared/foodCanonicalization.ts` | `canonicalizeKnownFoodName`, `getFoodZone`                                               |
| `shared/foodParsing.ts`          | `splitRawFoodItems`, `parseLeadingQuantity`, `sanitiseFoodInput`, deterministic matching |
| `shared/foodNormalize.ts`        | `normalizeFoodName`, `formatFoodDisplayName`                                             |
| `shared/foodEvidence.ts`         | `buildFoodEvidenceResult`, transit resolver, evidence summaries                          |
| `shared/foodProjection.ts`       | `resolveCanonicalFoodName`, `getLoggedFoodIdentity`, `getCanonicalFoodProjection`        |
| `shared/foodTypes.ts`            | Shared types: `TransitCalibration`, `FoodPrimaryStatus`, etc.                            |

`src/lib/foodParsing.ts` is a thin re-export layer. All deterministic parsing logic lives in `shared/foodParsing.ts`.

### Convex tsconfig for shared access

`convex/tsconfig.json` includes `"../shared/**/*"` in its `include` array. No `paths` alias needed in the Convex config — imports use relative paths (`../shared/foodParsing`).

## 8. What AI Is Allowed to Do

AI does not overwrite user logs. Schema separation is enforced:

- `logs`: user factual data. AI never mutates these.
- `aiAnalyses`: full report snapshots.
- `foodAssessments`: AI-derived per-food verdicts from reports.
- `foodTrialSummary`: fused deterministic + AI scores.
- `ingredientExposures`: server-created from resolved items, not AI-authored.

### Where AI and heuristics overlap

- `foodTrialSummary` includes `codeScore` (deterministic) and `aiScore` (AI-derived), combined as `combinedScore`.
- `buildFoodEvidenceResult()` (in `shared/foodEvidence.ts`) runs in two places:
  - Client-side in `SyncedLogsContext.tsx` for real-time UI.
  - Server-side in `computeAggregates.ts` for persisted summaries.
- `ingredientOverrides` lets users manually override verdicts to `safe`, `watch`, or `avoid`.

### Known constraint gaps

- No explicit confidence/provenance metadata on cached insights.
- AI assessments are persisted as historical records and also fed back into future AI prompts, creating a feedback loop.

## 9. Derived vs Persisted

| Data                 | Persisted or derived | Location                                                                              |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Transit calibration  | Derived then cached  | `buildFoodEvidenceResult()` → Zustand cache, then patched to Convex `profiles`        |
| Food safety statuses | Both                 | Real-time derived on client; persisted after AI report in `foodTrialSummary` (Convex) |
| Baseline averages    | Derived then cached  | `useBaselineAverages` hook, cached in Zustand with hash-based invalidation            |
| Hero metrics         | Derived              | Computed in components from reactive `useSyncedLogs` query, not stored                |
| Habit logs           | Derived then cached  | Rebuilt from Convex logs via `rebuildHabitLogsFromSyncedLogs()`, cached in Zustand    |
| Weekly digests       | Persisted            | Server-computed in `computeAggregates.ts`, stored in `weeklyDigest`                   |
| Pattern summaries    | Both                 | `foodTrialSummary` (Convex) and real-time `buildFoodEvidenceResult()` (client)        |
| Ingredient exposures | Persisted            | Created server-side by `processEvidence` after 6h window                              |

## 10. PWA Configuration

The app is a PWA via `vite-plugin-pwa`. Service worker registered in `src/registerServiceWorker.ts`. The Workbox config caches static assets and fonts. Network requests to Convex are never cached — the app is online-only and fails explicitly if Convex is unreachable.

## 11. Remaining Architectural Debt

### Should be consolidated

- `buildFoodEvidenceResult()` runs both client-side (`SyncedLogsContext`) and server-side (`computeAggregates.ts`). Outputs can diverge when client logs are newer than the last server recompute. The canonical path should be server-side only.
- `aiAnalyses.ts` has grown large and may benefit from splitting.

### Can remain transitional

- `habitLogs` in Zustand for derived, quick UI access.
- `paneSummaryCache` in Zustand for ephemeral UI summaries.
- Stripe integration (`convex/stripe.ts`) is stubbed but not wired to the UI.
- Gamification layer (schema exists but is underused).

## Bottom line

The architecture is **cloud-only** (ADR-0001). Convex owns all persisted domain data. Zustand is ephemeral UI state. IDB stores only the OpenAI API key. There is no offline mode, no bidirectional sync, and no persist middleware.

The food pipeline is fully server-side: raw input is saved, `processLog` runs deterministic registry matching, the client initiates LLM matching via BYOK, and `processEvidence` creates `ingredientExposures` 6 hours later.

The highest remaining architectural risk is duplicated food-evidence computation across client and server (`buildFoodEvidenceResult`) plus missing provenance metadata on AI-derived data.
