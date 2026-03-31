# Data Architecture Audit: Cost, Bandwidth & Schema Analysis

> **Date:** 2026-03-18
> **Status:** Complete audit — findings feed into Sprint 2.5+ plan
> **Scope:** All 21 Convex tables, 33 reactive queries, food pipeline, LLM integration

---

## Table Inventory (Live Data from Convex Dashboard)

| Table                   | Docs  | Est. Bytes/Doc                            | Total Est.         | Role                                                             |
| ----------------------- | ----- | ----------------------------------------- | ------------------ | ---------------------------------------------------------------- |
| **logs**                | 1,157 | 0.5-2 KB                                  | ~1.2 MB            | Core event log (food, fluid, habit, digestion, weight, activity) |
| **aiAnalyses**          | 92    | 2-5 KB (meta) + 50-100 KB (38 unmigrated) | ~3.6 MB unmigrated | Dr. Poo AI reports                                               |
| **aiAnalysisPayloads**  | 54    | 50-100 KB                                 | ~4 MB              | Split-out LLM request/response blobs                             |
| **conversations**       | 143   | 1-5 KB                                    | ~350 KB            | User/assistant chat messages                                     |
| **foodAssessments**     | 444   | ~0.5 KB                                   | ~220 KB            | Extracted per-food verdicts from AI                              |
| **foodEmbeddings**      | **0** | -                                         | **EMPTY**          | Vector index table — never populated                             |
| **foodAliases**         | 39    | ~0.2 KB                                   | ~8 KB              | Learned food name-to-canonical mappings                          |
| **foodTrialSummary**    | 54    | ~1 KB                                     | ~54 KB             | Aggregated food trial status                                     |
| **ingredientExposures** | 1,924 | ~0.3 KB                                   | ~580 KB            | Denormalized per-ingredient-per-log                              |
| **reportSuggestions**   | 336   | ~0.3 KB                                   | ~100 KB            | Extracted suggestions from AI reports                            |
| **weeklyDigest**        | 5     | ~0.5 KB                                   | ~2.5 KB            | Computed weekly aggregates                                       |
| **weeklySummaries**     | 7     | ~3 KB                                     | ~21 KB             | LLM-generated weekly narratives                                  |
| **profiles**            | ~1    | ~2 KB                                     | ~2 KB              | User profile + preferences                                       |
| **foodLibrary**         | small | ~0.3 KB                                   | small              | User-defined food compositions                                   |
| **foodRequests**        | small | ~0.3 KB                                   | small              | Food addition requests                                           |
| **ingredientOverrides** | small | ~0.2 KB                                   | small              | User manual food status overrides                                |
| **ingredientProfiles**  | small | ~0.5 KB                                   | small              | Nutritional profiles per ingredient                              |
| **waitlistEntries**     | small | ~0.2 KB                                   | small              | Waitlist signups                                                 |

**System tables (asterisked in dashboard):** gameState, ingredientTemplates, stationDefinitions, trialSessions

---

## Critical Findings

### Finding 1: foodEmbeddings is Dead Code (HIGH cost, ZERO value)

The entire OpenAI `text-embedding-3-small` pipeline has never run. Table has 0 documents. This means:

- `fetchOpenAiEmbeddings()` in foodParsing.ts: dead code
- `ensureFoodEmbeddings()`: dead code
- `searchEmbeddingCandidates()`: dead code
- Convex vector index `by_embedding`: empty, costing index storage overhead
- Schema defines 1536-dimension float64 array field for zero rows

The food matching pipeline has been running on **fuzzy-only (Fuse.js) matching the entire time**. The 65%/35% fuzzy/embedding merge code path never activates.

**Assessment (REVISED):** Embeddings solve the "Chelitos problem" — brand names, regional foods, and voice-to-text spelling variations that fuzzy matching can't handle. The vocabulary IS open-ended because users log brand names, regional dishes, and voice-transcribed food names that aren't in the registry. Embeddings are 1000-10000x cheaper than LLM calls ($0.000001 vs $0.001-0.01). **Recommendation: populate the existing infrastructure and extend it to embed learned user aliases.** When a user maps "Chelitos" → "crispy crackers", embed "Chelitos" so that future misspellings ("Kaelitas", "Kelitos") auto-resolve via vector similarity.

### Finding 2: aiAnalyses Payload Migration Incomplete (HIGH bandwidth)

Schema comment states this **was costing 3.29 GB/day in bandwidth**. The fix (splitting payloads to `aiAnalysisPayloads`) is only **58% complete**: 54 of 92 reports migrated.

38 unmigrated documents still carry inline `request` + `response` fields (50-100KB each). Every reactive subscription to `aiAnalyses` re-reads these fat documents on every tick.

**Math:** 38 docs x ~75KB avg = ~2.85 MB re-transmitted on every reactive update cycle.

### Finding 3: Full-Table .collect() Anti-Pattern (HIGH, grows linearly)

`updateFoodTrialSummaryImpl` (computeAggregates.ts:257-271) runs every time a new AI report is generated:

```
logs.collect()             -> ALL 1,157 logs
foodAssessments.collect()  -> ALL 444 assessments
foodTrialSummary.collect() -> ALL 54 summaries
```

~1,675 documents read per report. Over 92 reports = ~154,000 cumulative doc reads.

`updateWeeklyDigestImpl` reads ALL prior food logs (computeAggregates.ts:424-441) to compute "new foods tried this week" — unbounded historical scan.

**Growth curve is quadratic:** each new report reads more data than the last.

### Finding 4: ingredientExposures Write Amplification (MEDIUM)

1,924 exposures from ~200 food logs = ~9.6 writes per food log. Every food log creates N exposure rows.

Both queries do full-table scans:

- `historyByIngredient`: `.collect()` ALL 1,924 rows, normalize, filter in JS
- `allIngredients`: `.take(5000)` — nearly all rows

**Purpose of ingredientExposures:** Tracks per-ingredient exposure history for the transit map and food trial assessments. Records when each canonical food was eaten, quantity, preparation method, spice level, and recovery stage. Used by:

1. Transit map station artwork (exposure counts, last-seen dates)
2. Food trial summary computation (exposure frequency as evidence weight)
3. Ingredient history drill-down UI

**The problem:** This is a derived denormalization of data already in `logs`. And because stored canonical names can go stale, the index is useless and queries do full scans.

### Finding 5: Stale Canonical Names Force Runtime Normalization (ROOT CAUSE)

**This is the single most impactful architectural debt.** Multiple tables store `canonicalName` values that can become stale when the food registry evolves. As a result, 11+ query functions use `.collect()` instead of indexed queries because:

> "Stored canonical names may be stale (written under an older registry version). The index would miss rows whose stored name differs from the current normalized form." — code comment, ingredientExposures.ts:37-41

**Key insight:** Food registry updates only happen at planned release times. Canonical staleness is a **migration problem, not a runtime problem**. A one-time migration per registry update fixes all stored names, restoring indexed query paths.

### Finding 6: reportSuggestions Redundant Extraction (LOW)

336 docs, fully derivable from `aiAnalyses.insight.suggestions`. Exists for the `by_userId_timestamp` index but adds writes and storage.

### Finding 7: GPT-4o-mini LLM Fallback Rarely Fires (LOW)

Only triggers when confidence < 0.56 AND phrase is structurally ambiguous AND candidates exist. With embeddings dead (Finding 1), the pipeline is fuzzy-only, and most lookups resolve at HIGH or MEDIUM confidence. The LLM path is extremely rare.

### Finding 8: weeklyDigest vs weeklySummaries Divergent (LOW)

5 digest docs vs 7 summary docs — out of sync. Different update mechanisms, different schemas.

---

## Reactive Query Audit (33 Active Subscriptions)

### Full-Table Scan Queries (Invalidated by Mutations)

| Query                        | Table               | Docs Scanned | Trigger                        |
| ---------------------------- | ------------------- | ------------ | ------------------------------ |
| `allFoods`                   | foodAssessments     | 444          | Every new AI report extraction |
| `culprits`                   | foodAssessments     | 444          | Every new AI report extraction |
| `historyByFood`              | foodAssessments     | 444          | Every new AI report extraction |
| `allFoodTrials`              | foodTrialSummary    | 54           | Every aggregate recompute      |
| `foodTrialsByStatus`         | foodTrialSummary    | 54           | Every aggregate recompute      |
| `foodTrialByName`            | foodTrialSummary    | 54           | Every aggregate recompute      |
| `historyByIngredient`        | ingredientExposures | 1,924        | Every food log                 |
| `allIngredients`             | ingredientExposures | up to 5,000  | Every food log                 |
| `list` (foodLibrary)         | foodLibrary         | all          | Every food log                 |
| `list` (ingredientOverrides) | ingredientOverrides | all          | Manual user action             |
| `list` (ingredientProfiles)  | ingredientProfiles  | all          | Rare                           |

### Cascade Effect: What Happens When You Log Food + Trigger AI Report

```
User logs food -> 1 log write -> invalidates logs.list, logs.listAll, logs.count
              -> ~10 ingredientExposure writes -> invalidates allIngredients, historyByIngredient
              -> food pipeline (fuzzy only)

User triggers AI report -> LLM call (~75KB response)
  -> write aiAnalysis + payload -> invalidates aiAnalyses.list (92 docs, 38 fat)
  -> extract ~5 foodAssessments -> invalidates allFoods, culprits, historyByFood (444 each)
  -> extract ~4 suggestions -> invalidates recentUnique, repetitionCounts
  -> updateFoodTrialSummary -> reads 1,655 docs, writes summaries
     -> invalidates allFoodTrials, foodTrialsByStatus, foodTrialByName (54 each)
  -> updateWeeklyDigest -> reads ~1,500 docs, writes digest
     -> invalidates currentWeekDigest, allWeeklyDigests
```

**Per AI report:** ~12 query re-executions, ~10,000+ document reads in the reactive cascade.

---

## Cost Projections

### Current (1 user, 32 days)

- ~3,155 doc reads per AI report (aggregation)
- ~10,000 doc reads per reactive cascade
- ~290,000 cumulative doc reads for aggregation
- 2.85 MB unmigrated payloads resent per reactive tick

### At 6 months (1 user)

- ~15,000 logs, ~500 reports, ~12,000 ingredient exposures
- Each report aggregation: ~16,000 doc reads
- Each reactive cascade: ~40,000 doc reads
- Cumulative: ~8 million doc reads for aggregation alone

### With fixes applied

- Each report aggregation: ~200 doc reads (indexed + incremental)
- Each reactive cascade: ~500 doc reads (indexed queries)
- **94% reduction in document reads**
- **100% elimination of reactive bandwidth waste from unmigrated payloads**

---

## Prioritized Fix Table

| Priority | Action                                                             | Savings                                                         | Effort                                |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------- |
| **T1-1** | Complete aiAnalysis payload migration (38 remaining)               | Eliminates 2.85 MB per reactive tick                            | 1 migration script                    |
| **T1-2** | Make updateFoodTrialSummary incremental                            | 94% fewer reads per report                                      | Moderate refactor                     |
| **T1-3** | Fix weeklyDigest "new foods" scan (known-foods set on profile)     | Eliminates unbounded historical scan                            | Add field to profile                  |
| **T2-1** | Registry-update migration script (normalize all stored canonicals) | Unlocks indexed queries across 6+ tables                        | 1 migration script                    |
| **T2-2** | Eliminate ingredientExposures or replace with single summary doc   | -1,924 rows, -9.6 writes/food-log, -full-scan queries           | Audit consumers, refactor             |
| **T2-3** | **Populate** foodEmbeddings + extend for alias embeddings          | Eliminates most LLM fallback calls, handles spelling variations | Seed existing code + schema extension |
| **T2-4** | Eliminate reportSuggestions table                                  | -336 rows, -3.7 writes/report                                   | Update queries                        |
| **T3-1** | Time-windowed log queries (48-72hr)                                | Bounded reads regardless of tenure                              | Refactor computeAggregates            |
| **T3-2** | LLM context pipeline: relevance-filtered summaries                 | 85%+ token reduction per LLM call                               | New prompt architecture               |
| **T3-3** | Bayesian transit calibration for predictive insights               | Forward-looking food tolerance predictions                      | New statistical engine                |
