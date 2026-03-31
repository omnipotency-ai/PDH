# Bug Register (Consolidated)

**Last updated:** 2026-03-17
**Sources:** WIP.md (letter codes), browser-testing (BT-##), product/backlog/bugs.md (BUG-##)

> **Food system audit bugs** are tracked separately in
> [`docs/audits/Food-Adversarial-Audit-Phase-1-to-4.md`](../audits/Food-Adversarial-Audit-Phase-1-to-4.md).
> All critical/high/medium items from that audit are **closed**.
> 15 low-priority cleanup items remain open there.

---

## Critical (data correctness)

- **BT-91** — AI text stored as food
  Status: Open · Difficulty: Medium · Agent: Opus 4.6
  AI report prose polluting food database. Data corruption — needs data cleanup.

- **BT-92** — Bristol classification wrong
  Status: Open · Difficulty: Medium · Agent: Opus 4.6
  `classifyConsistency()` uses averages, not majority-rules with 30% threshold as decided.

## High

- **BT-20** — Food safety grid incorrect
  Status: Open · Difficulty: Medium · Agent: Opus 4.6
  Depends on Bayesian engine + AI verdicts; needs runtime verification.

- **BT-28** — DB status logic
  Status: Open · Difficulty: Medium · Agent: Opus 4.6
  Thresholds defined but classification pipeline needs runtime check.

- **BT-31** — DB trend lines missing
  Status: Open · Difficulty: Medium · Agent: Sonnet 4.6
  Needs runtime verification.

- **BT-86** — Food trial count merging
  Status: Open · Difficulty: Medium · Agent: Opus 4.6
  Depends on normalization pipeline + live data.

- **BT-87** — Building evidence threshold
  Status: Open · Difficulty: Medium · Agent: Sonnet 4.6
  MIN_RESOLVED_TRIALS=2 too low; 21+ trial foods stuck in "building".

## Medium

- **BUG-01** — Repro health inconsistent state — **Descoped per ADR-0008**
  No cross-validation between pregnancy/menstruation/sex fields. Feature flag gating not yet implemented.

- **BT-04** — BM time label position
  Time needs to move before notes.

- **BT-06** — Fluid section design
  User wants old design back (ml + drink + add).

- **BT-18** — BM count data wrong
  Needs runtime verification.

- **BT-21** — Next food logic
  Depends on food safety grid pipeline.

- **BT-45** — Toast notifications
  No coloured backgrounds, stacking, or prominent undo.

- **BT-49** — Units not applied to fluids
  FluidSection converts correctly; other surfaces may hardcode ml.

- **BT-64** — Food section redesign
  Remove "Food Badges" title, simplify layout.

- **BT-65** — Weight target save bug
  Typing "180" doesn't save — needs "180.0" or Enter/Tab.

- **BT-67** — TimeInput Enter-to-save
  Enter blurs but may not trigger save in all contexts.

- **BT-73** — Insights bar removal
  Remove heuristics insight below quick capture.

- **BT-74** — Desktop long-press
  Add 3-dot menu for desktop discoverability.

- **BT-75** — BM layout rework
  Time before notes, 8-col grid.

- **BT-76** — Conversation markdown hierarchy
  All text bold/large — no visual hierarchy.

- **BT-77** — Conversation card redesign
  Single chat-window with separate summary/suggestions/meals cards.

- **BT-78** — Meal card blog-style
  Time/slot where image would be, menu where snippet would be.

- **BT-79** — Next Food to Try + zones
  Show Dr. Poo suggestions AND zone-1 options.

- **BT-82 / E4** — Today log text overflow
  Long text pushes controls off screen. DUPLICATE of WIP E4.

- **BT-83** — Date header duplication
  Patterns repeats date in page + global header.

- **BT-85** — Safe foods confidence labels
  "moderate"/"strong"/"weak" labels undefined.

- **BUG-AMBER** — Amber dot not intuitive as click target
  Status: Open · Difficulty: Easy · Agent: Opus 4.6
  Unresolved food items show an amber dot indicator but users do not discover it is tappable/clickable. Needs affordance improvement (e.g. arrow, label, or button styling).

- **PR2-WAVE3-4** — Remaining PR #2 review catalogue — **Merged into audit-remediation.md**
  Waves 1 and 2 are complete. Remaining 43 medium and 32 low items consolidated into `docs/backlog/audit-remediation.md`.

- **WIP-X1** — Drawer overlay click-through
  Clicking outside drawer triggers underlying quick capture cards.

- **WIP-BD1** — Filter toggle system color
  Starred filter uses browser orange instead of app theme.

- **WIP-BE2** — Food DB filter clearing
  Requires Clear All + Apply; should be instant clear like Archive.

- **WIP-AG1** — Filter sheet double-open
  Sheet pops open, closes, opens again.

- **WIP-AH1** — Trial history not wired
  Row detail says "no trial history" but table shows counts.

## Low / Polish

- **BUG-02** — Repro health can't be cleared — **Descoped per ADR-0008**
- **BT-62** — Destructive alert size (h-6 w-6 → h-5 w-5) — Partial
- **BT-66** — BM pill text alignment (left-aligned in some pills)
- **BT-68** — Quick capture medium viewport (3-col breaks → needs 2-col)
- **BT-69** — Activity detail orange (system default orange highlight)
- **BT-70** — Celebration too weak (sound too short, confetti too minimal)
- **BT-71** — Boolean habit duplicate name ("Brush Teeth / Brush Teeth")
- **BT-72** — Alert badge position (should be top-right with hover X)
- **BT-81** — Fluid habit auto-styling (auto-set blue glass icon)
- **BT-84** — Hero label overlap (side labels overlap numbers)
- **BT-88** — Habit-digestion correlation (most inconclusive)
- **BT-89** — Dr Poo archive link dup
- **BT-90** — "Last tested" ambiguity (last eaten or last transit?)
- **WIP-E1** — Duplicate timestamp on expand
- **WIP-E2** — Cigarettes duplicate subrows
- **WIP-E3** — Sleep expand repeats label
- **WIP-E5** — Activity rows split label/time
- **WIP-J1** — Tea quick capture missing unit

## Deferred (design tasks)

- **BT-01** — Menu nav (no UI path to Menu page)
- **BT-60** — Track page layout (full redesign deferred)

## Untested (need browser verification)

- **Settings:** BT-46, BT-47, BT-51, BT-52, BT-53, BT-54, BT-55
- **AI system:** BT-35, BT-36, BT-37, BT-38, BT-42, BT-43, BT-61
- **Menu:** BT-22, BT-23, BT-24

---

## Resolved (audit trail)

### Verified Fixed

| ID     | Title                                                | Source                           |
| ------ | ---------------------------------------------------- | -------------------------------- |
| BT-02  | Food parsing async                                   | BT-02                            |
| BT-03  | Food time-first error                                | BT-03                            |
| BT-05  | BM time editable                                     | BT-05                            |
| BT-07  | Weight target highlight                              | BT-07                            |
| BT-13  | Habit log checkbox style                             | BT-13                            |
| BT-14  | Weigh-in log colour                                  | BT-14                            |
| BT-15  | Time picker UX                                       | BT-15                            |
| BT-27  | Food dedup normalization                             | BT-27                            |
| BT-39  | clinicalReasoning render                             | BT-39                            |
| BT-40  | Archive markdown                                     | BT-40                            |
| BT-41  | Meal ideas promoted                                  | BT-41                            |
| BT-44  | Observation window transit                           | BT-44                            |
| BT-48  | Custom food AI bypass                                | BT-48                            |
| BT-56  | Two habit-add systems                                | BT-56                            |
| BT-59  | Conversation markdown                                | BT-59                            |
| BT-94  | Optimistic message dup                               | BT-94                            |
| BT-95  | Destructive habit colours                            | BT-95                            |
| BUG-10 | Food registry request persistence                    | Food pipeline testing 2026-03-14 |
| BUG-03 | BM visit count wrong                                 | BUG-03                           |
| BUG-04 | Coffee/fluid unit mismatch                           | BUG-04                           |
| BUG-05 | AI coaching tips after nav                           | BUG-05                           |
| FP-01  | Food pipeline bug #1 (parse)                         | Food pipeline testing 2026-03-14 |
| FP-02  | Food pipeline bug #2                                 | Food pipeline testing 2026-03-14 |
| FP-03  | Food pipeline bug #3                                 | Food pipeline testing 2026-03-14 |
| FP-04  | Food pipeline bug #4                                 | Food pipeline testing 2026-03-14 |
| FP-05  | Food pipeline bug #5                                 | Food pipeline testing 2026-03-14 |
| FP-06  | Food pipeline bug #6                                 | Food pipeline testing 2026-03-14 |
| FP-07  | Food pipeline bug #7                                 | Food pipeline testing 2026-03-14 |
| FP-08  | Food pipeline bug #8                                 | Food pipeline testing 2026-03-14 |
| FP-09  | Food pipeline bug #9 (standalone size abbreviations) | Food pipeline testing 2026-03-14 |

### Partially Fixed

| ID    | Title               | What's left                               |
| ----- | ------------------- | ----------------------------------------- |
| BT-17 | Hero charts         | BM count accuracy unverified              |
| BT-25 | Correlations rename | Renamed but mostly inconclusive           |
| BT-30 | DB AI column        | AI verdict population depends on pipeline |
| BT-50 | Confetti            | Rendering quality needs runtime check     |

### Irrelevant (features deleted)

| ID    | Title                     | Notes                             |
| ----- | ------------------------- | --------------------------------- |
| BT-19 | Transit score labels      | Transit score tile removed        |
| BT-34 | Transit map wrong version | All TransitMap components deleted |
| BT-93 | Transit map wrong version | Duplicate of BT-34                |
