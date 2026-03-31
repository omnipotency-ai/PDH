# Phase 3: Evidence Pipeline Canonicalization

## Status

COMPLETE (2026-03-12). All 4 fixes implemented.

## Goal

Wire the food registry's canonical names into the Bayesian evidence pipeline so
that food trials are grouped correctly. Fix the `"avoid"` status logic. Delete
dead correlation code.

This completes the canonicalization chain: user input → LLM → registry →
**evidence pipeline** → UI. After Phase 3, the entire data path from food
logging to pattern display uses registry-based canonicals.

## Problem Statement

### 1. Canonicalization gap in buildFoodTrials

`foodEvidence.ts:buildFoodTrials()` (line 186) normalises food names using the
legacy `normalizeFoodName()` from `foodNormalize.ts`. This function does basic
string cleanup (lowercase, trim, singularise) but does NOT resolve to registry
canonicals.

**Example:** A user logs "scrambled eggs". The parsing pipeline (Phase 2)
correctly canonicalises this to `"egg"` in the log's `canonicalName` field. But
when `buildFoodTrials` reads that log back, it runs
`normalizeFoodName("egg")` → `"egg"` (happens to work). However, if older logs
have `canonicalName: "scrambled eggs"`, `normalizeFoodName` returns
`"scrambled egg"` (singularised) — NOT the registry canonical `"egg"`.

Result: trials for the same food split across two keys. The whole benefit of
Phases 1-2.5 collapsed canonicals is lost at this boundary.

`analysis.ts:buildFoodTrials()` (line 361) has the same problem — identical
code, same legacy normaliser.

### 2. BRAT baseline mismatch

`analysis.ts` line 170: `{ key: "plain white toast", name: "Plain White Toast" }`.
The registry canonical is `"toast"`. This baseline food will never match any
food logged through the registry-aware parsing pipeline.

### 3. "avoid" status unreachable

`foodEvidence.ts:primaryStatusFromSignals()` has a branch (line 477-483) whose
comment says it handles the "avoid" case, but the return value is `"watch"`.
The `FoodPrimaryStatus` type includes `"avoid"`, and `toLegacyFoodStatus` maps
it to `"risky"`, but the code path to produce it doesn't exist.

### 4. Dead correlation code in analysis.ts

The Patterns page reorganisation deleted the `DigestiveCorrelationGrid`
component. The `.correlations` field from `analyzeLogs` is computed but never
consumed — confirmed by grep: no file reads `.correlations` from the analysis
result.

Dead functions in `analysis.ts`:

- `buildFoodTrials()` (line 361) — duplicate of `foodEvidence.ts` version
- `resolveAllCorrelations()` (line 443) — correlation resolver
- `buildCorrelations()` — correlation row builder
- `outcomeFromTransitAndCategory()` — outcome classifier
- Related types: `FoodTrial`, `ResolvedTrial`, `CorrelationRow`,
  `DigestiveEvent`, `DigestiveCategory`

## Design

### Fix 1: Replace normalizeFoodName with registry canonicalization in buildFoodTrials

**File:** `src/lib/foodEvidence.ts`

**Current code (line 198-200):**

```typescript
const rawCanonical = readText(candidate?.canonicalName);
const canonicalName = rawCanonical
  ? normalizeFoodName(rawCanonical)
  : normalizeFoodName(name);
```

**New code:**

```typescript
import { canonicalizeKnownFoodName } from "./foodCanonicalization";

const rawCanonical = readText(candidate?.canonicalName);
const canonicalName = rawCanonical
  ? (canonicalizeKnownFoodName(rawCanonical) ?? normalizeFoodName(rawCanonical))
  : (canonicalizeKnownFoodName(name) ?? normalizeFoodName(name));
```

**Logic:** Try registry first. If the food isn't in the registry (unknown/new
food), fall back to legacy normalisation so it still groups by basic string
similarity. This handles both:

- Known foods: "scrambled eggs" → registry lookup → `"egg"` ✓
- Unknown foods: "my grandma's special soup" → not in registry → legacy
  normalise → `"my grandma's special soup"` (grouped by string) ✓

The same fix applies to `normalizeAssessmentRecord` (line ~520) which also uses
`normalizeFoodName` for the canonical field.

**Import change:** Add `canonicalizeKnownFoodName` import. Keep
`normalizeFoodName` as fallback for unknowns.

### Fix 2: Fix BRAT baselines

**File:** `src/lib/analysis.ts`

Change:

```typescript
{ key: "plain white toast", name: "Plain White Toast" },
```

To:

```typescript
{ key: "toast", name: "Toast" },
```

### Fix 3: Fix "avoid" status logic

**File:** `src/lib/foodEvidence.ts`, function `primaryStatusFromSignals`

**Current (broken):**

```typescript
if (
  args.posteriorSafety < 0.35 &&
  (args.effectiveEvidence >= BUILDING_EVIDENCE_THRESHOLD * 2 ||
    args.severeLowConfounderCount >= 2)
) {
  return "watch";
}
```

**New (split into two paths):**

```typescript
// "avoid" requires severe bad outcomes on CLEAN days (low confounders).
// This is the strongest negative signal — the data speaks for itself
// regardless of AI assessment. Two or more severe outcomes on days with
// high modifier reliability (≥ 0.7) means the food itself is the problem.
if (args.posteriorSafety < 0.35 && args.severeLowConfounderCount >= 2) {
  return "avoid";
}

// "watch" when evidence is strong but confounders muddy the picture.
// High effectiveEvidence alone doesn't prove the food is the cause —
// smoking, sweets, stress, or other factors may be responsible.
if (
  args.posteriorSafety < 0.35 &&
  args.effectiveEvidence >= BUILDING_EVIDENCE_THRESHOLD * 2
) {
  return "watch";
}
```

**Statistical rationale:**

The core problem is confounding. A user eating toast 27 times with 22 good
outcomes and 5 bad outcomes might see those 5 bad days correlated with other
factors (smoking, sweets, irritated bowel). The engine handles this through
`modifierReliability` — a per-trial score (0-1) measuring how "clean" the day
was. High confounders reduce trial weight.

`severeLowConfounderCount` is the count of trials where:

- `outcome.severe === true` (Bristol 1-2 or 6-7)
- `modifierReliability >= 0.7` (day was mostly clean)

When a food has 2+ severe bad outcomes on clean days, the confounders have been
controlled for. The food itself is the most likely cause. This is analogous to
a stratified analysis in epidemiology: we're only looking at the "clean day"
stratum where confounders are minimal.

The `effectiveEvidence ≥ 3.0` path alone caps at "watch" because:

- High evidence can accumulate from many modestly-weighted dirty-day trials
- The evidence total doesn't distinguish confounder-free from confounder-heavy
- Saying "avoid" based on volume alone would blame foods unfairly

**Alignment with design principles:**

- "Only AI can recommend avoid" was established when the deterministic engine
  was broken and unreliable. The Bayesian engine now incorporates AI assessments
  into `posteriorSafety` (via `aiScore`), so the AI's voice IS represented.
- The `severeLowConfounderCount ≥ 2` threshold requires real evidence from
  clean days — this is stronger than AI opinion alone.
- The split preserves caution: ambiguous evidence (high total, dirty days)
  only reaches "watch".

### Fix 4: Delete dead correlation code from analysis.ts

**File:** `src/lib/analysis.ts`

Delete:

- `buildFoodTrials()` function
- `resolveAllCorrelations()` function
- `buildCorrelations()` function
- `outcomeFromTransitAndCategory()` function
- `FoodTrial` interface
- `ResolvedTrial` interface
- `CorrelationRow` type
- `DigestiveEvent` / `DigestiveCategory` types (if only used by the above)
- `correlations` field from the `analyzeLogs` return type and its computation
- Constants only used by the above: `WINDOW_START_MINUTES`, `NORMAL_END_HOURS`,
  `SLOW_END_HOURS`, `VERY_SLOW_END_HOURS`

Keep:

- Everything else in `analysis.ts` — the FoodStat computation, factor analysis,
  text summaries, Bristol averages, etc.
- `buildDigestiveEvents` if it's used by remaining code (check first)
- `normalizeFoodName` / `formatFoodDisplayName` imports if still used by
  remaining code

**Also update the `analyzeLogs` return type** to remove `correlations`.
Since no consumer reads `.correlations`, this is a safe deletion.

## Phase boundary with Phase 4

Phase 3 does NOT change:

- Where `buildFoodEvidenceResult` runs (still 2 client + 2 server locations)
- The cross-boundary Convex imports from `../src/lib/foodEvidence`
- The `stationDefinitions` or `ingredientTemplates` Convex tables
- The `normalizeCanonicalName` in `convex/foodLibrary.ts`

Phase 4 will:

- Move `buildFoodEvidenceResult` to server-only (Convex internal module)
- Fix the cross-boundary imports
- Migrate `stationDefinitions` and `ingredientTemplates` to use
  `FoodGroup`/`FoodLine` from the registry
- Replace `normalizeCanonicalName` in `convex/foodLibrary.ts` with
  registry-based canonicalization

## Verification

After implementation:

1. `bun run typecheck` — clean
2. `bun run build` — clean
3. Existing tests pass (the "avoid" test should now pass)
4. The 2 pre-existing Bayesian test failures should both resolve
5. Manual verification: open Patterns page, check that food stats group
   correctly under registry canonicals

## Files changed (expected)

| File                      | Change                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/foodEvidence.ts` | Replace `normalizeFoodName` with registry lookup + fallback. Split avoid/watch.          |
| `src/lib/analysis.ts`     | Fix BRAT baseline. Delete dead correlation code. Remove `correlations` from return type. |
| Tests                     | Update/create tests for the avoid/watch split and registry-based grouping.               |
