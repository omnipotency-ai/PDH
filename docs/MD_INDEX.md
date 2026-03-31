# Caca Traca — Markdown Documentation Index

> Generated 2026-03-13. Updated 2026-03-15. 87 files catalogued across the full repository (counts predate 2026-03-14 additions).
>
> **Purpose:** Understand what plans exist, which are implemented, which are still relevant,
> which are candidates for deletion, and how everything fits the product vision of helping
> anastomosis patients reintegrate food with confidence.

---

## Category Key

| Category                   | Meaning                                               |
| -------------------------- | ----------------------------------------------------- |
| **active-guide**           | Living document that drives current decisions         |
| **active-plan**            | Plan not yet fully implemented — still actionable     |
| **implemented**            | Plan or spec that has been fully executed             |
| **reference**              | Durable background knowledge, not directly actionable |
| **archived**               | Historical record, kept for audit trail only          |
| **candidate-for-deletion** | Outdated, redundant, or misleading — safe to remove   |

---

## Folder Tree

```
.
├── CLAUDE.md                          # active-guide
├── AGENTS.md                          # active-guide
├── convex/
│   └── README.md                      # candidate-for-deletion
└── docs/
    ├── README.md                      # active-guide
    ├── VISION.md                      # reference
    ├── FEATURE_STATUS.md              # active-guide
    ├── STRATEGIC_OVERVIEW.md          # reference (partially stale)
    ├── MD_INDEX.md                    # this file
    ├── current-state-architecture.md  # active-guide
    ├── consolidated-report.md         # implemented
    ├── v1_sprint_tasks.md             # implemented
    ├── 2026-03-10-wave4-full-review.md # implemented
    ├── SESSION-2026-03-10.md          # archived
    ├── adrs/
    │   ├── 0001-cloud-only-architecture.md
    │   └── 0002-food-registry-and-canonicalization.md
    ├── archive/  (empty)
    ├── audits/archive/
    │   ├── 2026-02-24/  (9 files)
    │   ├── 2026-02-27/  (6 files)
    │   └── 2026-02-28/  (10 files)
    ├── browser-testing/
    │   ├── 2026-03-09-v1-test-run.md
    │   └── archive/
    │       └── 2026-03-09-v1-test-run.md
    ├── plans/
    │   ├── v1-release-lock-migration-checklist.md
    │   └── 2026-03-14-food-pipeline-ui-fixes.md
    │   (NOTE: food-system-rebuild.md, food-system-legacy-assessment.md,
    │    transit-map-and-reward-model.md, and 2026-03-13-phase-4-convex-migration.md
    │    were removed from this directory by 2026-03-15)
    ├── policies/
    │   └── input-safety-and-xss.md
    ├── product/
    │   ├── README.md
    │   ├── launch-criteria.md
    │   ├── risk-register.md
    │   ├── scope-control.md
    │   ├── adr/  (8 files, 000-007)
    │   └── backlog/
    │       ├── bugs.md
    │       ├── features.md
    │       └── investigations.md
    ├── prompts/
    │   ├── architecture-rethink.md
    │   ├── v1-system-prompt.md
    │   ├── v2-system-prompt.md
    │   ├── v3-strategy.md
    │   └── phase-4-execution-prompt.md
    ├── research/  (7 files)
    ├── reviews/ai_prompt/
    │   ├── 2026-02-25-dr-poo-prompt-and-data-review.md
    │   ├── AI_SYSTEM_REVIEW.md
    │   ├── PROMPT_ANALYSIS.md
    │   └── data-model/  (3 files)
    ├── scratchpadprompts/
    │   ├── food-registry-restructured.md
    │   └── transitmap.md
    ├── backlog/
    │   ├── DASHBOARD.md
    │   ├── bugs.md
    │   ├── features.md
    │   └── tech-debt.md
    └── working/
        ├── README.md
        └── templates/
            ├── implementation-plan-template.md
            ├── prd-template.md
            ├── session-handover-template.md
            └── working-memory-template.md
```

---

## Summary Tables

### Root Files

| File               | Summary                                                                              | Updated    | Category               |
| ------------------ | ------------------------------------------------------------------------------------ | ---------- | ---------------------- |
| `CLAUDE.md`        | Project-wide agent guidance: architecture, code style, source-of-truth, UX standards | 2026-03-11 | active-guide           |
| `AGENTS.md`        | Skills registry declaring `vite-react-implementer` skill                             | 2026-03-09 | active-guide           |
| `convex/README.md` | Auto-generated Convex boilerplate with generic examples                              | 2026-02-21 | candidate-for-deletion |

### docs/ (root)

| File                              | Summary                                                                                                                                 | Updated    | Category     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ |
| `README.md`                       | Navigation index linking to key docs entry points                                                                                       | 2026-03-09 | active-guide |
| `VISION.md`                       | App identity, target user, v1.0 scope definition. Updated 2026-03-15: Testing section updated to reflect full E2E + unit test suite.    | 2026-03-15 | reference    |
| `FEATURE_STATUS.md`               | Every feature mapped to status with key file paths. Phases 2.5, 3 shipped; Transit Map restored.                                        | 2026-03-13 | active-guide |
| `STRATEGIC_OVERVIEW.md`           | 8-agent deep scan: contradictions, security, component health. Updated 2026-03-15: Phase 1-4 progress log added; E2E gap row corrected. | 2026-03-15 | reference    |
| `current-state-architecture.md`   | Post-cloud-only architecture: Convex sole source of truth                                                                               | 2026-03-12 | active-guide |
| `consolidated-report.md`          | 51-component review against 63-bug test run                                                                                             | 2026-03-12 | implemented  |
| `v1_sprint_tasks.md`              | 12-task sprint plan, all tasks DONE                                                                                                     | 2026-03-12 | implemented  |
| `2026-03-10-wave4-full-review.md` | Wave 4 code review: 3 criticals fixed, deferred items remain                                                                            | 2026-03-12 | implemented  |
| `SESSION-2026-03-10.md`           | Session log: fluids rewrite, toasts, habits fixes                                                                                       | 2026-03-12 | archived     |
| `MD_INDEX.md`                     | This file                                                                                                                               | 2026-03-13 | active-guide |

### docs/adrs/

| File                                         | Summary                                                                       | Updated    | Category  |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ---------- | --------- |
| `0001-cloud-only-architecture.md`            | Accepted: Convex sole persistence, IDB = API key only                         | 2026-03-11 | reference |
| `0002-food-registry-and-canonicalization.md` | Food registry system: Phases 1-4 complete, Phase 5 (transit map UI) is future | 2026-03-15 | reference |

### docs/archive/

Directory is empty. `legacy_MD_INDEX.md` was deleted (superseded by this file).

### docs/audits/archive/

All 25 audit files are **archived**. They describe a pre-Clerk, pre-cloud-only codebase that no longer exists. Kept as historical record only.

| Folder        | Files            | Scope                                                                                                                                       |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-02-24/` | 9 files (00-08)  | Full codebase review: security, architecture, frontend, devops, testing, performance, code quality, data model                              |
| `2026-02-27/` | 6 files          | Habit system refactor audit: code quality, correctness, maintainability, performance, security, simplicity                                  |
| `2026-02-28/` | 10 files (00-09) | Deep-dive audit: imports, reusability, complexity, duplication, dead code, simplification, compatibility, TODOs, habit/quick-capture impact |

### docs/browser-testing/

| File                                | Summary                                                 | Updated    | Category     |
| ----------------------------------- | ------------------------------------------------------- | ---------- | ------------ |
| `2026-03-09-v1-test-run.md`         | Active bug tracker: 96 bugs across 2 passes, most fixed | 2026-03-12 | active-guide |
| `archive/2026-03-09-v1-test-run.md` | Original unedited test run with full descriptions       | 2026-03-12 | archived     |

### docs/plans/

| File                                     | Summary                                                                                                   | Updated    | Category    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| `v1-release-lock-migration-checklist.md` | Convex schema validator deployment checklist                                                              | 2026-03-02 | implemented |
| `2026-03-14-food-pipeline-ui-fixes.md`   | 5-bug fix plan: display names, expired re-matching, old log status, patterns table, review modal queue UX | 2026-03-14 | implemented |

**Note (2026-03-15):** Several previously listed plans were removed from this directory: `WIP.md` (stale backlog), `food-system-rebuild.md` (Phases 1-4 complete), `food-system-legacy-assessment.md` (superseded), `transit-map-and-reward-model.md` (Phase 5 is future), `2026-03-13-phase-4-convex-migration.md` (Phase 4 complete). Their archive copies remain in `docs/plans/archive/`.

### docs/plans/archive/

| File                                         | Summary                                                              | Updated    | Category    |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------- | ----------- |
| `2026-03-08-wire-bayesian-engine.md`         | Bayesian evidence engine wiring plan — all 5 tasks verified complete | 2026-03-12 | implemented |
| `2026-03-12-phase-2.5-hierarchy-revision.md` | Phase 2.5 plan: FoodGroup + FoodLine hierarchy — all 11 tasks done   | 2026-03-12 | implemented |
| `2026-03-12-phase-3-evidence-pipeline.md`    | Phase 3 evidence pipeline design spec — all 4 fixes implemented      | 2026-03-12 | implemented |
| `food-system-legacy-assessment.md`           | Pre-Phase-2.5 legacy assessment with verification audit appended     | 2026-03-12 | archived    |
| `food-system-rebuild.md`                     | Earlier working version of rebuild manifest, superseded              | 2026-03-12 | archived    |
| `transit-map-and-reward-model.md`            | Earlier transit map design with verification audit corrections       | 2026-03-12 | archived    |

### docs/policies/

| File                      | Summary                                                    | Updated    | Category  |
| ------------------------- | ---------------------------------------------------------- | ---------- | --------- |
| `input-safety-and-xss.md` | XSS prevention rules, sanitisation on write, audit command | 2026-02-25 | reference |

### docs/product/

| File                 | Summary                                                           | Updated    | Category               |
| -------------------- | ----------------------------------------------------------------- | ---------- | ---------------------- |
| `README.md`          | Product docs navigation hub                                       | untracked  | active-guide           |
| `launch-criteria.md` | v1.0 done checklist: functional, technical, security, docs        | 2026-03-03 | active-guide           |
| `risk-register.md`   | Technical and operational risks — contains stale local-first refs | 2026-02-28 | candidate-for-deletion |
| `scope-control.md`   | What is in v1, what is deferred, decision framework               | 2026-02-28 | reference              |

### docs/product/adr/

| File                                      | Summary                                                       | Updated    | Category               |
| ----------------------------------------- | ------------------------------------------------------------- | ---------- | ---------------------- |
| `000-template.md`                         | Blank ADR scaffold                                            | —          | reference              |
| `001-coaching-heuristic-test-coverage.md` | Pending: unit tests for habitCoaching.ts                      | 2026-02-27 | candidate-for-deletion |
| `002-coaching-file-boundary.md`           | Pending: split habitCoaching.ts or keep monolithic            | 2026-02-27 | candidate-for-deletion |
| `003-browser-api-key-strategy.md`         | Pending (but effectively decided): API key via Convex actions | 2026-02-27 | implemented            |
| `004-ai-prompt-versioning.md`             | Pending: version-tag prompts stored with results              | 2026-02-27 | candidate-for-deletion |
| `005-correlation-date-range-scope.md`     | Pending: date picker for correlation grid                     | 2026-02-27 | candidate-for-deletion |
| `006-ai-settings-placement.md`            | Pending: where to surface AI preferences                      | 2026-02-27 | candidate-for-deletion |
| `007-ai-model-configuration.md`           | Accepted: two-tier model config in aiModels.ts                | 2026-02-28 | implemented            |

### docs/product/backlog/

| File                | Summary                                                             | Updated    | Category               |
| ------------------- | ------------------------------------------------------------------- | ---------- | ---------------------- |
| `bugs.md`           | 5 bugs tracked, 3 fixed — does not include browser testing findings | 2026-03-03 | active-plan            |
| `features.md`       | 9 features (FEAT-01 to 09) with priority and status                 | 2026-03-03 | active-plan            |
| `investigations.md` | Single investigation (INV-01) on legacy sleep format                | 2026-02-28 | candidate-for-deletion |

### docs/prompts/

| File                          | Summary                                                  | Updated    | Category     |
| ----------------------------- | -------------------------------------------------------- | ---------- | ------------ |
| `architecture-rethink.md`     | Chat-first vs structured JSON AI architecture comparison | 2026-03-09 | reference    |
| `v1-system-prompt.md`         | Archived v1 Dr. Poo system prompt, superseded by v2      | 2026-03-02 | archived     |
| `v2-system-prompt.md`         | Currently active v2 Dr. Poo system prompt                | 2026-03-02 | active-guide |
| `v3-strategy.md`              | Planned v3 prompt evolution: 5 limitations, phased fixes | 2026-03-09 | active-plan  |
| `phase-4-execution-prompt.md` | Copy-paste session bootstrap for Phase 4 execution       | 2026-03-13 | active-plan  |

### docs/research/

| File                                 | Summary                                                                   | Updated    | Category               |
| ------------------------------------ | ------------------------------------------------------------------------- | ---------- | ---------------------- |
| `Bristol_Classification_Evidence.md` | Bristol Scale thresholds, transit windows, attribution logic              | 2026-03-10 | reference              |
| `Dr_Poo_Personalities.md`            | 9 AI tone-of-voice personality variations                                 | 2026-03-05 | reference              |
| `Habit_App_Anastomosis.md`           | UX architecture for anastomosis habit tracker — largely implemented       | 2026-02-27 | implemented            |
| `Habit_App_React_IndexedDB.md`       | React/Zustand/IndexedDB offline-first architecture — contradicts ADR-0001 | 2026-02-27 | candidate-for-deletion |
| `Habit_App_Retention.md`             | Behavioral science on habit app retention at 3-month mark                 | 2026-02-27 | reference              |
| `Reproductive_Health.md`             | Hormonal effects on GI motility post-surgery                              | 2026-03-05 | reference              |
| `food-zone-phase.md`                 | Zone 1/2/3 food reintroduction taxonomy and clinical thresholds           | 2026-03-12 | active-guide           |

### docs/reviews/ai_prompt/

| File                                          | Summary                                                            | Updated    | Category  |
| --------------------------------------------- | ------------------------------------------------------------------ | ---------- | --------- |
| `2026-02-25-dr-poo-prompt-and-data-review.md` | 7 data pipeline issues identified, most superseded by food rebuild | 2026-03-02 | archived  |
| `AI_SYSTEM_REVIEW.md`                         | All 7 LLM call types inventoried with bug list and cost analysis   | 2026-03-02 | archived  |
| `PROMPT_ANALYSIS.md`                          | 154 prompt instructions atomized, 5 conflicts identified           | 2026-03-02 | reference |

### docs/reviews/ai_prompt/data-model/

| File                               | Summary                                                             | Updated    | Category |
| ---------------------------------- | ------------------------------------------------------------------- | ---------- | -------- |
| `README.md`                        | Data model overview — describes superseded local-first architecture | 2026-03-02 | archived |
| `QUICK-REFERENCE.md`               | Schema cheat-sheet — data flow diagram is pre-cloud-only            | 2026-03-02 | archived |
| `dr-poo-ai-analysis-data-model.md` | 893-line technical reference — large sections architecturally stale | 2026-03-02 | archived |

### docs/scratchpadprompts/

| File                            | Summary                                                      | Updated    | Category     |
| ------------------------------- | ------------------------------------------------------------ | ---------- | ------------ |
| `food-registry-restructured.md` | Authoritative tables for all 11 food lines, zone assignments | 2026-03-12 | reference    |
| `transitmap.md`                 | Primary development log for food system rebuild sessions     | 2026-03-13 | active-guide |

---

## Detailed File Entries

### Root Files

#### CLAUDE.md

**Category:** active-guide | **Lines:** 456 | **Updated:** 2026-03-11

The primary instruction set for all coding agents working in this repo. Covers the full decision hierarchy (data trust > source-of-truth > usefulness > coherence), connectivity model (online-only, Convex sole source of truth, IDB = API key only), refactor permissions, design system rules, and communication style. Loaded on every session. Fully current and authoritative.

#### AGENTS.md

**Category:** active-guide | **Lines:** 11 | **Updated:** 2026-03-09

Thin skill registry consumed by Claude Code to route implementation tasks to the `vite-react-implementer` skill. Contains the skill name, trigger rules, and path to the SKILL.md file. Current and functional. Only needs updating if a new skill is added.

#### convex/README.md

**Category:** candidate-for-deletion | **Lines:** 90 | **Updated:** 2026-02-21

Default Convex scaffolding README with generic query/mutation examples. Contains zero project-specific content. Given the codebase has a fully custom Convex architecture with extensive real implementations, this file adds no value and could mislead contributors.

---

### docs/ (root)

#### docs/README.md

**Category:** active-guide | **Lines:** 62 | **Updated:** 2026-03-09

Navigation index for the docs folder, linking to VISION, FEATURE_STATUS, STRATEGIC_OVERVIEW, plans, research, audits, and reviews. Still accurate as a directory map, though it does not mention the Phase 4 plan or the 2026-03-12 review findings added since its last update.

#### docs/VISION.md

**Category:** reference | **Lines:** 154 | **Updated:** 2026-03-13

Defines the app's purpose, target user, core features, and key technical decisions for v1.0. The "Key Technical Decisions" section has been corrected to reflect the cloud-only architecture (ADR-0001). Product context and technical section are now aligned.

#### docs/FEATURE_STATUS.md

**Category:** active-guide | **Lines:** 130 | **Updated:** 2026-03-13

Comprehensive feature inventory mapping every feature across Track, Patterns, AI, Data, Settings, and Infrastructure to a status label with key file paths. Verified against the codebase on 2026-03-13. Food System Rebuild table updated: Phases 2.5 and 3 now show "Shipped". Transit Map restored (2026-03-13) and marked "Shipped".

#### docs/STRATEGIC_OVERVIEW.md

**Category:** reference | **Lines:** 442 | **Updated:** 2026-03-12

An 8-agent deep scan covering contradictions, missing pieces, data portability, security, performance, component health, and strategic recommendations. Includes a staleness note acknowledging that references to deleted files (TransitMap.tsx, transitMapLayout.ts, etc.) are outdated following Phase 2.5. Still valuable for known technical debt, but sections 2-4 and the Appendix File Map are significantly stale.

#### docs/current-state-architecture.md

**Category:** active-guide | **Lines:** 120 | **Updated:** 2026-03-12

Authoritative description of the post-cloud-only-migration architecture: Convex as sole source of truth, Zustand as ephemeral-only, IDB storing only the OpenAI API key. Covers data ownership, context providers, AI permissions, derived vs persisted data, and remaining architectural debt. The most accurate and current architectural reference. The note about `buildFoodEvidenceResult()` running in two places remains an open issue relevant to Phase 4.

#### docs/consolidated-report.md

**Category:** implemented | **Lines:** 810 | **Updated:** 2026-03-12

Detailed post-implementation review of 51 components against the 63-bug test run list. Contains raw voice-dictated user feedback embedded in component descriptions (toast design, celebration UX, habit card labels). Now that these bugs are fixed and subsequent review rounds have occurred, this is primarily historical. The embedded user feedback may still point to open design debt.

#### docs/v1_sprint_tasks.md

**Category:** implemented | **Lines:** 465 | **Updated:** 2026-03-12

The 12-task sprint execution plan for Phases 1-3 (data integrity, track page fixes, broken track features) with atomic task briefs. All 12 tasks are marked DONE. Still has value as a record of the rationale behind specific fixes, but is no longer a live work queue. Its section headings misleadingly describe it as a current queue.

#### docs/2026-03-10-wave4-full-review.md

**Category:** implemented | **Lines:** 371 | **Updated:** 2026-03-12

Wave 4 code review with 3 criticals (all FIXED), 19 warnings, and 22 minors. The lower half duplicates v1_sprint_tasks.md. Unresolved items (O(n^2) weekly digest, unvalidated backup imports, SW registration conflict) are documented as deferred. Useful as a historical audit record and source of deferred debt items.

#### docs/SESSION-2026-03-10.md

**Category:** archived | **Lines:** 123 | **Updated:** 2026-03-12

Session log detailing Phase 3-5 implementation (fluids revert, toasts, units consistency, conversation redesign). No ongoing reference value since MEMORY.md captures key conclusions and the bugs it raised have since been fixed.

---

### docs/adrs/

#### docs/adrs/0001-cloud-only-architecture.md

**Category:** reference | **Lines:** 32 | **Updated:** 2026-03-11

The definitive architectural decision governing the entire persistence model. Convex is the sole source of truth, IDB stores only the API key, Zustand is ephemeral-only. Tightly scoped, accurate, and authoritative. Should be checked against during any future work touching state management or persistence.

#### docs/adrs/0002-food-registry-and-canonicalization.md

**Category:** active-guide | **Lines:** 363 | **Updated:** 2026-03-13

The most current and authoritative document for the food system. Verified against the live codebase on 2026-03-12 with 5 corrections applied. Accurately describes Phases 1-3 as complete and Phase 4 as planned. Anyone working on food system code should read this first. Must be updated as Phase 4 is executed.

---

### docs/archive/

Directory is empty. `legacy_MD_INDEX.md` was deleted (superseded by this file).

---

### docs/audits/archive/

All 25 audit files are **archived** historical records. They describe a pre-Clerk, pre-cloud-only codebase that no longer exists. The critical findings (no auth, API key exposure, zero tests, local-first fragmentation) have all been addressed through the cloud-only migration, Clerk integration, and food system rebuild.

Two findings retain lingering architectural relevance but are tracked elsewhere:

- `2026-02-28/04-duplication-redundancy.md`: inputSafety.ts duplication motivates the Phase 4 `shared/` directory
- `2026-02-24/06-performance-review.md`: duplicate `analyzeLogs` subscriptions tracked as PERF-001/004

Individual file summaries are available in the summary table above.

---

### docs/browser-testing/

#### docs/browser-testing/2026-03-09-v1-test-run.md

**Category:** active-guide | **Lines:** 170 | **Updated:** 2026-03-12

The active bug tracker for the v1 sprint. Tracks 96 bugs across Passes 1 and 2 with verification status. Two critical bugs (#91, #92) and the ship blocker (#80 OpenAI prompt management) are correctly flagged. Settings, AI, and Menu pages remain untested (Pass 2 incomplete). Should continue to be updated as bugs are resolved.

#### docs/browser-testing/archive/2026-03-09-v1-test-run.md

**Category:** archived | **Lines:** 532 | **Updated:** 2026-03-12

The raw, unprocessed original of the test run with all 63 Pass 1 bugs in their original verbose form. Historical source of truth; the condensed file above supersedes it for active use.

---

### docs/plans/

#### docs/plans/WIP.md

**Category:** candidate-for-deletion | **Lines:** ~1076 | **Updated:** 2026-03-13

Dr. Poo report backlog from an earlier sprint session. Bugs A1-A3 and feature B2 removed as fixed. Remaining items are being triaged into the new consolidated backlog (`docs/backlog/`). Once triage is complete, this file should be deleted.

#### docs/plans/food-system-rebuild.md

**Category:** active-guide | **Lines:** 159 | **Updated:** 2026-03-13

The single most useful orientation document for the food system rebuild. Tracks all phase statuses (1-3 complete, Phase 4 planned, Phase 5 future), lists every active, migrated, and to-be-deleted file, and links to all phase-specific plans. Any agent starting Phase 4 execution should read this first.

#### docs/plans/food-system-legacy-assessment.md

**Category:** reference | **Lines:** 187 | **Updated:** 2026-03-13

Post-Phase-3 snapshot of remaining food system conflicts. analysis.ts reduced from 885 to ~255 lines. Two competing sources of truth remain (ingredientTemplatesSeed vs registry, normalizeCanonicalName vs normalizeFoodName). Accurate and useful while Phase 4 is being executed. Will become redundant once Phase 4 is done.

#### docs/plans/transit-map-and-reward-model.md

**Category:** active-guide | **Lines:** 172 | **Updated:** 2026-03-12

The live design doc for the future Phase 5 transit map UI. Correctly reflects what was implemented in Phase 2.5 (4-group/11-line hierarchy), what was deleted (legacy UI, now restored as reference model), and what is design-only (station status colours, reward milestones). The right document for a Phase 5/6 agent to read first.

#### docs/plans/v1-release-lock-migration-checklist.md

**Category:** implemented | **Lines:** 28 | **Updated:** 2026-03-02

Ordered checklist for running two Convex migrations before switching to a strict schema validator. A one-time use deployment procedure. Safe to archive once confirmed executed.

#### docs/plans/2026-03-13-phase-4-convex-migration.md

**Category:** active-plan | **Lines:** 549 | **Updated:** 2026-03-13

The execution-ready plan for Phase 4: 8 numbered tasks with exact file paths, before/after code snippets, typecheck checkpoints, and commit messages. Covers game layer deletion, `shared/` directory creation, and Convex normalization unification. No work has been done against it yet. This is the primary document a Phase 4 implementation agent should follow.

#### docs/plans/archive/2026-03-08-wire-bayesian-engine.md

**Category:** implemented | **Lines:** 393 | **Updated:** 2026-03-12

Fully executed plan for wiring habits, calibration, and AI assessments into the Bayesian evidence engine. All 5 tasks verified complete. Correctly archived.

#### docs/plans/archive/2026-03-12-phase-2.5-hierarchy-revision.md

**Category:** implemented | **Lines:** 916 | **Updated:** 2026-03-12

Fully executed Phase 2.5 plan: all 11 tasks done (types rewritten, registry restructured, legacy files deleted, consumers updated, tests updated). Valuable as audit trail. Correctly archived.

#### docs/plans/archive/2026-03-12-phase-3-evidence-pipeline.md

**Category:** implemented | **Lines:** 260 | **Updated:** 2026-03-12

Phase 3 design spec: 4 evidence pipeline problems with exact code changes. Moved from `docs/scratchpadprompts/`. Phase 3 is complete. Retains archival value as a record of the canonicalization gap problem and "avoid" status fix rationale. No longer drives active work.

#### docs/plans/archive/food-system-legacy-assessment.md

**Category:** archived | **Lines:** 447 | **Updated:** 2026-03-12

Original pre-Phase-2.5 deep assessment with verification audit appended. The active version (`docs/plans/food-system-legacy-assessment.md`) is the condensed current-state successor. This copy is historical context only.

#### docs/plans/archive/food-system-rebuild.md

**Category:** archived | **Lines:** 260 | **Updated:** 2026-03-12

Earlier working version of the rebuild manifest, superseded by `docs/plans/food-system-rebuild.md`. Correctly archived.

#### docs/plans/archive/transit-map-and-reward-model.md

**Category:** archived | **Lines:** 334 | **Updated:** 2026-03-12

Earlier transit map design doc archived after a verification audit found multiple issues. The current version is the corrected successor.

---

### docs/policies/

#### docs/policies/input-safety-and-xss.md

**Category:** reference | **Lines:** 74 | **Updated:** 2026-02-25

XSS prevention policy: sanitize on write via `inputSafety.ts`, keep rendering text-only, run `bun run audit:ui-safety`. Content remains accurate and actionable. Follow-up items (field-specific max lengths, full Convex write-path coverage) are still open and untracked.

---

### docs/product/

**Note:** All seven `docs/product/` files are untracked in git. Changes to them are invisible to version control.

#### docs/product/README.md

**Category:** active-guide | **Lines:** 62 | **Updated:** untracked

Navigation index for the product docs folder. Points to launch criteria, backlog, risk register, and ADRs. The ADR links reference a separate ADR tree (`docs/product/adr/`) from the committed `docs/adrs/` directory, which creates a duplication concern.

#### docs/product/launch-criteria.md

**Category:** active-guide | **Lines:** 125 | **Updated:** 2026-03-03

The v1.0 "done" checklist. Most Must-Have items are marked Done. Stale relative to Phases 3-4 progress and the 2026-03-12 code review. Should be consulted and updated before merging to master.

#### docs/product/risk-register.md

**Category:** candidate-for-deletion | **Lines:** 143 | **Updated:** 2026-02-28

Contains factually wrong architecture descriptions: R-04 describes local-first/IndexedDB as primary data store, contradicting ADR-0001. Has not been updated since the cloud-only migration. Either update thoroughly or delete.

#### docs/product/scope-control.md

**Category:** reference | **Lines:** 47 | **Updated:** 2026-02-28

Deferred items and rejected options. Broadly still accurate. FEAT-08 deferral reason ("Phase 3+ remediation") may need updating since Phase 3 is complete.

#### docs/product/adr/ (8 files)

**Warning:** None of these files are tracked in git. Of the 8 ADRs, only 2 have accepted decisions. 5 remain "Pending" and undecided.

- **000-template.md** — Blank ADR scaffold (reference)
- **001-coaching-heuristic-test-coverage.md** — Pending, never decided (candidate-for-deletion)
- **002-coaching-file-boundary.md** — Pending, never decided (candidate-for-deletion)
- **003-browser-api-key-strategy.md** — Pending but effectively decided by ADR-0001 (implemented)
- **004-ai-prompt-versioning.md** — Pending, relates to ship blocker #80 (candidate-for-deletion)
- **005-correlation-date-range-scope.md** — Pending, UI enhancement not an architecture decision (candidate-for-deletion)
- **006-ai-settings-placement.md** — Pending, UX question not architecture (candidate-for-deletion)
- **007-ai-model-configuration.md** — Accepted: two-tier model config (implemented)

#### docs/product/backlog/

- **bugs.md** — 5 bugs tracked, does not include the 96 browser testing findings (active-plan)
- **features.md** — 9 features (FEAT-01 to 09) with priority and status (active-plan)
- **investigations.md** — Single item (INV-01) likely resolved or superseded (candidate-for-deletion)

---

### docs/prompts/

#### docs/prompts/architecture-rethink.md

**Category:** reference | **Lines:** 230 | **Updated:** 2026-03-09

Explores a chat-first conversational AI architecture vs the current structured JSON report approach. Relevant as a strategic options document for the post-v1 roadmap, but contains some now-outdated local-first assumptions.

#### docs/prompts/v1-system-prompt.md

**Category:** archived | **Lines:** 455 | **Updated:** 2026-03-02

Complete snapshot of the v1 Dr. Poo system prompt, explicitly marked as superseded by v2. Historical reference for understanding what changed between prompt versions.

#### docs/prompts/v2-system-prompt.md

**Category:** active-guide | **Lines:** 453 | **Updated:** 2026-03-02

The canonical reference for the live Dr. Poo prompt. Documents the exact system prompt template, tone matrix (4-axis), all variable interpolation points, and the JSON output schema. Any AI-related work must treat this as ground truth.

#### docs/prompts/v3-strategy.md

**Category:** active-plan | **Lines:** 192 | **Updated:** 2026-03-09

Planned v3 prompt evolution identifying 5 v2 limitations with phased fixes: clinicalReasoning field, relaxed anti-repetition, proactive meal guidance, anchored time-window analysis. ~30% drafted. Blocked behind Phase 4 and ship blocker #80.

#### docs/prompts/phase-4-execution-prompt.md

**Category:** active-plan | **Lines:** 71 | **Updated:** 2026-03-13

Copy-paste session bootstrap for Phase 4 execution. Rules tightened ("delete carefully"), checklist expanded with archive/update steps. Lists documents to read, 8 tasks to execute, rules, and verification checklist. Operational artifact — should be archived or deleted after Phase 4 completion.

---

### docs/research/

#### docs/research/Bristol_Classification_Evidence.md

**Category:** reference | **Lines:** 158 | **Updated:** 2026-03-10

Evidence-based reference for Bristol Scale classification. The thresholds documented here (Bristol 3-5 = safe, 30% majority-rules, MIN_RESOLVED_TRIALS = 2, 12h transit window) are implemented in the codebase and still authoritative. The canonical evidence basis for the classification algorithm.

#### docs/research/Dr_Poo_Personalities.md

**Category:** reference | **Lines:** 1212 | **Updated:** 2026-03-05

Nine AI tone-of-voice personality variations exploring how Dr. Poo should speak across different emotional registers. Raw research output, not a distilled guide. Relevant for prompt engineering decisions.

#### docs/research/Habit_App_Anastomosis.md

**Category:** implemented | **Lines:** 210 | **Updated:** 2026-02-27

UX architecture recommendation that directly shaped the Track page quick-capture grid, Patterns page layout, and AI coach strip. The core layout recommendations are built. Not updated since late February; IndexedDB references are stale.

#### docs/research/Habit_App_React_IndexedDB.md

**Category:** candidate-for-deletion | **Lines:** 626 | **Updated:** 2026-02-27

Describes an offline-first model with IndexedDB mutation queue — exactly the pattern ADR-0001 rejected. Directly contradicts the current architecture. Should be deleted or annotated as abandoned.

#### docs/research/Habit_App_Retention.md

**Category:** reference | **Lines:** 166 | **Updated:** 2026-02-27

Behavioral science research on why minimalist habit trackers fail at the 3-month mark. Broadly relevant to UX decisions around streaks and progressive feature disclosure, but not currently driving active work.

#### docs/research/Reproductive_Health.md

**Category:** reference | **Lines:** 142 | **Updated:** 2026-03-05

Research on hormonal effects on GI motility post-surgery. Backs the reproductive health feature (feature-gated, shipped). Useful for AI prompt engineering and phase-specific recommendations.

#### docs/research/food-zone-phase.md

**Category:** active-guide | **Lines:** 452 | **Updated:** 2026-03-12

Defines the Zone 1/2/3 food reintroduction taxonomy underpinning the transit map and food registry. Directly relevant to Phase 4 work. The zone attribute model should be compared against the current registry implementation.

---

### docs/reviews/ai_prompt/

#### docs/reviews/ai_prompt/2026-02-25-dr-poo-prompt-and-data-review.md

**Category:** archived | **Lines:** 223 | **Updated:** 2026-03-02

Identified 7 data pipeline issues; several resolved inline, remainder superseded by the food system rebuild's completely different architectural path. Historically valuable but no longer drives decisions.

#### docs/reviews/ai_prompt/AI_SYSTEM_REVIEW.md

**Category:** archived | **Lines:** 225 | **Updated:** 2026-03-02

Inventoried all 7 LLM call types with bugs and a cost-impact table (60-70% call reduction target). Most proposed reworks (coaching, pane summaries, settings suggestions) have not been implemented or prioritised. Historical context for the AI system's earlier state.

#### docs/reviews/ai_prompt/PROMPT_ANALYSIS.md

**Category:** reference | **Lines:** 320 | **Updated:** 2026-03-02

Atomized all 154 instructions in the Dr. Poo system prompt, identified 5 concrete conflicts (brevity vs enthusiasm, baseline calculation contradictions). The schema refactor proposed has not been implemented. Retains diagnostic value for the next prompt revision cycle.

#### docs/reviews/ai_prompt/data-model/ (3 files)

All three files describe the pre-cloud-only local-first architecture (Zustand -> IndexedDB as primary, Convex as sync target). All are **archived**:

- **README.md** (245 lines) — Data model overview with stale data flow diagram
- **QUICK-REFERENCE.md** (386 lines) — Schema cheat-sheet with pre-cloud-only data flow
- **dr-poo-ai-analysis-data-model.md** (893 lines) — Comprehensive technical reference; expensive to maintain, large sections stale

---

### docs/scratchpadprompts/

#### docs/scratchpadprompts/food-registry-restructured.md

**Category:** reference | **Lines:** 176 | **Updated:** 2026-03-12

The user's signed-off food registry tables showing all 11 food lines across 4 groups with canonical names, zone assignments, and change annotations. This is the authoritative source of truth for the food registry structure implemented in Phase 2.5. Should not be modified without a deliberate registry revision decision.

#### docs/scratchpadprompts/transitmap.md

**Category:** active-guide | **Lines:** 1076 | **Updated:** 2026-03-13

Primary development log for the food system rebuild. Contains embedded design decisions not captured anywhere else. The Phase 4 execution prompt instructs agents to read this first in full. Must be appended to (never replaced) after each session. Will continue through Phase 5.

---

### docs/backlog/

Consolidated backlog directory (2026-03-13). Populated by triage of WIP.md and other scattered backlogs.

| File           | Summary                                             | Updated    | Category     |
| -------------- | --------------------------------------------------- | ---------- | ------------ |
| `DASHBOARD.md` | Backlog dashboard with counts and priority overview | 2026-03-13 | active-guide |
| `bugs.md`      | Consolidated bug backlog (127 lines)                | 2026-03-13 | active-plan  |
| `features.md`  | Consolidated feature backlog (86 lines)             | 2026-03-13 | active-plan  |
| `tech-debt.md` | Consolidated tech debt backlog (48 lines)           | 2026-03-13 | active-plan  |

### docs/working/

Working directory for in-progress documentation and reusable templates.

| File                                        | Summary                                         | Updated    | Category     |
| ------------------------------------------- | ----------------------------------------------- | ---------- | ------------ |
| `README.md`                                 | Working directory guide                         | 2026-03-13 | active-guide |
| `templates/implementation-plan-template.md` | Template for implementation plans               | 2026-03-13 | reference    |
| `templates/prd-template.md`                 | Template for product requirement docs           | 2026-03-13 | reference    |
| `templates/session-handover-template.md`    | Template for session handover notes             | 2026-03-13 | reference    |
| `templates/working-memory-template.md`      | Template for working memory during active tasks | 2026-03-13 | reference    |

---

## Candidates for Deletion (9 files)

These files are outdated, misleading, or redundant. Safe to delete or archive:

| File                                                       | Reason                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `convex/README.md`                                         | Generic Convex boilerplate, zero project content                 |
| `docs/plans/WIP.md`                                        | ~1076-line stale backlog, being triaged into `docs/backlog/`     |
| `docs/product/risk-register.md`                            | Contains factually wrong local-first architecture descriptions   |
| `docs/product/backlog/investigations.md`                   | Single item likely resolved or superseded                        |
| `docs/product/adr/001-coaching-heuristic-test-coverage.md` | Pending, never decided, landscape has shifted                    |
| `docs/product/adr/002-coaching-file-boundary.md`           | Pending, never decided                                           |
| `docs/product/adr/004-ai-prompt-versioning.md`             | Pending, better tracked as ship blocker #80                      |
| `docs/product/adr/005-correlation-date-range-scope.md`     | UI enhancement, not architecture decision                        |
| `docs/product/adr/006-ai-settings-placement.md`            | UX question, not architecture decision                           |
| `docs/research/Habit_App_React_IndexedDB.md`               | Describes IndexedDB offline-first pattern that ADR-0001 rejected |

## Docs Needing Updates (3 files)

| File                                               | What is stale                                                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/product/launch-criteria.md`                  | Does not reflect Phases 1-4 complete or 2026-03-14 food pipeline work                   |
| `docs/product/adr/003-browser-api-key-strategy.md` | Status "Pending" but decision was made and executed (ADR-0001)                          |
| `docs/product/backlog/bugs.md`                     | Does not include 96 browser testing findings or food pipeline UI bug fixes (2026-03-14) |

**Updated 2026-03-15:** `STRATEGIC_OVERVIEW.md` and `VISION.md` updated (E2E gap row corrected, Testing section updated, Phase 1-4 progress log added). `MD_INDEX.md` plans/ section updated to reflect current directory state.
