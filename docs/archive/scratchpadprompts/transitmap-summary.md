# Caca Traca — Master Project Narrative

> Last updated: 2026-03-15
> Branch: `feature/v1-sprint` (off `master`)
> Purpose: Authoritative record of what was planned, what was built, where implementations diverged from specs, and what remains.

---

## Contents

1. [Product Context](#1-product-context)
2. [V1 Sprint — What Was Planned](#2-v1-sprint--what-was-planned)
3. [Food System — Phases 1–4 (Registry, Evidence, Convex)](#3-food-system--phases-14)
4. [Server-Side Food Pipeline (Phase 5 of food system)](#4-server-side-food-pipeline)
5. [Spec vs Reality — Where Implementations Diverged](#5-spec-vs-reality)
6. [ADR References](#6-adr-references)
7. [Browser Testing Session — Bugs Found and Fixed](#7-browser-testing-session)
8. [E2E Test Suite](#8-e2e-test-suite)
9. [What Remains](#9-what-remains)
10. [Phase 5 — Transit Map UI + Game Layer Rebuild](#10-phase-5--transit-map-ui--game-layer-rebuild)
11. [Architecture Summary](#11-architecture-summary)

---

## 1. Product Context

Caca Traca is an anastomosis food reintegration tracker for post-reconnective surgery. It logs food, fluid, habits, activities, and digestion events, then correlates them with digestive outcomes using Bristol Stool Scale ratings. The user is actively recovering from anastomosis surgery. The app is also being developed as a future product for others in the same situation.

**Core promise:** Help users understand food-to-bowel-movement transit timing and emerging patterns. Feel more trustworthy and coherent than existing tools.

**Non-negotiable constraints established early:**

- Raw log data (food entries, BM records, fluid logs, habit logs, timestamps) is sacred and must never be touched or transformed destructively.
- Dr. Poo conversation history and reports must be preserved.
- All legacy derived analytics (transit times, canonical groupings, zone assignments, food safety scores) were broken and can be deleted without concern.
- The legacy engine never produced usable results — no backwards compatibility shims needed.

---

## 2. V1 Sprint — What Was Planned

The `v1_sprint_tasks.md` documents 12 atomic tasks across 3 phases, all addressing issues found during initial browser testing.

### Phase 1 — Data Integrity (Tasks 1–6)

| Task | Issue                                                                        | Status       |
| ---- | ---------------------------------------------------------------------------- | ------------ |
| 1    | AI text pollution in food database (#91) — ~160 fake entries from AI reports | Open (BT-91) |
| 2    | Bristol classification wrong — majority-rules thresholds (#92)               | Open (BT-92) |
| 3    | Food deduplication — 199 foods should be ~40 (#27)                           | Open (BT-27) |
| 4    | Building evidence threshold — 21+ trial foods stuck in "building" (#87)      | Open (BT-87) |
| 5    | Food trial count merging — bread variants collapsed incorrectly (#86)        | Open (BT-86) |
| 6    | Status logic thresholds too aggressive (#28)                                 | Open (BT-28) |

### Phase 2 — Track Page Fixes (Tasks 7–9)

| Task | Issue                                                                                                                      | Status       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 7    | Today log text overflow — expanded items push buttons off screen (#82)                                                     | Open (BT-82) |
| 8    | Date header duplication — global header + page header (#83)                                                                | Open (BT-83) |
| 9    | Batch of 5 small bugs: BM time layout, hero label overlap, Dr Poo archive link dup, "Last tested" column, alert badge size | Partial      |

### Phase 3 — Broken Track Features (Tasks 10–12)

| Task | Issue                                                            | Status       |
| ---- | ---------------------------------------------------------------- | ------------ |
| 10   | Revert fluids section to simple design (#6)                      | Open (BT-06) |
| 11   | Toast notifications — coloured backgrounds, stacking, undo (#45) | Open (BT-45) |
| 12   | Units consistency — fl oz not applied everywhere (#49)           | Open (BT-49) |

**Status as of 2026-03-15:** None of these 12 tasks have been implemented yet. The sprint was deprioritized in favour of completing the food system server-side pipeline first. These tasks remain valid and are documented in detail in `docs/v1_sprint_tasks.md`.

---

## 3. Food System — Phases 1–4

### Timeline

The food system rebuild ran from 2026-03-12 to 2026-03-14. It proceeded in 4+1 phases before the server-side pipeline.

### Phase 1 — Registry and Deterministic Canonicalization (2026-03-12)

**Problem:** The legacy system had fine-grained canonicals that prevented trial accumulation (scrambled egg, poached egg, omelette were all separate stations), no single source of truth, and no concept of dietary zones.

**What was built:**

- `shared/foodRegistry.ts` — single source of truth. 100 food entries, each with `canonical`, `zone`, `subzone`, `category`, `subcategory`, `macros`, `examples`, `group`, `line`, `lineOrder`, `notes`.
- `shared/foodCanonicalization.ts` — builds O(1) lookup map from examples → canonical. Returns `string | null`. `null` = pass to LLM.
- `shared/__tests__/foodCanonicalization.test.ts` — 30 tests.
- Collapsed canonicals: same digestive profile = same canonical. "scrambled eggs", "poached eggs", "omelette" all → `"egg"`. "boiled chicken" → `"boiled white meat"`.

**ADR:** `docs/adrs/0002-food-registry-and-canonicalization.md`

### Phase 2 — LLM Canonicalization and Legacy Cleanup (2026-03-12)

**What was built:**

- `src/lib/foodLlmCanonicalization.ts` — builds LLM prompt from registry vocabulary. `postProcessCanonical` resolves LLM output against registry deterministically.
- Registry updated with `line` (TransitLine) and `lineOrder` fields.
- `foodCategoryMapping.ts` created (then deleted in Phase 2.5).
- `foodParsing.ts` and `foodStatusThresholds.ts` updated.

### Phase 2.5 — Hierarchy Revision (2026-03-12)

**Problem:** The flat 7-value `TransitLine` type mixed macronutrient groups with subcategories. The user required a hierarchical Group → Line → Station model for the transit map.

**Hierarchy confirmed and signed off:**

```
PROTEIN  (3 lines): Meat & Fish, Eggs & Dairy, Vegetable Protein
CARBS    (3 lines): Grains, Vegetables, Fruit
FATS     (3 lines): Oils, Dairy Fats, Nuts & Seeds
SEASONING (2 lines): Sauces & Condiments, Herbs & Spices
```

4 groups, 11 sub-lines. Liquids tracked in app but NOT on transit map.

**Key classification decisions:**

- Garlic → Herbs & Spices (Seasoning). "Garlic is a herb."
- Onion → Vegetables (Carbs). "Onions are a vegetable."
- Milk and kefir → Eggs & Dairy (Protein). NOT liquids.
- Avocado → Nuts & Seeds (Fats).
- Dairy split: proteins (yogurt, cottage cheese, milk, kefir) → Protein; fats (butter, cream, cheese) → Fats.

**What was deleted:** 7 legacy files including `transitMapLayout.ts`, `pointsEngine.ts`, `StationDetailPanel.tsx`, `TransitMap.tsx` (old version), `TransitMapTest.tsx`, `foodCategoryMapping.ts`.

**Net result:** -1867 lines. 95 registry entries across 4 groups / 11 sub-lines. All consumers updated.

### Phase 3 — Evidence Pipeline Canonicalization (2026-03-12)

**Problem:** `buildFoodTrials` in `foodEvidence.ts` was using legacy `normalizeFoodName` instead of `canonicalizeKnownFoodName`. All Phase 1–2.5 work was bypassed at this boundary.

**What was fixed:**

1. `buildFoodTrials` and `normalizeAssessmentRecord` now use `canonicalizeKnownFoodName()` with `normalizeFoodName()` fallback.
2. `analysis.ts` BRAT baseline: `"plain white toast"` → `"toast"`.
3. `primaryStatusFromSignals` split: `posteriorSafety < 0.35 AND severeLowConfounderCount >= 2` → `"avoid"`. `posteriorSafety < 0.35 AND effectiveEvidence >= 3.0` → `"watch"`.
4. Dead correlation code deleted from `analysis.ts` (~480 lines total across two passes).

### Phase 4 — Convex Layer Migration (2026-03-13)

**Problem:** Three issues: (A) cross-boundary imports from `src/lib/` into Convex server files, (B) inconsistent normalization (3 different functions in the Convex layer), (C) game layer with wrong taxonomy and orphaned backend.

**Decision: Delete game layer entirely.** The game layer was built on the old 6-line/10-stage taxonomy with wrong canonical names. Phase 5 will rebuild from scratch.

**What was deleted:**

- 6 Convex game layer modules: `stationDefinitions.ts`, `ingredientTemplates.ts`, `trialSessions.ts`, `gameState.ts`, `data/ingredientTemplatesSeed.ts`, `trialSessions.test.ts`
- 4 game layer schema tables
- 16 game layer hooks
- `trialEngine.ts`, `TrialResultToast.tsx`, `MindTheGapBar.tsx`

**`shared/` directory created:**

- Confirmed Convex can import from `../shared/`.
- Moved `foodRegistry.ts`, `foodCanonicalization.ts`, `foodNormalize.ts`, `foodEvidence.ts` to `shared/`.
- Created `shared/foodTypes.ts`. Added `@shared/*` path alias.

**Normalization unified:**

- `convex/foodLibrary.ts`, `ingredientOverrides.ts`, `ingredientExposures.ts`, `ingredientProfiles.ts`, `extractInsightData.ts` — all now use `canonicalizeKnownFoodName` + `normalizeFoodName` fallback.

**Net result:** 24 files deleted, -3949 lines. Typecheck clean. All food modules use registry canonicalization.

**Tables kept:** `ingredientOverrides`, `ingredientExposures`, `ingredientProfiles`. Raw logs never touched.

### Phases A–E — Root-Cause Audit and Hardening (2026-03-13)

After Phases 1–4, a root-cause review identified 5 missing architectural pieces causing most remaining bugs. These were addressed systematically:

**Phase A — Ingestion boundary + parser contract:**

- `useFoodParsing.ts` now parses first, then writes once (no raw row then patch).
- `isValidFoodParseResult()` rejects semantically empty LLM payloads.
- Composite quantity inheritance bug fixed at write boundary.
- `ingredientExposures` now gates on canonicalized food rows only.

**Phase B — Transit resolver / evidence policy:**

- `CLINICAL_TRANSIT_RESOLVER_POLICY` now named in `shared/foodEvidence.ts`.
- 6-hour minimum transit floor enforced regardless of learned calibration.
- Carry-forward behavior for long-gap / constipation trials (with explicit reliability penalty).
- Trial-centric resolver replaces event-centric backwards sweep.

**Phase C — Derived projection cleanup:**

- `shared/foodProjection.ts` created as shared projection helper.
- Weekly digest counting now uses canonical food identity.
- `ingredientProfiles` no longer invents taxonomy outside the registry — now stores registry-derived `foodGroup`/`foodLine`.

**Phase D — Registry and domain hardening:**

- `FoodRegistryEntry` is now a discriminated union — invalid `group → line` combinations fail to typecheck.
- Load-time assertions for unique canonicals, valid pairings, lineOrder uniqueness, non-empty examples.
- New registry canonicals: `gelatin dessert`, `custard`, `rice pudding`, `gravy`, `honey`, `jam`, `tofu`, `noodles`.
- Clinically misleading aliases removed or split: `nut butter` → `smooth nut butter`; `miso soup` promoted to own canonical; `stir fry` separated from `curry dish`.

**Phase E — Data-driven transit map foundation:**

- `src/types/transitMap.ts` — `TransitStation`, `TransitLine`, `TransitCorridor`, `TransitNetwork` type hierarchy. Helper functions: `stationSignalFromStatus`, `tendencyLabel`, `confidenceLabel`, `serviceRecord`.
- `src/hooks/useTransitMapData.ts` — fuses registry + evidence into map-ready model. Pure computation in `useMemo`. No new Convex tables.
- 16 tests covering network structure, evidence integration, next stop logic, helper functions.

**Adversarial audit (2026-03-13):**

- 5 parallel agents. 55 findings total.
- All critical (6), high (6), and medium (20) findings closed.
- 15 low-priority cleanup items remain. Full report: `docs/audits/Food-Adversarial-Audit-Phase-1-to-4.md`.

---

## 4. Server-Side Food Pipeline

**Status as of 2026-03-14/15: Tasks 1–11 ALL COMPLETE. 352 tests passing.**

### Why it was needed

The client-side parsing pipeline had a fundamental flaw: it transformed user input before storing it. The full sentence the user typed was lost forever after parsing. Only comma-split segments survived. This created transient invalid states where partial rows were in the database before canonicalization completed.

### Architecture

```
Stage 1: Save (instant)
  → rawInput stored immutably by system (user can edit, system cannot)
  → user sees entry on Track page immediately

Stage 2: Deterministic parsing (server-side, convex/foodParsing.ts::processLog)
  → commas present: split + registry lookup
  → matched items: canonicalName + resolvedBy: "registry"
  → unmatched: passed to LLM

Stage 3: LLM matching (convex/foodLlmMatching.ts::matchUnresolvedItems)
  → model: gpt-4o-mini-search-preview (binary: match or NOT_ON_LIST)
  → web search for brand names / regional foods
  → results written back via applyLlmResults mutation
  → still unmatched: flagged for user

Stage 4: User resolution (0–6 hour window)
  → amber indicators on Track page
  → FoodMatchingModal: searchable registry dropdown, grouped by food group
  → raw text editing modal (re-triggers full pipeline)

Stage 5: Evidence processing (at 6 hours, convex/foodParsing.ts::processEvidence)
  → still-unresolved items → canonicalName: "unknown_food", resolvedBy: "expired"
  → resolved items → ingredientExposures created
  → evidence engine receives COMPLETE meals only, never partial

Stage 6: User can edit any time (including old logs)
  → triggers reprocessing + evidence recalculation
```

### Field semantics

| Field           | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `rawInput`      | User's exact text, immutable by system, user-editable      |
| `userSegment`   | One comma-split piece ("two toast")                        |
| `parsedName`    | Food name after quantity stripping ("toast")               |
| `canonicalName` | Registry digestive category ("toast"), null until resolved |
| `resolvedBy`    | `"registry"` \| `"llm"` \| `"user"` \| `"expired"`         |

### Key design decisions

1. **Registry locked at runtime.** No user, LLM, or code can add entries. Users submit tickets for missing foods. Developers add appropriate digestive categories.
2. **LLM has a binary job.** Match to the registry list or return `NOT_ON_LIST`. No confidence scores, no inventing categories.
3. **No catch-all buckets.** There are no "other_protein_zone1" fallback entries. Unknown foods expire to `unknown_food`.
4. **Partial release is display-only.** The evidence engine waits until 6 hours have elapsed before creating ingredient exposures. The 6-hour window aligns with transit biology.
5. **Sacred means system-immutable, not user-immutable.** The user can always edit their own text.
6. **LLM also segments free-form text.** Comma splitting is the fast path. For text without commas, the LLM's first job is to identify individual food items, then match them.

### Key files

| File                                         | Purpose                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `convex/foodParsing.ts`                      | Core mutations: `processLog`, `processLogInternal`, `processEvidence`, `applyLlmResults`, `resolveItem` |
| `convex/foodLlmMatching.ts`                  | LLM action: `matchUnresolvedItems`, vocabulary builder, response parser                                 |
| `shared/foodParsing.ts`                      | Shared deterministic utilities: `splitRawFoodItems`, `parseLeadingQuantity`, `sanitiseFoodInput`        |
| `src/components/track/FoodMatchingModal.tsx` | Manual matching modal with queue mode                                                                   |
| `src/hooks/useUnresolvedFoodQueue.ts`        | Gathers all unresolved items across today's logs                                                        |
| `src/hooks/useUnresolvedFoodToast.ts`        | Toast notification for unresolved items                                                                 |

### Migration for legacy food logs

Old food logs created before the server-side pipeline have items with valid `canonicalName` but no `resolvedBy` field. `backfillResolvedBy` migration in `convex/logs.ts` patches these with `resolvedBy: "registry"`. This migration has been implemented but must be run manually from the Convex dashboard.

---

## 5. Spec vs Reality — Where Implementations Diverged

### Design decisions made during implementation that changed the original plan

**1. Auto-delete vs. graceful expiration**

- Original spec: "Hour 6: auto-deletes."
- Final implementation: Items expire to `unknown_food` with `resolvedBy: "expired"`. Raw text stays visible forever. No data destroyed.
- Why: Consistent with "raw text is sacred" principle. User can still re-match expired items.

**2. Partial release scope**

- Original spec: "Entire meal is held until fully canonicalized."
- Final implementation: Partial release for DISPLAY only. Evidence engine still waits 6 hours.
- Why: Instant visual feedback (green/amber dots) is important for ADHD users. But evidence correctness requires complete meal composition.

**3. Default portions**

- Original spec: Registry entries get `defaultPortion` field (toast=2sl, rice=150g, etc.).
- Final implementation: Display-only defaults. Quantity stored as `null` in data. UI shows display hints.
- Why: `null` = "volume unknown" keeps data honest in the Bayesian engine.

**4. Registry additions are examples, not new canonicals**

- Original spec: Implied new canonical entries for turkey, baguette, etc.
- Final implementation: These are added as EXAMPLES under existing canonicals.
- Why: Canonicals represent digestive categories, not food names. Baguette = bread (under `"white bread"`). User clarified: "The canonical is the digestive-equivalence class, not the specific food name."

**5. "Avoid" status from deterministic engine**

- Original spec: "Only AI can recommend avoidance."
- Final implementation: Deterministic engine CAN recommend avoid when `posteriorSafety < 0.35 AND severeLowConfounderCount >= 2`.
- Why: `severeLowConfounderCount >= 2` is stronger evidence than AI opinion alone — clean-day evidence where confounders are controlled. The Bayesian engine now incorporates AI assessments into `posteriorSafety` via `aiScore`.

**6. Client-side LLM matching**

- Original architecture (pre-2026-03-14): Client initiated LLM calls with BYOK (bring your own key). ADR-0003 was written for this.
- Final implementation: LLM matching is server-initiated with API key in environment.
- Why: Simplifies the security model. Client-side BYOK created complexity around key management, especially for the new server-side pipeline. The server handles all LLM calls.

**7. The re-matching guard on expired items**

- Original implementation: `resolveItem` threw an error for any item that already had a `canonicalName` set.
- Fixed: Guard now allows re-matching items where `resolvedBy === "expired"` or `canonicalName === "unknown_food"`.
- Why: Expired items should always be re-matchable by the user.

### Where code still diverges from design intent

1. **Transit map is data foundation only.** `useTransitMapData()` and `src/types/transitMap.ts` exist. The UI (3 zoom levels, pan/zoom, Station Inspector) has NOT been built.
2. **Food display names.** Several surfaces still prefer `userSegment` over `parsedName` for display. Five specific fixes documented in `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`.
3. **Old food logs show as "pending".** The `backfillResolvedBy` migration must be run manually to fix legacy items.
4. **Trial sub-rows show food names but not quantities.** One TDD test still failing — quantity/unit not yet threaded from `ingredientExposures` through to `LocalTrialRecord`.

---

## 6. ADR References

| ADR                                                    | Decision                                                                                                                                                                                                                               | Status                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `docs/adrs/0001-cloud-only-architecture.md`            | Convex is sole persisted source of truth. IDB stores only OpenAI API key. No offline mode. 33+ files migrated from `useStore()` to `ProfileContext`.                                                                                   | Accepted 2026-03-11. Fully implemented.                                     |
| `docs/adrs/0002-food-registry-and-canonicalization.md` | Single food registry as source of truth. Collapsed canonicals by digestive equivalence. Three-zone model (clinical geography, not gates). Dual-path canonicalization (deterministic + LLM). Hierarchical group/line model (Phase 2.5). | Accepted 2026-03-12. Phases 1–5 complete. Phase 5 (transit map UI) planned. |

### Key decisions recorded in ADR-0002

- Zones are suggested introduction order, not permission gates. The app records, correlates, and celebrates. It never blocks.
- Canonicals represent digestive categories, not food names.
- Duplicate normalized aliases throw at load/test time — registry must be injective after normalization.
- Liquids (water, broth, juice, herbal tea) are tracked in app but NOT mapped as stations on the transit map.

---

## 7. Browser Testing Session — Bugs Found and Fixed

**Session date:** 2026-03-14 (first major browser testing of the server-side food pipeline)

**10 bugs found. 9 fixed. 1 identified but deferred.**

### Bugs Found and Fixed

| #   | Bug                                              | Root Cause                                                                                       | Fix                                                                                                                                                     | Commit             |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Expired items can't be re-matched                | `resolveItem` guard rejects any item with `canonicalName !== undefined`, including expired items | Changed guard to allow `resolvedBy === "expired"`                                                                                                       | `f8aa29f` adjacent |
| 2   | Old food logs show as "pending"                  | Legacy items have valid `canonicalName` but no `resolvedBy` field                                | `backfillResolvedBy` migration mutation in `convex/logs.ts`                                                                                             | `b478b52`          |
| 3   | Display names show quantities ("4 Toast")        | Display functions prefer `userSegment` over `parsedName`                                         | Fixed `getFoodItemDisplayName`, `formatItemDisplay`, `getLogDetail` in `today-log/helpers.ts` and `getLoggedFoodIdentity` in `shared/foodProjection.ts` | `b478b52`          |
| 4   | Patterns table shows quantity-prefixed names     | `getLoggedFoodIdentity` picked `userSegment` for `displayName`                                   | Fixed in same commit as #3 (displaySource priority chain)                                                                                               | `b478b52`          |
| 5   | "Review" toast doesn't open modal                | Toast callback scrolled to a dot instead of opening modal                                        | Added queue mode to `FoodMatchingModal`, new `useUnresolvedFoodQueue` hook, wired toast to open queue                                                   | `a3fb1ac`          |
| 6   | Standalone size abbreviations not parsed         | "sm", "lg", "med" without leading digit not stripped by `parseLeadingQuantity`                   | Added `STANDALONE_SIZE_ABBREV` regex to `shared/foodParsing.ts`                                                                                         | `f8aa29f`          |
| 7   | Food names include quantity text in today log    | `name` field stored raw text with units                                                          | `buildDeterministicItem` now sets `name = parsedName` not `trimmedOriginal`                                                                             | Earlier session    |
| 8   | `normalizeFoodName` can't strip standalone units | `QUANTITY_PREFIX` regex required leading digit                                                   | Added `STANDALONE_UNIT_PREFIX` regex                                                                                                                    | Earlier session    |
| 9   | Hyphens not normalized                           | "lactose-free" survived normalization                                                            | Hyphen → space normalization added                                                                                                                      | Earlier session    |

### Bug #10 — Identified, Not Fixed

**Food request stub** — The `FoodMatchingModal` has a "Submit food request" path that currently writes a console log only. No actual ticket/request mechanism exists. The user identified this as important UX (if a food can't be matched, they should be able to flag it for developers). This is tracked in the backlog as a deferred feature.

---

## 8. E2E Test Suite

### Status (2026-03-15)

- **75 passing, 1 expected TDD failure, 6 skipped** (2 `test.fixme` for timing races, 4 `test.skip` for missing habit templates)
- 82 total tests across 11 spec files

### Test files

| File                               | Tests | Status                                             |
| ---------------------------------- | ----- | -------------------------------------------------- |
| `e2e/food-pipeline.spec.ts`        | 36    | 35 passing, 1 TDD fail (quantity in trial sub-row) |
| `e2e/patterns-food-trials.spec.ts` | 17    | All passing                                        |
| Other e2e specs                    | ~29   | Mostly passing                                     |

### Key fixes made to get tests passing

- `button:text-matches('^Food')` selector fails on nested text → changed to `button:has-text("Food intake")`
- Data contamination — unique food names per test (zyphlox, worblex, grelpnik, frobnicator)
- `.last()` vs `.first()` for newest entry (DOM renders newest first)
- `waitForDots` scoped to specific entry, not page-global
- Weight/Sleep: Enter-to-save pattern (no Save button)
- "biscoff" is in registry (maps to "biscuit") — tests must use truly unknown words

### TDD feature implemented (partially)

The TDD test for food names in trial sub-rows drove implementation of:

- `foodName?`, `quantity?`, `unit?` fields on `LocalTrialRecord`
- `TrialHistorySubRow` renders `data-slot="trial-food-name"` and `data-slot="trial-quantity"`

One test still failing: quantity is not yet threaded from `ingredientExposures` through `FoodEvidenceTrial` → `LocalTrialRecord` → UI.

### No CI

No CI pipeline exists. Tests run manually with `bun run test` and `npx playwright test`. Setting up CI is a pre-merge blocker.

---

## 9. What Remains

Items are ordered by priority.

### Immediate (before next major feature)

**1. Food pipeline UI fixes (5 bugs)**
Plan exists: `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`

| Task   | Description                                                                           |
| ------ | ------------------------------------------------------------------------------------- |
| Task 1 | Fix `resolveItem` to allow re-matching expired items — **DONE**                       |
| Task 2 | `backfillResolvedBy` migration for legacy food logs — **implemented but must be run** |
| Task 3 | Fix display names to use `parsedName` instead of `userSegment` — **DONE**             |
| Task 4 | Verify Patterns table uses canonical name — **DONE (follows from Task 3)**            |
| Task 5 | Queue-based `FoodMatchingModal` — **DONE**                                            |
| Task 6 | Wire "Review" toast to queue modal — **DONE**                                         |

**2. Registry gap audit**
Common standalone words not in registry as examples: `chicken` (standalone), `pasta`, `bread`, `fish`, `beef`, etc. A systematic audit would improve deterministic resolution rates and reduce LLM calls. Items to check are documented in the E2E session notes.

**3. Pill/tag input for food entry (UX)**
Users enter ingredient lists without commas. The entire string becomes one food item. Solution: pill/tag input where typing `food, ` converts the segment to a visual pill. Each pill deletable. Comma or pause = pill boundary. This is the most critical UX improvement identified in browser testing.

**4. Quantity threading in trial pipeline**
`quantity`/`unit` from `ingredientExposures` is not yet threaded through `FoodEvidenceTrial` → `LocalTrialRecord` → `TrialHistorySubRow`. One TDD test is still failing because of this.

**5. CI pipeline setup**
No CI exists. This is a pre-merge blocker for `feature/v1-sprint` → `master`.

**6. #80 OpenAI prompt management (SHIP BLOCKER)**
Requires OpenAI dashboard setup, not just code. The API key architecture and prompt versioning strategy (`docs/prompts/v3-strategy.md`) need to be finalized.

**7. Food request persistence**
The `FoodMatchingModal` "Submit food request" path currently does nothing. Needs either: a Convex mutation to store requests, or a feedback mechanism to notify developers.

### V1 Sprint Tasks (deferred from original plan)

All 12 tasks in `docs/v1_sprint_tasks.md` are still open — data integrity fixes (Phase 1), Track page fixes (Phase 2), broken features (Phase 3). These should be addressed before public release.

**Most critical from that list:**

- BT-91: AI text stored as food (data corruption)
- BT-92: Bristol classification wrong (data correctness)
- BT-87: Building evidence threshold (foods stuck in "building")

### Remaining Technical Debt

**High priority:**

- `TD-01`: `buildFoodEvidenceResult` runs in both client and Convex backend — should be server-only.
- `PERF-001`: `analyzeLogs` called independently in Patterns and Menu — lift to shared context.

**Medium priority (7 open items):**

- `TD-05`: O(n²) weekly digest
- `TD-07`: Bayesian run-once optimization
- `TD-08`: Zone type duplication (`Zone` in `foodStatusThresholds.ts` duplicates `FoodZone` from registry)
- `TD-09`: Stale comments referencing deleted files
- `TD-10`: `existingNames` in food parsing may cause LLM to prefer library names over registry canonicals
- `TD-11`: Transit map feature flag orphaned (`transitMapV2: true` remains)
- `TD-12`: `aiAnalysis.ts` is large and could benefit from decomposition

---

## 10. Phase 5 — Transit Map UI + Game Layer Rebuild

**Status:** Data foundation complete. UI not yet built.

### What exists

- `src/types/transitMap.ts` — complete type hierarchy (`TransitStation`, `TransitLine`, `TransitCorridor`, `TransitNetwork`) + helper functions
- `src/hooks/useTransitMapData.ts` — `useTransitMapData(foodStats)` returns a fully populated `TransitNetwork` from registry + evidence
- 16 passing tests for the data hook

### What the UI needs to build on top of

The hook provides:

1. `network.corridors` — iterate for 4 corridor cards (Protein, Carbs, Fats, Seasoning)
2. `corridor.lines` — iterate for line-level views
3. `line.stations` — iterate for individual food stations
4. `line.nextStop` / `corridor.nextStop` — evidence-backed "next station to try"
5. `network.stationsByCanonical` — O(1) deep linking from Dr. Poo / Menu
6. `stationSignalFromStatus(station.primaryStatus)` — green/amber/red/blue/grey
7. `serviceRecord(station)` — "6 transits — 4 on time, 1 delayed, 1 express"
8. `confidenceLabel(station.confidence)` — "Strong signal" / "More transits needed"
9. `tendencyLabel(station.tendency)` — "On time" / "Express" / "Delayed"

### Planned UI (3 zoom levels)

**Zoom out: Corridor cards**
4 cards, each showing: coloured tracks, progress fill (tested/untested), summary stats, next stop.

**Default: Corridor detail**
All lines in a group visible with station dots.

**Zoom in: Line detail**
Single sub-line. Zone-by-zone station layout. Station Inspector panel. Pan/zoom via `react-zoom-pan-pinch`.

### Station Inspector (progressive disclosure)

- Level 1: Station name, signal colour, line & zone, food artwork
- Level 2: Timetable (avg transit), service record, tendency, confidence, AI assessment
- Level 3: Next stop, alternative routes, explore options, change tracks

### Transit-themed vocabulary (confirmed)

| Concept          | UI label     |
| ---------------- | ------------ |
| Tendency: loose  | Express      |
| Tendency: normal | On time      |
| Tendency: hard   | Delayed      |
| Trial count      | "6 transits" |
| Food group       | Corridor     |
| Sub-line         | Line         |
| Zone boundary    | Interchange  |

### Artwork

30 PNGs exist in `src/assets/transit-map/`. 46 of 95 foods have no artwork. All images need re-export with `#1e293b` (Tailwind slate-800) circle background. Source images in `images/` at repo root.

### Deferred to Phase 5+

- Registry CRUD (create, edit, delete custom entries)
- Manual food matching UI for unmatched foods
- Deep linking from Dr. Poo → transit map station
- Deep linking from Menu → transit map station
- `analyzeLogs` shared context lift (PERF-001/004)
- `buildFoodEvidenceResult` consolidation (server-only)
- Reward/milestone system (celebrations)
- `ingredientOverrides` UI wiring

---

## 11. Architecture Summary

Current state as of 2026-03-15.

### Data ownership

| Data type                          | Canonical source | Notes                                                 |
| ---------------------------------- | ---------------- | ----------------------------------------------------- |
| All logs (food, fluid, BM, weight) | Convex only      | Direct mutations, no local copy                       |
| Profile settings                   | Convex only      | Via `ProfileContext` reactive query                   |
| AI reports                         | Convex only      | Client invokes Convex actions                         |
| Food trial summaries               | Convex only      | Server-derived                                        |
| OpenAI API key                     | IDB only         | Device-local via `idb-keyval`, never stored in Convex |

### What Zustand owns

Ephemeral UI state only. No persist middleware. `habitLogs` (rebuilt from Convex), `aiAnalysisStatus`, `paneSummaryCache`.

### Food system data flow

```
User input (raw text)
  → useFoodParsing.ts: saves rawInput to Convex, no parsing
  → convex/logs.ts: schedules processLogInternal
  → convex/foodParsing.ts::processLog: deterministic parsing
      → registry hit: canonicalName + resolvedBy: "registry"
      → registry miss: schedules matchUnresolvedItems
  → convex/foodLlmMatching.ts::matchUnresolvedItems: LLM + web search
      → match: canonicalName + resolvedBy: "llm"
      → NO_MATCH: item stays unresolved (user-facing amber indicator)
  → FoodMatchingModal (user): resolvedBy: "user"
  → convex/foodParsing.ts::processEvidence (at 6h):
      → unresolved → expired to unknown_food
      → resolved → ingredientExposures created
  → shared/foodEvidence.ts: Bayesian evidence engine
  → Patterns/Menu: foodStats + transit map data
```

### Shared directory

`shared/` contains code used by both `src/` (client) and `convex/` (server):

- `shared/foodRegistry.ts` — 95-entry canonical source of truth
- `shared/foodCanonicalization.ts` — deterministic lookup, alias injectivity enforced
- `shared/foodNormalize.ts` — text normalization
- `shared/foodEvidence.ts` — Bayesian evidence engine + transit resolver
- `shared/foodProjection.ts` — canonical projection for read model
- `shared/foodParsing.ts` — deterministic parsing utilities
- `shared/foodTypes.ts` — shared type definitions

### Remaining architectural risk

1. `buildFoodEvidenceResult` runs in both client and Convex backend (TD-01). Outputs can diverge.
2. `analyzeLogs` runs independently in Patterns and Menu (PERF-001). Performance issue and potential data drift.
3. Missing provenance metadata on AI-derived data. No explicit confidence/provenance on cached insights.

---

## Development Session Log (Condensed)

The original session-by-session log has been preserved above but condensed into the architectural sections. Key dates:

| Date       | Milestone                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-03-11 | ADR-0001 accepted. Cloud-only migration complete.                                                                                                      |
| 2026-03-12 | Food system Phases 1–2.5 complete. Registry, hierarchy, legacy deleted.                                                                                |
| 2026-03-12 | Phase 3 (evidence pipeline) complete.                                                                                                                  |
| 2026-03-12 | Full code review: 50/55 findings fixed, -688 lines.                                                                                                    |
| 2026-03-13 | Phase 4 (Convex migration, game layer deleted).                                                                                                        |
| 2026-03-13 | Phases A–E (ingestion contract, transit resolver, projection cleanup, domain hardening, transit map data hook).                                        |
| 2026-03-13 | Adversarial audit: all C/H/M findings closed.                                                                                                          |
| 2026-03-14 | Food pipeline data quality audit. Root causes traced.                                                                                                  |
| 2026-03-14 | Server-side food pipeline design — adversarial review, 5 contradictions resolved.                                                                      |
| 2026-03-14 | Server-side food pipeline implementation: Tasks 1–11 complete. 352 tests passing.                                                                      |
| 2026-03-15 | E2E test suite: 29 failures fixed → 75 passing. TDD feature (food names in trial sub-rows) partially implemented. Browser testing: 9 of 10 bugs fixed. |
