# Adversarial Audit: Phases 1–4 — Full Report

**Updated:** 2026-03-13 after Phases A-D root-cause remediation

**Verification basis for this document update:**

- **Re-verified directly in current code/tests during this update:** `C2`, `C3`,
  `C4`, `C5`, `H1`, `H3`, `H4`, `H5`, `M2`, `M4`, `M5`, `M9`, `M10`,
  `M14`, `M15`, `M16`, `M17`, `M18`, `M19`, `M20`
- **Carried forward as closed from earlier remediation work and current project
  records, but not fully re-audited line-by-line in this documentation pass:**
  `C1`, `C6`, `H2`, `H6`, `M11`, `M12`, `M13`

If any of the second-group items need absolute certainty, they should be
re-audited live before treating this report as final evidence.

---

## CRITICAL (fix before Phase 5)

### C1. Normalization bypass in Convex queries **CLOSED**

`convex/foodAssessments.ts:20` and `convex/aggregateQueries.ts:57` use `.toLowerCase().trim()` instead of registry canonicalization. Querying "Scrambled Egg" finds "scrambled egg" not "egg". Assessment lookups and trial summaries return wrong results.

### C2. Bristol 1 under-penalized **CLOSED**

`shared/foodEvidence.ts:152` maps Bristol 1–2 → "hard" (weight 0.35). But Bristol 1 is severe constipation — should be "bad" (weight 1.0). `analysis.ts:223` correctly distinguishes Bristol 1 as "constipated". The two files disagree. Every Bristol 1 event is penalized at 35% of its true severity.

### C3. Math.max() with empty logs = -Infinity **CLOSED**

`computeAggregates.ts:46` — if the logs array is empty, `Math.max(...timestamps)` returns `-Infinity`, which propagates as `recomputeAt`, causing exponentially large recency weights in the Bayesian engine. Latent bomb.

### C4. Example map shadowing — "boiled carrot" resolves to wrong food **CLOSED**

`shared/foodCanonicalization.ts` uses first-match-wins. Zone 1B registered "boiled carrot" as an example of "mashed root vegetable" before the Zone 2 "boiled carrot" canonical. Result: the Zone 2 "boiled carrot" entry is dead — unreachable via its own name. Same for "cooked pumpkin" and "steamed carrot". Users logging boiled vegetables get Zone 1B pureed food classifications.

### C5. Empty LLM response = silent data loss **CLOSED**

`isValidFoodParseResult` accepts `{ items: [] }` and `{ components: [] }`. An empty items array overwrites the log with zero food entries. An empty components array means the food vanishes from the log. Empty string `canonicalName: ""` also passes validation and propagates to the evidence pipeline.

### C6. Client/server evidence divergence **CLOSED**

Client uses `useSyncedLogs(limit)` (truncated). Server's `computeAggregates.ts` uses `.collect()` (all logs). Different datasets → different posteriors for the same food. Users see different safety scores depending on which surface they look at.

---

## HIGH (fix before or early in Phase 5)

### H1. Ghost foods from AI assessments **CLOSED**

`foodEvidence.ts:612` — any food with 1+ AI assessment gets a summary entry, even with 0 trials. If Dr. Poo mentions 15 foods the user never ate, all 15 appear in the database with `posteriorSafety = 0.667` (pure prior), status "building".

### H2. Transit calibration feedback loop **CLOSED**

Client computes calibration from limited logs, persists it to profile. Server uses this stale calibration as seed for future computations. With only 4 calibration trials required (`MIN_CALIBRATION_TRIALS`), a few outliers can learn a wildly wrong calibration that then persists.

### H3. Only 3 tests for the Bayesian engine **CLOSED**

15+ code paths, multiple threshold boundaries, asymmetric trial pairing, modifier interactions — and 3 tests, all happy-path with one-food-per-day fixtures. No tests for: AI assessment integration, ghost foods, avoid/watch boundary, tendency calculation, modifier stacking, 0-input edge case, candidate dilution.

### H4. "nut butter" → "nuts" (Zone 3) **CLOSED**

Peanut butter from a jar classified as whole nuts due to example map ordering. Clinically wrong — smooth nut butter is Zone 2.

### H5. Weekly digest only counts "culprit" verdict **CLOSED**

`computeAggregates.ts:302` — `topCulprits` filters for `verdict === "culprit"` (legacy) and misses `"avoid"` (current). All new avoid verdicts invisible in weekly digest.

### H6. Cross-boundary import remains **CLOSED**

`extractInsightData.ts:6` imports `StructuredFoodAssessment` from `../src/types/domain`. Type-only so no runtime break, but violates Phase 4 boundary rules.

---

## MEDIUM (address during Phase 5)

| # | Finding | Location | STATUS |
| - | ------- | -------- | --------- |
~~| M1 | `severeLowConfounderCount >= 2` misleading — 2 events alone don't push posterior below 0.35, needs AI corroboration | `foodEvidence.ts:515` | **CLOSED** |~~
| M2 | 55-min transit floor, not the documented 6-hour minimum. With learned calibration center=120, spread=90, window starts at 55 minutes | `foodEvidence.ts:412` | **CLOSED** |
~~| M3 | Sleep modifier hardcoded +45 min regardless of duration | `foodEvidence.ts:282` | **CLOSED** |~~
| M4 | Orphan trials from constipation — 18h cap means multi-day gaps produce unmatched food trials inflating `totalTrials` | `foodEvidence.ts resolveTrials` | **CLOSED** |
| M5 | Composite quantity inheritance: "2 slices toast with butter" → butter gets `quantity: 2` | `useFoodParsing.ts:114` | **CLOSED** |
~~| M6 | No retry for transient OpenAI failures (429, 500, timeout) | `useFoodParsing.ts` | **CLOSED** |~~
~~| M7 | API key visible in Convex dashboard function logs (action args are logged) | `convex/ai.ts` | **CLOSED** |~~
~~| M8 | No forced registry matching — LLM can invent canonical names that split evidence | `foodLlmCanonicalization.ts` | **CLOSED** |~~
| M9 | Transient wrong `ingredientExposure` records between initial save and AI enrichment | `convex/logs.ts` | **CLOSED** |
| M10 | Weekly digest food counting uses `.toLowerCase().trim()` not registry | `computeAggregates.ts:253,271` | **CLOSED** |
| M11 | `ingredientProfiles` table disconnected from registry — category/subcategory are free-form strings | `convex/ingredientProfiles.ts` | **CLOSED** |
| M12 | `foodLibrary.ts:403` applies food-name normalization to tags, mangling non-food tags | `convex/foodLibrary.ts` | **CLOSED** |
| M13 | `convex/tsconfig.json` — `../shared/` not in include, shared files not type-checked from Convex directory | `convex/tsconfig.json` | **CLOSED** |
| M14 | Missing registry entries: jelly/gelatin, custard, rice pudding, gravy, honey, jam, tofu, noodles | `shared/foodRegistry.ts` | **CLOSED** |
| M15 | "stir fry" classified as "curry dish" | `shared/foodRegistry.ts` | **CLOSED** |
| M16 | Miso soup classified as "clear broth" — clinically questionable | `shared/foodRegistry.ts` | **CLOSED** |
| M17 | LLM vocabulary truncates to 5 examples per entry, losing important synonyms | `foodLlmCanonicalization.ts:35` | **CLOSED** |
| M18 | No group/line type constraint — `group: "protein"`, `line: "grains"` compiles fine | `shared/foodRegistry.ts` | **CLOSED** |
| M19 | Zero tests for `postProcessCanonical` (the LLM safety net) | Tests missing | **CLOSED** |
| M20 | `existingNames` sent to LLM can grow unbounded, inflating token usage | `useFoodParsing.ts` | **CLOSED** |

---

## LOW / Cleanup

| # | Finding | Est. lines | STATUS |
|---|---------|------------| ------ |
~~| L1 | Orphaned hooks: `useCoaching.ts`, `useScheduledInsights.ts` | ~500 | **CLOSED** |~~
~~| L2 | Orphaned components: `StepIcon.tsx`, `Reasuring.tsx` (typo) | ~50 | **CLOSED** |~~
~~| L3 | Unused UI primitives: pagination, resizable, chart, date-picker, field, skeleton | ~800 | **CLOSED** |~~
~~| L4 | Unused npm packages: `@xyflow/react`, `react-resizable-panels`, `autoprefixer` | — | **CLOSED** |~~
~~| L5 | Empty directory: `convex/data/` | — | **CLOSED** |~~
~~| L6 | Schema: gamification validator still in profiles table | `convex/schema.ts` | **CLOSED** |~~
~~| L7 | Schema comment "watch not used yet" is stale | `convex/schema.ts` | **CLOSED** |~~
~~| L8 | `verdictToStoredVerdict` return type wider than implementation | `extractInsightData.ts:26` | **CLOSED** |~~
~~| L9 | Stale doc references: 3 broken links in `food-system-rebuild.md` and `FEATURE_STATUS.md` | — | **CLOSED** |~~
~~| L10 | `images/` and `output/` should be in `.gitignore` | — | **CLOSED** |~~
~~| L11 | "chili" → "chili con carne" not "chili" the spice (documented but UX trap) | `shared/foodRegistry.ts` | **CLOSED** |~~
~~| L12 | `eggs_dairy` line has no Zone 2 entries — visual gap on transit map | `shared/foodRegistry.ts` | **CLOSED** |~~
~~| L13 | "concentrated sweet food" in grains line — misleading on transit map | `shared/foodRegistry.ts` | **CLOSED** |~~
| L14 | Photo/Gemini analysis is marketing copy only — not implemented | Landing page | ------ |
~~| L15 | `currentStatus` field in `FusedFoodSummaryOverride` defined but never read | `analysis.ts:57` | **CLOSED** |~~
| L16 | Disconnected TransitMap + transitData (~3,400 lines) — intentionally kept for Phase 5 reference | `src/components/patterns/transit-map/` | ------ |

---

## The Big Picture

### What's solid

- The registry is now a harder contract, not just a vocabulary list.
- The `shared/` directory pattern works.
- The Bayesian math is fundamentally sound (Beta-Binomial conjugate update).
- Raw log data is preserved correctly and the write path now materialises from
  canonicalized rows instead of transient placeholder rows.
- Phase 4 game layer deletion was clean — no dangling references.
- The parser/LLM boundary is stricter and the registry drift tests are now much
  louder.

### What's brittle

- The remaining work is now mostly future-product work and low-priority cleanup,
  not the original Phase 1-4 defect cluster.
- The main risk going forward is reintroducing parallel taxonomy through UI-side
  exceptions instead of keeping the registry authoritative.

### What will bite you in Phase 5

- Phase 5 risk is now mostly about new UI/product work, not unresolved
  Phases 1-4 audit bugs.
- The main architectural guardrail is unchanged: do not invent parallel food
  meaning outside `shared/foodRegistry.ts` and its shared canonicalization path.

### Recommended fix order

1. Treat this audit's critical/high/medium bug list as closed unless a live regression reopens it.
2. Keep using registry-first fixes instead of adding surface-specific exceptions.
3. Spend next effort on Phase 5 / Phase E work and the remaining low-priority cleanup.
