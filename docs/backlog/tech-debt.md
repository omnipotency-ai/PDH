# Technical Debt Register

**Last updated:** 2026-03-17
**Sources:** Code review (PERF-##), architecture (TD-##), adversarial audit (AUD-##)

> **Food system audit tech debt** (AUD-TD1 through AUD-TD24) is tracked in
> [`docs/audits/Food-Adversarial-Audit-Phase-1-to-4.md`](../audits/Food-Adversarial-Audit-Phase-1-to-4.md).
> All items there are **closed**. Only low-priority cleanup items remain below.

---

## High Priority

- **TD-01** — buildFoodEvidenceResult client+server
  Difficulty: Hard · Agent: Opus 4.6
  Runs in both client and Convex backend; should be server-only. Client execution risks stale data and blurs the single-source-of-truth principle.

- **PERF-001** — analyzeLogs called twice
  Difficulty: Hard · Agent: Opus 4.6
  Patterns and Menu both call `analyzeLogs` independently — lift to shared context or memoized hook.

- **TD-12** — Large file: aiAnalysis.ts
  Difficulty: Medium · Agent: Opus 4.6
  File has grown large and mixed responsibilities. Needs decomposition into focused modules.

## Medium Priority

- **TD-05** — O(n^2) weekly digest
  Difficulty: Medium · Agent: Sonnet 4.6

- **TD-06** — Backup field validation
  Difficulty: Easy · Agent: Opus 4.6

- **TD-07** — Bayesian run-once
  Difficulty: Medium · Agent: Sonnet 4.6
  Could be optimized to run once instead of recomputing on every render.

- **TD-08** — Zone type duplication
  Difficulty: Easy · Agent: Opus 4.6
  `Zone` in `foodStatusThresholds.ts` duplicates `FoodZone` from registry. Consolidate to one type.

- **TD-09** — Stale comments
  Difficulty: Easy · Agent: Opus 4.6
  `foodStatusThresholds.ts` references deleted files.

- **TD-10** — existingNames in food parsing
  Difficulty: Medium · Agent: Sonnet 4.6
  `existingNames` may cause LLM to prefer library names over registry canonicals.

- **TD-11** — Feature flags file needs reproductive health gate
  Difficulty: Easy · Agent: Opus 4.6
  `featureFlags.ts` currently has only `transitMapV2: true` (dead, always-on). Needs `reproductiveHealth: false` flag added to gate repro module for v1 per ADR-0008.

## Low Priority / Cleanup

- **INV-01** — Legacy activity sleep readers
  Some code paths may still read sleep from legacy records.

- **CONVEX-ORPHANS** — 4 orphan game layer tables in Convex dashboard
  Difficulty: Easy (manual) · Owner: User
  The game layer was deleted from schema but 4 tables still exist in the Convex dashboard and cannot be removed via code. Requires manual deletion through the Convex web dashboard. No data integrity risk but adds noise.

## Resolved

| ID         | Title                                     | Resolution                                            |
| ---------- | ----------------------------------------- | ----------------------------------------------------- |
| TD-02      | normalizeCanonicalName competing          | Fixed in Phase 4 + audit remediation                  |
| TD-03      | Cross-boundary import                     | Fixed — moved to `shared/`                            |
| TD-04      | ingredientTemplatesSeed misaligned        | File deleted in Phase 4                               |
| AUD-TD1    | Only 3 Bayesian tests                     | Closed — see audit file                               |
| AUD-TD2    | Zero postProcessCanonical tests           | Closed — see audit file                               |
| AUD-TD3    | Cross-boundary import: extractInsightData | Closed — see audit file                               |
| AUD-TD4-14 | All medium audit tech debt                | Closed — see audit file                               |
| AUD-TD15   | Orphaned hooks                            | Deleted in audit cleanup                              |
| AUD-TD16   | Orphaned components                       | Deleted in audit cleanup                              |
| AUD-TD17   | Unused UI primitives                      | Deleted in audit cleanup                              |
| AUD-TD18   | Unused npm packages                       | Removed in audit cleanup                              |
| AUD-TD19   | Empty `convex/data/` directory            | Deleted in audit cleanup                              |
| AUD-TD20   | gamification validator in schema          | Removed from schema + all references in audit cleanup |
| AUD-TD21   | Stale doc references                      | Fixed in audit cleanup                                |
| AUD-TD22   | .gitignore gaps                           | Added in audit cleanup                                |
| AUD-TD23   | currentStatus field unused                | Already absent — confirmed closed                     |
| AUD-TD24   | verdictToStoredVerdict return type        | Already correct — confirmed closed                    |
| L7         | Stale "watch not used yet" schema comment | Fixed in audit cleanup                                |
