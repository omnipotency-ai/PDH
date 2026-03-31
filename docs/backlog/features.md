# Feature Backlog (Consolidated)

**Last updated:** 2026-03-17
**Sources:** WIP.md (letter codes), product/backlog/features.md (FEAT-##), browser-testing (BT-##)

---

## Ship Blockers

| ID          | Title             | Source      | Status  | Description                                                                                    |
| ----------- | ----------------- | ----------- | ------- | ---------------------------------------------------------------------------------------------- |
| CI-PIPELINE | CI pipeline setup | Engineering | Planned | No CI currently. All tests run locally only. Need GitHub Actions or equivalent to gate merges. |

## High Priority

| ID                 | Title                                | Source                | Status  | Description                                                                                                                                              |
| ------------------ | ------------------------------------ | --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PILL-INPUT         | Pill/tag input for food entry        | User request          | Planned | High-priority UX request. Replace plain text input with pill/tag-style input for food items so each food item is visually distinct as it is typed/added. |
| REG-AUDIT          | Registry gap audit                   | Food pipeline testing | Planned | Standalone common words (chicken, pasta, bread, fish) are not matching registry canonicals. Audit and fill gaps.                                         |
| FOOD-REQUEST-ADMIN | Food request review surface          | Food pipeline testing | Planned | Persistence now exists via `foodRequests`, but there is still no admin/review UI to triage, approve, or reject submitted food requests.                  |
| FEAT-03            | Photo food parsing                   | FEAT-03               | Planned | Camera/upload to AI vision model for ingredient identification                                                                                           |
| FEAT-04 / WIP-P1   | Food autocomplete                    | FEAT-04, WIP-P1       | Partial | Autocomplete dropdown as user types + accept with tap/enter                                                                                              |
| FEAT-09            | Onboarding wizard                    | FEAT-09               | Planned | First-launch wizard for tone, model, health profile, preferences                                                                                         |
| WIP-B1             | Prompt versioning with threads       | WIP-B                 | Planned | v3 prompt experiment without context pollution; rollback restores v2 thread                                                                              |
| WIP-V1             | Remove GPT habit insight from drawer | WIP-V                 | Planned | Remove AI advice from habit drawer — make drawer deterministic                                                                                           |
| WIP-F1             | BM collapsed view redesign           | WIP-F1                | Planned | Compact multi-line summary: Bristol, volume, urgency, effort, note preview                                                                               |
| WIP-F2             | BM expanded view structure           | WIP-F2                | Planned | Pills + editor with constrained widths and explicit labels                                                                                               |
| WIP-F3             | Standardize grouped-row behavior     | WIP-F3                | Planned | All types follow Fluids pattern: header + entry rows                                                                                                     |
| BT-80              | OpenAI prompt management             | BT-80                 | Open    | Downgraded from Ship Blocker per ADR-0008. Hardcoded versioned prompts acceptable for v1.                                                                |

## Medium Priority

| ID                   | Title                                          | Source                 | Status  | Description                                                                                                                                                  |
| -------------------- | ---------------------------------------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FEAT-01              | Smart sleep apportionment                      | FEAT-01                | Planned | Split sleep hours across calendar days based on time logged                                                                                                  |
| FEAT-02 / WIP-G1     | Edit date on log entries                       | FEAT-02, WIP-G1        | Planned | Allow changing entry date (not just time) for backdating                                                                                                     |
| FEAT-06 / WIP-C1     | Conditional coaching toasts                    | FEAT-06, WIP-C1        | Planned | Ephemeral habit-stacking reminders, triggered by rules not schedule                                                                                          |
| WIP-K1               | Scheduled insights bar                         | WIP-K                  | Planned | 2x daily insights (14:00/20:00) comparing today vs all-time baselines                                                                                        |
| WIP-L1               | Aggregates computation layer                   | WIP-L                  | Planned | Precomputed baseline averages + 24h deltas for insights + UI                                                                                                 |
| WIP-M1               | Insight prompt redesign                        | WIP-M                  | Planned | Short, structured, comparative prompts anchored to deltas                                                                                                    |
| WIP-N1               | Quick capture hover state                      | WIP-N                  | Planned | Border disappears on hover for visual feedback                                                                                                               |
| WIP-W1               | Drawer section separation                      | WIP-W1                 | Planned | Clear visual split between data summary and settings                                                                                                         |
| WIP-W2               | Drawer responsive height                       | WIP-W2                 | Planned | Drawer adapts to content instead of filling space                                                                                                            |
| WIP-W3               | Compact settings layout                        | WIP-W3                 | Planned | 2-column grid for drawer settings                                                                                                                            |
| WIP-Y1               | Neutral 7-day summary                          | WIP-Y1                 | Planned | "Logged on 4 of 7 days" when habit has no target                                                                                                             |
| WIP-Z1               | Weight drawer presentation                     | WIP-Z1                 | Planned | Starting/current/target weight + changes since surgery                                                                                                       |
| WIP-Z2               | Weight trend chart                             | WIP-Z2                 | Planned | Real Recharts chart with axes, tooltip, target line                                                                                                          |
| WIP-AA1              | Auto-save in drawers                           | WIP-AA                 | Planned | Remove Save/Close buttons; auto-save on blur like rest of app                                                                                                |
| WIP-C2               | Food status phase split                        | WIP-C2                 | Planned | Phase 1 (explanatory context) vs Phase 2 (transit-driven status transitions)                                                                                 |
| REG-GROUPING-CLEANUP | Registry grouping cleanup                      | Food registry refactor | Planned | Finish the remaining `schema-food-zones` canonical-vs-alias decisions, especially soft cooked vegetables, fruit purees, and finer fresh-cheese distinctions. |
| WIP-AF1              | Trial countdown definition                     | WIP-AF                 | Planned | Define what counts as a trial, make countdown bar reflect reality                                                                                            |
| WIP-AL1              | Status thresholds canonical                    | WIP-AL                 | Planned | Lock down Safe/Testing/Watch/Avoid rules centrally                                                                                                           |
| WIP-AO1              | Simplify time range options                    | WIP-AO                 | Planned | Replace 7/14/30/custom with 14/90/custom                                                                                                                     |
| WIP-AR1              | Restore Next food + Menu                       | WIP-AR                 | Planned | Reinstate lost components inside Correlations & AI area                                                                                                      |
| AUD-F4               | Dietary modifier stripping in canonicalization | Audit                  | Planned | Add "lactose-free", "gluten-free", "sugar-free", "decaf", "low-fat" to FILLER_WORDS so deterministic path catches more inputs                                |

## Low Priority

| ID      | Title                           | Source  | Status  | Description                                                           |
| ------- | ------------------------------- | ------- | ------- | --------------------------------------------------------------------- |
| FEAT-07 | Gamification migration          | FEAT-07 | Backlog | Legacy gamification system migration — details TBD                    |
| FEAT-08 | Meal plan table                 | FEAT-08 | Planned | Dedicated Convex table for meal plans (currently in aiAnalyses blobs) |
| WIP-AB1 | Walking popover input           | WIP-AB1 | Planned | Compact popover instead of full drawer for duration entry             |
| WIP-AB2 | Sleep popover input             | WIP-AB2 | Planned | Same compact popover pattern for sleep                                |
| WIP-AB3 | Weigh-in popover input          | WIP-AB3 | Planned | Same compact popover pattern for weight                               |
| WIP-BB1 | Remove archive search (interim) | WIP-BB  | Planned | Hide search until proper implementation is ready                      |

## Future

| ID      | Title                               | Source      | Status   | Description                                                                                                   |
| ------- | ----------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| PHASE5  | Transit map UI + game layer rebuild | Engineering | Planned  | Phase 5: Transit map UI and replacement for deleted game layer. Scope TBD after Phase 4 stabilisation.        |
| WIP-O1  | Quick add chips for foods           | WIP-O       | Planned  | 1-tap chip list for user's top foods                                                                          |
| WIP-P2  | Companion chips (co-occurrence)     | WIP-P2      | Planned  | After selecting "Toast", show chips for frequently co-eaten foods                                             |
| WIP-P3  | Time-of-day suggestion bias         | WIP-P3      | Planned  | Rank suggestions by historical time-of-day patterns                                                           |
| WIP-AT1 | Menu Rolodex                        | WIP-AT      | Planned  | Meal-slot library with AI-curated options for 6 meal slots                                                    |
| WIP-AU1 | Calorie-aware menu adequacy         | WIP-AU      | Planned  | Energy-aware menu options without calorie tracking                                                            |
| WIP-AV1 | "Next foods to unlock"              | WIP-AV      | Planned  | Zone-gap-based food suggestions replacing generic advice                                                      |
| WIP-AK1 | Advanced filtering + smart views    | WIP-AK      | Future   | Multi-sort, compound filters for food database                                                                |
| WIP-BA1 | Archive search with context         | WIP-BA      | Future   | Search results with snippets, highlighting, section info                                                      |
| WIP-BF1 | AI personality full descriptions    | WIP-BF      | Planned  | Replace placeholder summaries with researched text (~27 personalities)                                        |
| WIP-BG1 | Food personalization redesign       | WIP-BG      | Future   | Custom classifications, excluded foods, cultural diet patterns                                                |
| WIP-BH1 | Tracking settings card audit        | WIP-BH      | Future   | Full UI review of tracking card layout and grouping                                                           |
| AUD-F1  | Registry CRUD + manual matching     | Audit       | Future   | Users create/edit/delete registry entries. Manual match UI for unmatched foods. Factory reset. Phase 5+ scope |
| WIP-BI1 | Pregnancy/reproduction support      | WIP-BI      | Descoped | Descoped for v1 per ADR-0008. Feature flag gating not yet implemented.                                        |
| BT-96   | Destructive progress gradient       | BT-96       | Future   | Green to yellow to red as cap consumed                                                                        |

## Done

| ID                   | Title                                | Source                | Status                                         |
| -------------------- | ------------------------------------ | --------------------- | ---------------------------------------------- |
| FEAT-05              | Habits system audit                  | FEAT-05               | Done                                           |
| BUG-10               | Food registry request persistence    | Food pipeline testing | Done — `foodRequests` mutation + schema landed |
| SERVER-FOOD-PIPELINE | Server-side food pipeline Tasks 1-11 | Food system           | Done — all 11 tasks complete as of 2026-03-14  |
