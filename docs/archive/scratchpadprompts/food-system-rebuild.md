# Food System Rebuild — Current State

**Updated:** 2026-03-15
**ADR:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md)
**Assessment:** [food-system-legacy-assessment.md](./food-system-legacy-assessment.md)

---

## Phase Status

| Phase | Description                                                                          | Status                                               |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1     | Registry + deterministic canonicalization                                            | **Complete**                                         |
| 2     | LLM canonicalization, lineOrder, legacy cleanup                                      | **Complete**                                         |
| 2.5   | Hierarchy revision: `TransitLine` → `FoodGroup` + `FoodLine`                         | **Complete**                                         |
| 3     | Evidence pipeline (`foodEvidence.ts`, `analysis.ts`)                                 | **Complete**                                         |
| 4     | Convex layer migration (game layer deletion + normalization)                         | **Complete**                                         |
| 4.5   | Food pipeline data quality fixes (normalization, parsing, registry gaps)             | **Complete**                                         |
| 4.6   | Server-side food pipeline redesign (rawInput, LLM binary matching, user matching UI) | **Complete — All 11 tasks implemented (2026-03-14)** |
| 5     | Transit map UI + game layer rebuild                                                  | **In Progress**                                      |
| E     | Data-driven transit map foundation (`useTransitMapData`)                             | **Complete**                                         |

---

## File Manifest

### Active Food System Files

| File                                            | Lines | Description                                                                                                                                                                                                                | Status             |
| ----------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `shared/foodRegistry.ts`                        | ~2858 | Single source of truth. ~117 canonicals, 4 groups, 11 sub-lines. Types: `FoodGroup`, `FoodLine`, `FoodRegistryEntry`. Helpers: `getFoodGroup`, `getFoodLine`, `getFoodsByLine`, `getLinesByGroup`, display name functions. | Stable             |
| `shared/foodCanonicalization.ts`                | ~145  | Deterministic canonicalization from registry. Returns `string \| null`. Re-exports all registry types and helpers.                                                                                                         | Stable             |
| `shared/foodNormalize.ts`                       | ~80   | String normalization: lowercase, trim, singularize, strip quantities, synonym mapping. Shared utility, no domain logic.                                                                                                    | Stable             |
| `shared/foodEvidence.ts`                        | ~250  | Bayesian evidence pipeline. `buildFoodTrials`, `primaryStatusFromSignals`, `normalizeAssessmentRecord`. Registry canonicalization + fallback.                                                                              | Stable             |
| `shared/foodTypes.ts`                           | ~30   | Shared type definitions for food assessment types (verdict, confidence, causal role, etc.)                                                                                                                                 | Stable             |
| `shared/foodParsing.ts`                         | ~150  | Shared parsing utilities: `splitRawFoodItems`, `sanitiseFoodInput`, `parseLeadingQuantity`. Used by both client (`src/`) and server (`convex/`).                                                                           | Added (Phase 4.6)  |
| `convex/foodParsing.ts`                         | ~491  | Server-side food processing mutation. Triggered by `ctx.scheduler.runAfter(0, ...)` after log save. Splits rawInput, extracts quantities, runs registry matching. Writes items back to log.                                | Added (Phase 4.6)  |
| `convex/foodLlmMatching.ts`                     | ~461  | LLM binary matching action. Receives unresolved items, sends to OpenAI with registry vocabulary, writes `resolvedBy: "llm"` results back. Client-initiated (BYOK pattern).                                                 | Added (Phase 4.6)  |
| `src/lib/foodLlmCanonicalization.ts`            | ~223  | LLM canonicalization using registry vocabulary (old client-side path). `buildRegistryVocabularyPrompt()`, `postProcessCanonical`. Still used by legacy `src/lib/foodParsing.ts`.                                           | Stable (legacy)    |
| `src/lib/foodParsing.ts`                        | ~450  | Client-side food parsing (legacy path). Registry-aware system prompt. `postProcessCanonical` wired in. May be superseded by `convex/foodParsing.ts` in Phase 5 cleanup.                                                    | Legacy (Phase 2)   |
| `src/lib/foodStatusThresholds.ts`               | ~145  | Threshold constants and Bristol math only. Legacy zone/category lookups removed. `legacyStageToZone` deleted (Phase 4).                                                                                                    | Migrated (Phase 4) |
| `src/hooks/useFoodParsing.ts`                   | ~200  | Food parsing hook. Fixed: preserves original food name in logs (was overwriting with canonical).                                                                                                                           | Fixed (Phase 2.5)  |
| `shared/__tests__/foodCanonicalization.test.ts` | ~250  | 30 tests covering all zones, collapsed canonicals, renamed entries, new entries.                                                                                                                                           | Current            |
| `shared/__tests__/foodEvidence.test.ts`         | ~150  | 3 tests covering evidence pipeline, avoid classification, assessment normalization.                                                                                                                                        | Current            |

### Migrated in Phase 4

| File                            | Change                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/foodLibrary.ts`         | `normalizeCanonicalName` delegates to `canonicalizeKnownFoodName` + `normalizeFoodName`. Dead `stationDefinitions` refs removed from `mergeDuplicates`. |
| `convex/ingredientOverrides.ts` | Same pattern: `canonicalizeKnownFoodName` + `normalizeFoodName` fallback.                                                                               |
| `convex/extractInsightData.ts`  | Added `canonicalizeKnownFoodName` — was using only `normalizeFoodName`.                                                                                 |
| `convex/ingredientExposures.ts` | Same pattern: registry canonicalization in `normalizeCanonicalName`.                                                                                    |
| `convex/ingredientProfiles.ts`  | Same pattern: registry canonicalization in `normalizeCanonicalName`.                                                                                    |

### Deleted in Phase 4

| File                                             | Reason                                 |
| ------------------------------------------------ | -------------------------------------- |
| `convex/stationDefinitions.ts`                   | Game layer — orphaned, wrong taxonomy  |
| `convex/ingredientTemplates.ts`                  | Game layer — wrong canonical names     |
| `convex/trialSessions.ts`                        | Game layer — no UI                     |
| `convex/gameState.ts`                            | Game layer — orphaned                  |
| `convex/data/ingredientTemplatesSeed.ts`         | 107 entries unreconciled with registry |
| `convex/trialSessions.test.ts`                   | Tests for deleted code                 |
| `src/lib/trialEngine.ts` (+test)                 | Game trial logic — no UI               |
| `src/components/patterns/TrialResultToast.tsx`   | Game layer UI artifact                 |
| `src/components/patterns/hero/MindTheGapBar.tsx` | Game layer UI artifact                 |

### Deleted in Phase 2.5

| File                                                         | Reason                                    |
| ------------------------------------------------------------ | ----------------------------------------- |
| `src/lib/foodCategoryMapping.ts`                             | Redundant — `group`/`line` on every entry |
| `src/lib/transitMapLayout.ts`                                | Legacy transit map layout                 |
| `src/lib/pointsEngine.ts` (+test)                            | Legacy points engine                      |
| `src/components/patterns/transit-map/StationDetailPanel.tsx` | Legacy transit UI                         |
| `src/components/patterns/transit-map/TransitMap.tsx`         | Legacy transit map component              |
| `src/pages/secondary_pages/TransitMapTest.tsx` (+route)      | Legacy test page                          |

### Consumer Files (Updated in Phase 2.5)

| File                                               | What changed                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Patterns.tsx`                           | Uses `getFoodGroup` from registry. TransitMap removed.                                                                                      |
| `src/pages/secondary_pages/Menu.tsx`               | Uses `getFoodGroup`/`getGroupDisplayName` from registry.                                                                                    |
| `src/components/patterns/database/columns.tsx`     | `FoodGroup` replaces `LineCategory`. `GROUP_COLORS` replaces `LINE_COLORS`.                                                                 |
| `src/components/patterns/database/FilterSheet.tsx` | `FoodGroup` filter options (4 groups).                                                                                                      |
| `src/components/patterns/database/SmartViews.tsx`  | `foodGroup` field replaces `lineCategory`.                                                                                                  |
| `src/lib/trialEngine.ts`                           | Inlined `getStreakMultiplier` (from deleted pointsEngine). `LineCategory` → `string`.                                                       |
| `src/types/domain.ts`                              | `LineCategory`, `LINE_COLORS`, `TransitLine` interface removed. `GROUP_COLORS` added. `StationDefinition.lineCategory` widened to `string`. |
| `src/routeTree.tsx`                                | TransitMapTest route removed.                                                                                                               |

---

## Phase 3 — Evidence Pipeline (Complete)

**Goal:** Wire registry canonicalization into the evidence engine so trial data groups correctly.

**Completed 2026-03-12.** All 4 fixes implemented:

1. `foodEvidence.ts:buildFoodTrials` + `normalizeAssessmentRecord` — registry lookup with fallback
2. `analysis.ts` BRAT baseline — `"plain white toast"` → `"toast"`
3. `foodEvidence.ts:primaryStatusFromSignals` — split avoid/watch (severeLowConfounderCount >= 2 → avoid)
4. `analysis.ts` dead correlation code deleted (~150 lines): `resolveAllCorrelations`, `buildCorrelations`, `outcomeFromTransitAndCategory`, `ResolvedTrial`, `CorrelationRow`, transit constants
5. Test updated: `foodEvidence.test.ts` "rice" → "white rice" (registry canonical). "Avoid" test now passes.

---

## Phase 4 — Convex Layer Migration (Complete)

**Goal:** Delete the broken game layer. Move shared code to `shared/`. Unify normalization.

**Completed 2026-03-13.** All 3 workstreams executed:

Plan: [2026-03-13-phase-4-convex-migration.md](../archive/plans/2026-03-13-phase-4-convex-migration.md)

### Workstream 1: Game layer deletion

Deleted 4 Convex tables (`stationDefinitions`, `ingredientTemplates`, `trialSessions`, `gameState`), 6 Convex modules, seed data, `trialEngine.ts`, game layer hooks from `sync.ts`, game layer types from `domain.ts`, `legacyStageToZone`, `TrialResultToast`, `MindTheGapBar`. Updated `Patterns.tsx` to use `getFoodZone()` from registry. Cleaned backup/restore and migrations.

### Workstream 2: `shared/` directory

Moved `foodRegistry.ts`, `foodCanonicalization.ts`, `foodNormalize.ts`, `foodEvidence.ts` to `shared/` at repo root. Created `shared/foodTypes.ts` for shared type definitions. Added `@shared/*` path alias. Updated all imports in `src/` and `convex/`. Tests moved to `shared/__tests__/`.

### Workstream 3: Normalization unification

Replaced divergent `normalizeCanonicalName()` implementations in `foodLibrary.ts`, `ingredientOverrides.ts`, `ingredientExposures.ts`, `ingredientProfiles.ts`, and `extractInsightData.ts` with `canonicalizeKnownFoodName()` + `normalizeFoodName()` fallback — the same pattern used by the evidence pipeline since Phase 3.

### Tables kept

- `ingredientOverrides` — clean concept (manual safe/watch/avoid), UI wiring deferred to Phase 5
- `ingredientExposures` — per-ingredient exposure tracking
- `ingredientProfiles` — ingredient metadata

---

## Phase 5 — Transit Map UI + Evidence Pipeline Fixes (Planned — 2026-03-13)

**Goal:** Build a new data-driven transit map component and fix critical evidence pipeline bugs.

**Design:** Full design decisions documented in [transitmap.md](../scratchpadprompts/transitmap.md) (Phase 5 Planning Session section).

**Note:** The old TransitMap component (`src/components/patterns/transit-map/TransitMap.tsx`) was deleted in Phase 2.5 along with related UI artifacts. A `useTransitMapData` hook exists (Phase E). The new transit map UI is a greenfield build.

### Phase 5 scope

**Transit map UI (new build):**

1. 3 zoom levels: corridor cards → corridor detail (default) → line detail
2. `useTransitMapData()` hook — registry + evidence pipeline → map data
3. "Next stop" logic using `lineOrder` (currently unused)
4. Station Inspector with transit-themed progressive disclosure
5. Pan/zoom via `react-zoom-pan-pinch`
6. Side-by-side toggle with existing map
7. 46 new food artwork PNGs needed (30 exist, `#1e293b` circle backgrounds)

**Bug fixes (prerequisite):**

8. ~~Bristol 5 classified as "loose"~~ — FIXED (2026-03-13)
9. ~~Food names include qty/unit~~ — FIXED (2026-03-13)
10. ~~Ghost food entries from AI assessments~~ — FIXED (2026-03-13)
11. Transit window: 6h minimum not enforced, 18h cap too narrow
12. Bristol language audit — "firm" must not appear in UI
13. LLM forced canonicalization with confidence levels
14. ~~Alias-shadowing / wrong-zone deterministic matches~~ — FIXED (2026-03-13)
15. ~~Client/server evidence divergence from truncated client logs~~ — FIXED (2026-03-13)
16. ~~Automatic client-side transit calibration overwrite path~~ — FIXED (2026-03-13)
17. ~~Displayed history collapsing to canonicals/components~~ — FIXED (2026-03-13)

**Deferred to Phase 5+ / Phase 6:**

- Registry CRUD (create, edit, delete custom entries)
- Manual food matching UI
- Deep linking from Dr. Poo / Menu → transit map station
- `analyzeLogs` shared context lift (PERF-001/004)
- `buildFoodEvidenceResult` consolidation (server-only)
- Reward/milestone system (celebrations)
- `ingredientOverrides` UI wiring
- AI column visual badges
- Trend calculation sensitivity improvement
- `Zone` type consolidation (`foodStatusThresholds.ts` vs `FoodZone` from registry)
- Schema cleanup: legacy verdict values

---

## 2026-03-13 Audit Follow-up

This follow-up re-investigated the live code after Phases 1–4 to confirm the
actual runtime behavior, not the intended design.

### Confirmed current behavior

- `src/lib/foodParsing.ts` is now deterministic-first in runtime code.
- Known inputs are resolved locally against the registry before any model call.
- GPT-5 mini is only called for unresolved fragments, one fragment at a time.
- Deterministic and LLM-resolved fragments are merged back in original order.
- `shared/foodCanonicalization.ts` now fails fast on duplicate normalized aliases.
- `shared/foodRegistry.ts` no longer contains the `"chili"`, `"rice cake"`, or
  `"mild herb"` cross-canonical collisions that previously broke deterministic
  parsing.
- `shared/foodEvidence.ts` and today-log UI paths prefer `rawName` for display,
  while evidence still groups by canonical names internally.
- Client evidence surfaces use `useAllSyncedLogs()` and therefore full synced
  logs rather than a truncated client slice.
- Client-side transit calibration is currently read from profile state; the
  automatic client learning/persist loop described in older audit notes is not
  the active behavior anymore.

### Files updated in this follow-up

- `shared/foodRegistry.ts`
- `shared/foodCanonicalization.ts`
- `src/lib/foodParsing.ts`
- `src/hooks/useFoodParsing.ts`
- `shared/foodEvidence.ts`
- `src/components/track/today-log/helpers.ts`
- `src/components/track/today-log/editors/FoodSubRow.tsx`
- `shared/__tests__/foodCanonicalization.test.ts`
- `src/lib/__tests__/foodParsing.behavior.test.ts`
- `src/lib/__tests__/foodParsing.test.ts`

### Why this matters for Phase 5

Phase 5 can now assume:

- the registry is injective after normalization
- the parser is registry-first and deterministic-first
- history text can stay human/raw while map/evidence logic uses canonicals
- current client evidence outputs are using the same effective log scope as the
  main server recomputation surfaces

That removes four large sources of ambiguity from the transit-map rebuild:
parser trust, alias collisions, stale history text, and truncated-log mismatch.

---

## Phase 4.5 — Food Pipeline Data Quality Fixes (Complete — 2026-03-14)

**Goal:** Fix bugs where normalization missed standalone units, the `name` field stored raw text with quantities, and common foods were missing from the registry.

**Completed 2026-03-14.** Three fixes implemented:

### Fix 1: `normalizeFoodName` — standalone units and punctuation

`shared/foodNormalize.ts` now strips:

- Leading punctuation (`/`, `-`, `*`, `#`)
- Trailing punctuation (`.`, `,`, `;`, etc.)
- Hyphens → spaces (`lactose-free` → `lactose free`)
- Standalone unit words without leading digits (`"G Pasta"` → `"pasta"`, `"Grams of Cottage Cheese"` → `"cottage cheese"`, `"Teaspoon Of Jam"` → `"jam"`)

14 new tests. All historical data benefits retroactively since normalization runs at every read boundary.

### Fix 2: `buildDeterministicItem` — store parsed name

`src/lib/foodParsing.ts:360` — `component.name` now set to `parsedName` (e.g. `"rice"`) instead of `trimmedOriginal` (e.g. `"200 grams of rice"`). Quantity and unit are already in their own fields. `rawName` preserves the user's original segment text.

2 new tests.

### Fix 3: Registry additions

- Turkey (bare) → example under `"grilled white meat"` (Zone 2, deli-style sliced roast)
- Baguette, french bread, crusty bread → examples under `"white bread"` (Zone 1)
- Lactose-free cream cheese → example under `"cream cheese"` (Zone 2)
- New canonical `"peeled apple"` (Zone 2) — skin removed, reduced insoluble fibre
- New canonical `"raw apple"` (Zone 3) — with skin, high fibre. Bare `"apple"` maps here.
- Pork already covered under `"red meat"` — no change needed.

8 new tests. Convex test fixtures updated (3 files) since "baguette" now resolves via registry.

**Verification:** 299/299 tests pass, typecheck clean, build succeeds.

---

## Phase 4.6 — Server-Side Food Pipeline (Complete — 2026-03-14)

**Goal:** Save the user's raw food text immediately and immutably, move all parsing to the server, simplify the LLM to binary matching, and add a manual matching UI for truly unknown foods.

**Status:** All 11 tasks implemented. See `docs/scratchpadprompts/transitmap.md` for full implementation log.

**Plan:** [`docs/plans/2026-03-14-server-side-food-pipeline.md`](./2026-03-14-server-side-food-pipeline.md)

### Why

The current pipeline transforms data on the client before storing it. The user's original text is lost forever after parsing — only comma-split segments survive. Parsing is fragile (client-side, network-dependent), the LLM gets degraded input (isolated segments, not full meal context), and unknown foods are silently auto-added to the foodLibrary with no gate.

### What changes

1. **rawInput preserved** — Full sentence stored immutably in the `logs` table. Never edited by processing.
2. **Server-side parsing** — All splitting, quantity extraction, registry matching, and LLM calls happen in Convex, triggered by `ctx.scheduler.runAfter(0, ...)` after the log is saved.
3. **Field renames** — `name` → `parsedName`, `rawName` → `userSegment`, new `resolvedBy` field tracks how each item was matched (registry/llm/user).
4. **LLM binary matching** — The LLM receives a simple task: "match this item to the registry list, or say NOT_ON_LIST." No confidence scores, no category invention.
5. **User manual matching UI** — Items the LLM can't match surface via persistent toast notification with a 6-hour resolution window (maps to transit biology). User matches via registry dropdown or zone×group classification matrix (12 "other" buckets).
6. **Meal held until resolved** — Entire meal blocked from downstream processing (ingredientExposures, evidence pipeline) until all items have a canonicalName. No partial data.
7. **Default portions** — Registry entries get `defaultPortion` field. Applied when user doesn't specify quantity (toast=2sl, rice=150g, yogurt=125g, meat=100g, etc.).
8. **Registry locked at runtime** — No user, LLM, or code can add entries. Only developers.
9. **Editing** — Users edit timestamp/quantities/units directly. To change foods, they edit the raw text via a modal, triggering full reprocessing.

### Key design decisions

- `parseStatus` field NOT needed — derived from items: if any item has `canonicalName === undefined`, meal is waiting.
- 6-hour window: hours 0-3 = "tap to fix" toast, hours 3-6 = "[Fix now] [Delete]" toast, hour 6 = auto-delete.
- Canonicals = digestive categories, not food names. Registry is ~200 entries max covering post-anastomosis western diet.
- Zone 3 uses broad categories (confectionery, processed meat, raw vegetables) not individual foods.

### 11 tasks (all complete)

1. [x] Rename food item fields in validator
2. [x] Add `rawInput` to food log data
3. [x] Add default portions to registry
4. [x] Extract shared parsing utilities to `shared/foodParsing.ts`
5. [x] Create server-side food processing mutation (`convex/foodParsing.ts`)
6. [x] Create LLM binary matching action (`convex/foodLlmMatching.ts`)
7. [x] Simplify `useFoodParsing.ts` to just save raw text
8. [x] Handle unresolved meals in Track page UI
9. [x] Build manual matching modal (`FoodMatchingModal`)
10. [x] Build raw text editing modal (`RawInputEditModal`)
11. [x] End-to-end verification
