> **Ref:** `docs/INDEX.md`
> **Updated:** 2026-04-05
> **Version:** 1.1
> **History:**
>
> - v1.1 (2026-04-05) — updated for ROADMAP/WORK-QUEUE/WIP three-file system
> - v1.0 (2026-04-05) — initial doc index created

# PDH Documentation Index

Master reference for all project documentation. Organised by category and status.

---

## Vision & Strategy

| Document               | Status | Description                                                            |
| ---------------------- | ------ | ---------------------------------------------------------------------- |
| [VISION.md](VISION.md) | Active | Product vision, v1.0 scope, deferred features, key technical decisions |

---

## Active Plans

| Document                                                                                 | Status                   | Description                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| [meal-logging.md](plans/meal-logging.md)                                                 | Active (W4/W5 remaining) | PRD for NutritionCard — meal logging redesign                 |
| [nutrition-card-implementation-plan.json](plans/nutrition-card-implementation-plan.json) | Active                   | 26-task, 6-wave implementation plan for meal logging          |
| [next-session-prompt.md](plans/next-session-prompt.md)                                   | Active                   | Handoff doc for next dev session — W4-01, W4-03, W5 remaining |
| [data-integration-plan.md](plans/data-integration-plan.md)                               | Active                   | 4-wave integration plan — Wave 1 ~90%, Waves 2-4 not started  |
| [filter-prompt.md](plans/filter-prompt.md)                                               | Not started              | Multi-filter system design spec (Data Integration Wave 2)     |
| [2026-04-05-nutrition-card-fix.md](plans/2026-04-05-nutrition-card-fix.md)               | Complete                 | Spec deviation fix plan — 12 tasks, all committed             |

---

## Tracking (three-file system)

> **Flow:** ROADMAP (everything) -> WORK-QUEUE (planned) -> WIP (executing) -> Archive (done)

| Document                       | Purpose | Description                                                       |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| [ROADMAP.md](ROADMAP.md)       | What    | All initiatives + standalone bugs/debt. Master list of everything |
| [WORK-QUEUE.md](WORK-QUEUE.md) | How     | Only work with a plan attached, ready to execute                  |
| [WIP.md](WIP.md)               | Now     | Execution log — active work detail, completed work summaries      |

---

## Research

| Document                                                                                                                                                                                                     | Topic                                            | Pillar        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------- |
| [SYNTHESIS.md](research/SYNTHESIS.md)                                                                                                                                                                        | Index of all research against the vision         | All           |
| [data-model-mapping.md](research/data-model-mapping.md)                                                                                                                                                      | Mock vs real data model gaps (W0-01)             | Logging       |
| [pipeline-integration.md](research/pipeline-integration.md)                                                                                                                                                  | Food pipeline Option B spec (W0-02)              | Logging       |
| [fluid-migration.md](research/fluid-migration.md)                                                                                                                                                            | Fluid-to-liquid migration plan (W0-03)           | Logging       |
| [portion-schema-design.md](research/portion-schema-design.md)                                                                                                                                                | Portion data schema design (W0-04)               | Logging       |
| [Food_MAtching.md](research/Food_MAtching.md)                                                                                                                                                                | Food text matching strategies                    | Correlation   |
| [research-food-filter-patterns.md](research/research-food-filter-patterns.md)                                                                                                                                | Cross-app UX research for filter bar             | Correlation   |
| [food-zone-phase.md](research/food-zone-phase.md)                                                                                                                                                            | Food zone/phase classification system            | Correlation   |
| [schema-food-zones.md](research/schema-food-zones.md)                                                                                                                                                        | Schema design for food zones                     | Correlation   |
| [Bristol_Classification_Evidence.md](research/Bristol_Classification_Evidence.md)                                                                                                                            | Bristol Stool Scale evidence base                | Bristol Scale |
| [2026-03-17-LLM-Cost-Analysis-Food-Matching.md](research/2026-03-17-LLM-Cost-Analysis-Food-Matching.md)                                                                                                      | LLM cost analysis for food matching              | AI Insights   |
| [2026-03-17-Clinical-Transit-Times-Post-Anastomosis.md](research/2026-03-17-Clinical-Transit-Times-Post-Anastomosis.md)                                                                                      | Clinical transit time data                       | Correlation   |
| [2026-03-18-data-architecture-audit.md](research/2026-03-18-data-architecture-audit.md)                                                                                                                      | Data architecture audit                          | Architecture  |
| [Habit_App_Anastomosis.md](research/Habit_App_Anastomosis.md)                                                                                                                                                | Anastomosis-specific habit tracking              | Logging       |
| [Habit_App_React_IndexedDB.md](research/Habit_App_React_IndexedDB.md)                                                                                                                                        | Early React + IndexedDB architecture             | Architecture  |
| [Habit_App_Retention.md](research/Habit_App_Retention.md)                                                                                                                                                    | Retention strategies for habit apps              | UX            |
| [deep-research-report-on-hiccups-post-anastomosis.md](research/deep-research-report-on-hiccups-post-anastomosis.md)                                                                                          | Hiccups post-anastomosis                         | Clinical      |
| [precision_morphometry_neuro_inclusive.md](research/precision_morphometry_neuro_inclusive.md)                                                                                                                | Neuro-inclusive precision morphometry            | Clinical      |
| [precision_morphometry_summary.md](research/precision_morphometry_summary.md)                                                                                                                                | Morphometry research summary                     | Clinical      |
| [Unpredictable Bowel Patterns...](research/Unpredictable%20Bowel%20Patterns%20After%20Ileostomy%20Colostomy%20Reversal%20with%20Multiple%20Resections%20%20Mechanisms%20and%20Stabilization%20Strategies.md) | Bowel pattern instability mechanisms             | Clinical      |
| [RESEARCH\_ PrecisionRecovery...](research/RESEARCH_%20PrecisionRecovery_EngineeringMulti-FactorDigitalPhenotypingforPost-SurgicalGutHealth..md)                                                             | Digital phenotyping for post-surgical gut health | Clinical      |
| [In 2019 I had my first colostomy...](research/In%202019%20I%20had%20my%20first%20colostomy%20where%20they%20cut%20ou.md)                                                                                    | User's personal surgical history                 | Context       |

---

## Reference

| Document                                                      | Description                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| [CLAUDE.md](../CLAUDE.md)                                     | Project-wide engineering requirements and operational guidelines |
| [src/components/Claude.md](../src/components/Claude.md)       | UI component conventions (Base UI, TypeScript patterns)          |
| [cross-tool-collaboration.md](ai/cross-tool-collaboration.md) | Claude Code + Codex collaboration protocol                       |

---

## Design

| Document                                          | Description           |
| ------------------------------------------------- | --------------------- |
| [DESIGN_DOCUMENTS.MD](design/DESIGN_DOCUMENTS.MD) | Design document index |

---

## Dr. Poo Prompts

| Document                                                                      | Description                    |
| ----------------------------------------------------------------------------- | ------------------------------ |
| [v1-system-prompt.md](dr-poo-prompts/v1-system-prompt.md)                     | Original Dr. Poo system prompt |
| [v2-system-prompt.md](dr-poo-prompts/v2-system-prompt.md)                     | Revised system prompt          |
| [v3-strategy.md](dr-poo-prompts/v3-strategy.md)                               | V3 prompt strategy             |
| [architecture-rethink.md](dr-poo-prompts/architecture-rethink.md)             | Prompt architecture redesign   |
| [2026-03-30-prompt-redesign.md](dr-poo-prompts/2026-03-30-prompt-redesign.md) | Latest prompt redesign         |

---

## Other

| Document                                                               | Description                 |
| ---------------------------------------------------------------------- | --------------------------- |
| [input-safety-and-xss.md](policies/input-safety-and-xss.md)            | Input safety and XSS policy |
| [2026-03-09-v1-test-run.md](browser-testing/2026-03-09-v1-test-run.md) | Browser testing notes       |

---

## Archive

| Document                                                                                            | Why archived                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [specification.md](plans/archive/specification.md)                                                  | Superseded by individual PRDs             |
| [food-registry-audit-checklist.md](plans/archive/food-registry-audit-checklist.md)                  | Reference template, not active            |
| [consolidated-review-full.md](plans/archive/Worktree%20spec/2026-04-04/consolidated-review-full.md) | Code review findings — 31/36 fixed        |
| [consolidated-review.md](plans/archive/Worktree%20spec/2026-04-04/consolidated-review.md)           | Code review findings — minor/nice-to-have |
