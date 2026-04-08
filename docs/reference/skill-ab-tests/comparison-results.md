# Skill A/B Test Results — 2026-04-08

Model: sonnet (all agents)

## Test 1: Implementer (FoodFilterView "last eaten" timestamps)

| Dimension                 | WITH Skill                                 | WITHOUT Skill                       |
| ------------------------- | ------------------------------------------ | ----------------------------------- |
| Files read                | 6 (skill mandated protocol)                | ~4                                  |
| Found existing utility    | Yes — `formatRelativeTime` in dateUtils.ts | No — wrote new inline helper        |
| Memo strategy             | Merged into existing log loop (1 pass)     | Separate useMemo (2nd pass)         |
| FoodRow changes           | None                                       | None                                |
| Duplicate code introduced | No                                         | Yes (reinvented formatRelativeTime) |
| Tool uses / duration      | 21 / 2.5min                                | 16 / 2min                           |

**Verdict: WITH skill wins.** The file-reading protocol caused the agent to discover the existing utility. The WITHOUT agent independently reached similar architecture but introduced duplicate code. The skill's value here is **codebase awareness** — knowing what already exists.

**Skill improvement opportunity:** The skill is 437 lines. Most of it is reference (food system, transit map, habits). The file-reading protocol is the highest-value section — consider making it more prominent or extracting a shorter "essential patterns" section for lighter tasks.

---

## Test 2: Code Reviewer (NutritionCard.tsx)

| Dimension               | WITH Skill                                                     | WITHOUT Skill                                      |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Total findings          | 10                                                             | 8                                                  |
| HIGH severity           | 3                                                              | 0                                                  |
| MODERATE                | 5                                                              | 2 (called "Medium")                                |
| LOW / NICE-TO-HAVE      | 2                                                              | 6                                                  |
| Stack-specific findings | Yes (Convex patterns, auth checks evaluated)                   | Partial                                            |
| Best unique finding     | F001: `lastRemovedItem` built but never wired — silent failure | Camera/mic icons imply unbuilt features (UX trust) |
| Shared findings         | ARIA violation, ref/closure concern, redundant else            | Same                                               |
| Severity calibration    | Consistent with defined scale                                  | Ad hoc (Medium/Low only)                           |
| Actionability           | High — specific file:line + fix suggestions                    | Moderate — descriptions but less specific fixes    |
| Tool uses / duration    | 11 / 1.8min                                                    | 10 / 1.6min                                        |

**Verdict: WITH skill wins on technical depth.** Found 3 HIGH issues the other missed, including a real wiring bug (F001). The severity scale from the agent definition produced more calibrated ratings. WITHOUT skill had a good UX insight (camera/mic icons) that the WITH agent missed — the skill's structured checklist may cause tunnel vision on code patterns at the expense of product-level observations.

**Skill improvement opportunity:** Add a "Product/UX" category to the review checklist. The WITHOUT agent's camera/mic observation is the kind of thing a structured reviewer should catch. Also consider adding "unused/partially-wired features" as a specific check (would have caught F001 even without the structured approach).

---

## Test 3: Test Writer (foodNormalize.ts)

| Dimension                        | WITH Skill                                            | WITHOUT Skill                                                                                                              |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Functions covered                | 4/4                                                   | 4/4                                                                                                                        |
| Found existing tests             | Yes — identified 22 existing tests + gaps             | Yes — looked at existing patterns                                                                                          |
| Test count                       | Not specified (structured by pipeline stage)          | ~120 across 20 describe blocks                                                                                             |
| Structure                        | By pipeline stage (normalization step)                | By pipeline stage (similar)                                                                                                |
| prefersSummaryCandidate coverage | Full (all 4 tiebreaker levels)                        | Full (including edge cases)                                                                                                |
| Real bugs found                  | Edge cases: word.length > 4 guard, updatedAt fallback | **2 real bugs:** "free range egg" → "range egg" (filler stripping too aggressive), "natural yogurt" synonym can never fire |
| Mocks used                       | Zero                                                  | Zero (no mention of mocking)                                                                                               |
| Tool uses / duration             | 10 / 4.4min                                           | 7 / 4.5min                                                                                                                 |

**Verdict: WITHOUT skill wins on bug-finding.** Both produced comprehensive tests with zero mocks and similar structure. But the WITHOUT agent found 2 real bugs in the normalization logic ("free" as a filler word eating "free range", synonym ordering issue). The WITH agent was more methodical about contract-testing ("grouping key consistency") but missed the higher-impact discoveries.

**Skill improvement opportunity:** The test-writer agent definition focuses heavily on methodology (no mocks, meaningful assertions, convex-test patterns) but doesn't push agents toward adversarial testing — "try to break the function." The WITHOUT agent naturally explored "what happens if a filler word is part of a food name?" which is adversarial thinking. Adding a "try to find inputs where the function does something surprising" directive would improve the skill.

---

## Overall Findings

### Skills help most with:

1. **Codebase awareness** — finding existing utilities, following established patterns
2. **Severity calibration** — consistent, actionable finding categorization
3. **Structural thoroughness** — reading more files, checking more patterns
4. **Pattern compliance** — TypeScript strictness, Tailwind conventions, data-slot attributes

### Skills help least with (or hurt):

1. **Creative/adversarial thinking** — the unguided agents found more surprising bugs
2. **Product-level observations** — structured checklists cause tunnel vision on code
3. **Efficiency** — skill-guided agents use more tool calls and time for similar outcomes

### Recommended Improvements

| Skill                  | Change                                                                                                                                               | Why                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| vite-react-implementer | Extract a "Quick Reference" section (< 50 lines) with just the essential patterns (file reading, TS strictness, no-any, data-slot) for smaller tasks | 437 lines is a lot for "add a timestamp"                                                              |
| code-reviewer          | Add "Product/UX" category + "partially-wired features" check                                                                                         | Missed UX trust issue and could have caught F001 more directly                                        |
| test-writer            | Add "adversarial testing" directive: "try inputs where the function might do something surprising"                                                   | WITHOUT agent found 2 real bugs by naturally exploring edge cases the WITH agent's methodology missed |
| All                    | Consider a "light" vs "full" mode — some tasks need the full skill, others just need the top 5 rules                                                 | Reduces context overhead for simple tasks                                                             |
