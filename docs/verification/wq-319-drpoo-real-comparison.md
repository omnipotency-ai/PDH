# WQ-319: Dr. Poo Quality Comparison -- Real Data

**Status:** IN PROGRESS -- collecting real reports over 1-2 days
**Created:** 2026-03-19
**Replaces:** `wq-319-drpoo-quality-comparison.md` (hypothetical scenarios, not usable for sign-off)

---

## Approach

The original comparison doc used fabricated hypothetical scenarios. This document tracks **actual Dr. Poo reports** from the user's real data to validate the new context format (WQ-311) against the old format.

## Data Files

### OLD Format (pre-WQ-311)

- **Request:** `docs/dr-poo-before.json` -- Day 15 post-reversal, Feb 28 2026
- **Response:** `docs/dr-poo-b4-response.json` -- Day 15 post-reversal, Feb 28 2026
- **Payload size:** 90,268 chars
- **Structure:** flat `daysPostOp`, `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `foodTrialDatabase` (all 50 trials), no deltas, no baseline comparison, no conversation recap

### NEW Format (post-WQ-311)

- **Request:** `docs/dr_poio_request.json` -- Day 34 post-reversal, Mar 19 2026, 11:00 AM
- **Response:** `docs/dr_poo_response.json` -- Day 34 post-reversal, Mar 19 2026
- **Payload size:** 19,839 chars (78% reduction)
- **Structure:** `patient` snapshot, `recentEvents` (variable window), `deltas`, `foodContext` (curated), `baselineComparison`, `previousWeekRecap`, `recentSuggestionHistory`

## Structural Comparison

| Aspect               | OLD                          | NEW                                                                                 |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Payload size         | 90,268 chars                 | 19,839 chars (**78% smaller**)                                                      |
| Patient context      | `daysPostOp: 15` (one field) | `patient` object: surgery type, meds, transit baseline, Bristol trend, trial counts |
| Food window          | 72h fixed                    | Variable by surgery type (48-96h)                                                   |
| Food trials sent     | All 50 with full detail      | 10 active + 10 safe names + 5 flags w/ reasoning                                    |
| Delta signals        | None                         | bristolChange, culprit exposure, habit streaks                                      |
| Baseline comparison  | Not present                  | Real deltas (fluid -86%, cigs -76%, etc.)                                           |
| Conversation recap   | Not present                  | Narrative summary with foods safe/flagged/carry-forward                             |
| Suggestion history   | Not present                  | Prior suggestions with repeat counts                                                |
| Conversation history | 17 prior messages            | 2 prior messages (more focused)                                                     |

## Response Quality Notes

### OLD Response (Day 15)

- Identifies milk as suspect with reasoning
- References trial counts from raw database: "9 clean trials"
- Suggests specific next food (mashed potato) with timing
- Generates 3 meal suggestions (despite no patient request -- old system prompt didn't gate this)
- No baseline/trend references (data wasn't available)

### NEW Response (Day 34)

- Identifies dairy-sugar cluster (yogurt + milk + jam) as suspect
- Uses curated food context: "6 exposures, neutral tendency"
- References real baselines: "fluids only 250 ml versus your usual 1793 ml"
- References weekly trends: "3.8 versus 5.8 last week"
- Picks up conversation continuity from recap
- Empty mealPlan (correctly follows the "don't generate unless asked" rule)
- Richer clinicalReasoning with modifier weighting and mechanism explanation

### Trade-offs Observed

- OLD gave raw trial counts (`totalTrials: 9, culpritCount: 1, safeCount: 8`) -- NEW replaces with `exposures` + `tendency` + `confidence`. Dr. Poo adapted fine.
- OLD sent 50 food trials -- NEW sends ~25 curated items. No visible quality loss.
- NEW has conversation recap and baseline deltas that OLD completely lacked -- significant quality gain.

## Pending: Additional Reports

User is collecting more real reports over 1-2 days to build a proper comparison baseline. This section will be updated with additional old/new report pairs.

### Reports to collect

- [ ] 1-2 more NEW format reports from real usage
- [ ] Compare response quality, consistency, and clinical accuracy
- [ ] Final sign-off after sufficient data points

---

## Preliminary Verdict

Based on the first real comparison, the new format produces **comparable or better quality** responses with **78% fewer tokens**. The pre-computed signals (deltas, trends, baselines, conversation recap) add context the old format never had. The curated food context doesn't appear to hurt clinical reasoning.

**Final verdict pending additional reports.**
