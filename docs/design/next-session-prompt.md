# Next Session — Meal Logging Component Decisions

## Context

We ran 4 parallel worktree agents (A-D) to build competing Nutrition card implementations. Both the user and I tested them extensively. Now we need to make final decisions for the combined implementation, separating **visual** picks from **behavioral/code** picks.

**Key principle from user:** "It might be that we keep the behavior from B, but the visual from A and C."

## What to Do

Walk through each component one at a time. For each:

1. Look at the user's annotated image (in `docs/plans/Worktree spec/user-annotations/`)
2. Compare visual preference (user's browser testing) with code/behavioral best (my analysis)
3. Make a final decision on both layers
4. Record the decision

## Components (22 items)

### Visual / UI

1. Collapsed card
2. Search view
3. Staging modal
4. Water modal
5. Calorie detail
6. Favourites
7. Filter (needs redesign — see `research-food-filter-patterns.md`)

### Behavioral / Code

8. Architecture (modular vs monolithic)
9. State management (useReducer vs useState)
10. Fuzzy search (Fuse.js vs custom, threshold)
11. Live search (as-you-type results)
12. Block text parsing
13. Staging aggregation
14. Staging persistence
15. Global escape
16. Dark mode
17. Modal positioning
18. Accessibility
19. Unknown food handling
20. Inline staging feedback
21. Natural units (from V4)
22. 6-value macros (from V4)

## Reference Files

- Agent reports: `docs/plans/Worktree spec/report-agent-{a,b,c,d}.md`
- Overview: `docs/plans/Worktree spec/report-overview.md`
- Filter research: `docs/plans/Worktree spec/research-food-filter-patterns.md`
- User annotations: `docs/plans/Worktree spec/user-annotations/` (images 12-19 with README)
- User visual picks: memory `feedback_round2_full_comparison.md`
- User filter/water feedback: memory `feedback_round2_water_filter.md`

## Worktree Branches (code reference)

- A (Coral/Dark): `.claude/worktrees/agent-a31ddf8f` — branch `worktree-agent-a31ddf8f`
- B (Yellow/Light): `.claude/worktrees/agent-aa467ec9` — branch `worktree-agent-aa467ec9`
- C (Blue/Light): `.claude/worktrees/agent-a0b4b876` — branch `worktree-agent-a0b4b876`
- D (Orange/Dark): `.claude/worktrees/agent-a73daffd` — branch `worktree-agent-a73daffd`
- Round 1 V4: `.claude/worktrees/agent-a1d74ee2` — branch `worktree-agent-a1d74ee2`
