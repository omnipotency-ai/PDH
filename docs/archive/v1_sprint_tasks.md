# V1 Sprint Tasks

**Last updated:** 2026-03-15
**Branch:** `feature/v1-sprint`

---

## Status Summary

| Area                            | Status                                           |
| ------------------------------- | ------------------------------------------------ |
| Food system Phases 1–4          | DONE                                             |
| Server-side food pipeline       | DONE (11/11 tasks)                               |
| Food pipeline UI bugs           | 9/10 fixed; Bug #10 (registry request stub) open |
| Cloud-only migration (ADR-0001) | DONE                                             |
| Code review (55 findings)       | 50/55 fixed; 5 deferred                          |
| Unit tests                      | 525 passing, 1 failing (prompt text mismatch)    |
| Browser testing Pass 1          | Done (63 bugs found, 61 fixed)                   |
| Browser testing Pass 2          | Partial (Track + Patterns pages done)            |
| E2E Playwright tests            | Written; not yet passing against live dev server |
| Next blocker                    | Bug #10, OpenAI prompt management (#80)          |

---

## Completed Work

### Food System Rebuild — Phases 1–4 (DONE)

All four phases complete as of 2026-03-13.

- **Phase 1:** Registry created, canonicalization replaced, 25 tests passing, ADR-0002 written.
- **Phase 2:** LLM canonicalization, `lineOrder`, legacy cleanup. 25/25 tests, typecheck clean.
- **Phase 2.5:** Hierarchy revision — flat `TransitLine` → `FoodGroup` + `FoodLine` (95 entries, 4 groups, 11 lines).
- **Phase 3:** Evidence pipeline — registry canonicalization in `foodEvidence.ts`, avoid/watch split, ~630 lines dead code deleted from `analysis.ts`. 33/33 tests pass.
- **Phase 4:** Game layer deleted, `shared/` created, Convex normalization unified. 33/33 tests pass.

Key files: `shared/foodRegistry.ts`, `shared/foodCanonicalization.ts`, `shared/foodEvidence.ts`, `shared/foodTypes.ts`

---

### Server-Side Food Pipeline — Tasks 1–11 (DONE)

All 11 tasks complete as of 2026-03-14. Documented in `docs/archive/plans/2026-03-14-food-pipeline-test-plan.md`.

Pipeline flow: `logs.add (rawInput)` → `processLogImpl` (deterministic canonicalization) → `matchUnresolvedItems` (LLM, client-initiated BYOK) → `processEvidence` (6h window, creates `ingredientExposures`).

| Task | Description                                         | Status |
| ---- | --------------------------------------------------- | ------ |
| 1    | Raw-input-only log creation                         | DONE   |
| 2    | Deterministic registry canonicalization             | DONE   |
| 3    | Quantity extraction (`parseLeadingQuantity`)        | DONE   |
| 4    | Schedule LLM for unresolved segments                | DONE   |
| 5    | LLM matching (client-initiated, BYOK)               | DONE   |
| 6    | LLM fallback chain for hallucinated canonicals      | DONE   |
| 7    | 6-hour evidence processing window                   | DONE   |
| 8    | Expire unresolved items to `unknown_food`           | DONE   |
| 9    | Idempotency guard on `processEvidence`              | DONE   |
| 10   | Edit path clears exposures and re-triggers pipeline | DONE   |
| 11   | `backfillResolvedBy` migration for legacy items     | DONE   |

---

### Food Pipeline UI Bugs (DONE: 9/10)

Documented in `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`.

| #   | Bug                                                     | Status               |
| --- | ------------------------------------------------------- | -------------------- |
| 1   | Inline edit draft uses `userSegment` for name           | FIXED                |
| 2   | Log display shows bare name without quantity            | FIXED (2026-03-15)   |
| 3   | Food delete has no confirmation                         | FIXED                |
| 4   | Inline edit save corrupts `parsedName`                  | FIXED                |
| 5   | Inline edit save destroys `rawInput`/`notes`/`mealSlot` | FIXED                |
| 6   | Food item shape inconsistent                            | FIXED                |
| 7   | Canonical tooltip — hover-only, not persistent          | FIXED (2026-03-15)   |
| 8   | LLM code fence stripping fails                          | FIXED                |
| 9   | LLM segment match-back fails                            | FIXED                |
| 10  | Food registry request is a UI stub                      | **OPEN** (see below) |

---

### Cloud-Only Architecture Migration (DONE)

ADR-0001 accepted 2026-03-11. Zustand store reduced from ~1130 → ~277 lines. Convex is sole persisted source of truth. 33+ files migrated from `useStore()` to `ProfileContext`/`useApiKeyContext`. Browser storage retained only for OpenAI API key (idb-keyval).

---

### Code Review — Wave 4 (50/55 DONE)

55 findings total across the food pipeline commits. 50 fixed in commit `fb2a1a2`. 5 deferred:

- 2 bigger architectural items
- 3 info-level / low-priority findings

---

### Browser Testing

**Pass 1 (2026-03-09):** 63 bugs identified, 61 fixed. Pass 1 full history in `docs/archive/browser-testing/2026-03-09-v1-test-run.md`. Current live tracking in `docs/browser-testing/2026-03-09-v1-test-run.md`.

**Pass 2 (2026-03-10):** Partial. Track page (desktop) and Patterns page tested. Settings, AI system, and Menu page not yet tested in Pass 2.

---

### Test Suite — Unit/Integration

36 test files. 525 tests passing. 1 failing.

**Failing test:** `convex/__tests__/foodLlmMatching.test.ts` — `buildMatchingPrompt > includes instructions about JSON response format`. Test asserts `"Respond with JSON only"` but prompt text was updated to `"Respond with ONLY valid JSON, no markdown formatting"`. Test needs updating to match current prompt copy.

---

## Open Tasks

### Bug #10 — Food Registry Request is a UI Stub (OPEN)

**File:** `src/components/track/FoodMatchingModal.tsx`

**Problem:** The "Request it be added" link calls `console.info` and does nothing. No persistence, no user feedback, no backend handling.

**Options:**

1. **Minimal:** New `foodRegistryRequests` table in Convex. Toast confirmation on submit. Admin tooling deferred.
2. **Honest stub:** Replace link with a visible note that manual reporting is not yet available. Prevents false expectations without backend plumbing.

---

### Fix Failing Unit Test (OPEN)

**File:** `convex/__tests__/foodLlmMatching.test.ts`

**Test:** `includes instructions about JSON response format`

**Fix:** Update the assertion from `"Respond with JSON only"` to match the actual prompt wording: `"Respond with ONLY valid JSON, no markdown formatting"`.

---

### #80 — OpenAI Prompt Management (SHIP BLOCKER)

Requires OpenAI dashboard setup. Not a code-only fix. This is a blocker for shipping.

---

### Phase 5 — Transit Map UI Rebuild (PLANNED)

Data-driven transit map rebuild using `lineOrder` and registry hierarchy. Design decisions and scope documented in `docs/scratchpadprompts/transitmap.md` (Phase 5 Planning Session section).

Scope:

1. New data-driven component (3 zoom levels: corridor cards → corridor detail → line detail)
2. `useTransitMapData()` hook
3. "Next stop" logic using `lineOrder`
4. Station Inspector with transit-themed language
5. Pan/zoom via `react-zoom-pan-pinch`
6. Side-by-side toggle with existing map

---

## Remaining Bug Backlog (from browser testing)

These are not yet assigned to sprint tasks. Tracked in `docs/browser-testing/2026-03-09-v1-test-run.md`.

### Critical (data correctness)

| #   | Bug                    | Notes                                                                          |
| --- | ---------------------- | ------------------------------------------------------------------------------ |
| 91  | AI text stored as food | Data corruption — AI report prose in food database. Data cleanup required.     |
| 92  | Bristol classification | `classifyConsistency()` still uses average threshold, not majority-rules (30%) |

### High severity

| #   | Bug                         | Notes                                                                 |
| --- | --------------------------- | --------------------------------------------------------------------- |
| 20  | Food safety grid wrong      | Depends on Bayesian engine + AI verdicts; needs runtime verification  |
| 27  | DB still 199 foods          | Normalization code exists; data may not have been re-processed        |
| 28  | DB status logic             | Thresholds defined; classification pipeline needs runtime check       |
| 31  | DB trend lines missing      | Needs runtime verification                                            |
| 86  | Food trial count merging    | Depends on normalization pipeline + live data                         |
| 87  | Building evidence threshold | MIN_RESOLVED_TRIALS=2 is very low; foods with 21+ trials may be stuck |

### Medium severity

| #   | Bug                         | Notes                                                      |
| --- | --------------------------- | ---------------------------------------------------------- |
| 4   | BM time label position      | Time needs to move before notes field                      |
| 6   | Fluid section design        | User wants original simple design (ml + drink + add)       |
| 18  | BM count data wrong         | Needs runtime verification                                 |
| 21  | Next food logic             | Depends on food safety grid pipeline                       |
| 45  | Toast notifications         | No coloured backgrounds, no stacking, no prominent undo    |
| 49  | Units not applied to fluids | Other surfaces still hardcode ml                           |
| 64  | Food section redesign       | Remove "Food Badges" title, simplify layout                |
| 65  | Weight target save bug      | "180" doesn't save; requires "180.0" or explicit Enter/Tab |
| 67  | TimeInput Enter-to-save     | Enter blurs but may not trigger save in all contexts       |
| 73  | Insights bar removal        | Remove heuristics insight below quick capture              |
| 74  | Desktop long-press          | Add 3-dot menu for desktop discoverability                 |
| 75  | BM layout rework            | Time before notes, 8-col grid                              |
| 76  | Conversation markdown       | All text bold/large — no visual hierarchy                  |
| 77  | Conversation card redesign  | Single chat-window with separate cards for summary/meals   |
| 78  | Meal card blog-style        | Time/slot where image would be                             |
| 79  | Next Food to Try + zones    | Show Dr. Poo suggestions AND zone-1 options                |
| 82  | Today log text overflow     | Text too long, pushes controls off screen                  |
| 83  | Date header duplication     | Patterns repeats date in page + global header              |
| 85  | Safe foods confidence       | "moderate"/"strong"/"weak" labels undefined                |

### Low severity / Polish

| #   | Bug                           | Notes                                           |
| --- | ----------------------------- | ----------------------------------------------- |
| 62  | Destructive alert size        | h-6 w-6 should be h-5 w-5                       |
| 66  | BM pill text alignment        | Left-aligned in some pills                      |
| 68  | Quick capture medium viewport | 3-col breaks at medium; needs 2-col             |
| 69  | Activity detail orange        | Input highlighted with system default orange    |
| 70  | Celebration too weak          | Sound too short, confetti too minimal           |
| 71  | Boolean habit duplicate name  | "Brush Teeth / Brush Teeth" repeats             |
| 72  | Alert badge position          | Should be top-right corner with hover X         |
| 81  | Fluid habit auto-styling      | Auto-set blue glass icon for fluid habits       |
| 84  | Hero label overlap            | Side labels overlap numbers                     |
| 88  | Habit-digestion value         | Most correlations inconclusive                  |
| 89  | Dr Poo archive link dup       | Duplicate link on Patterns page                 |
| 90  | "Last tested" ambiguity       | "1h ago" — last eaten or last transit?          |
| 96  | Destructive progress gradient | Green to yellow to red as cap consumed (FUTURE) |

### Deferred (design tasks)

| #   | Bug               | Notes                         |
| --- | ----------------- | ----------------------------- |
| 1   | Menu nav          | No UI path to Menu page       |
| 60  | Track page layout | Full layout redesign deferred |

### Irrelevant (features deleted)

| #   | Bug                       | Notes                                                    |
| --- | ------------------------- | -------------------------------------------------------- |
| 19  | Transit score labels      | Transit score tile removed from HeroStrip entirely       |
| 34  | Transit map wrong version | All TransitMap components deleted; feature flag orphaned |
| 93  | Transit map wrong version | Same as #34                                              |

---

## Pages Not Yet Tested in Pass 2

- **Settings page:** #46, #47, #51, #52, #53, #54, #55
- **AI system:** #35, #36, #37, #38, #42, #43, #61
- **Menu page:** #22, #23, #24

---

## E2E Playwright Tests

Written but not yet passing against live dev server. Files in `e2e/`:

- `food-pipeline.spec.ts` — 36 tests covering full pipeline UI flow
- `patterns-food-trials.spec.ts` — 17 tests for Patterns food trial display

Status: Selectors and timing need validation against live dev server. Playwright config and fixtures in place.

---

## Architectural Debt (Tracked, Not Blocking)

- **TransitMap feature flag orphaned.** `transitMapV2: true` remains in code after TransitMap deletion.
- **Bristol classification still uses averages.** `classifyConsistency()` in `foodStatusThresholds.ts` uses avg >= 5.5 = loose. Pass 2 decision was majority-rules with 30% threshold — not yet implemented (#92).
- **Toast styling minimal.** No coloured backgrounds, no stacking config, no prominent undo (#45).
- **Fluid units partially wired.** `FluidSection.tsx` converts correctly; other surfaces may still hardcode ml (#49).
- **`O(n²)` weekly digest query.** Deferred from Wave 4 review — not a blocker at current data scale.
- **Unvalidated backup imports.** Deferred from Wave 4 review.
