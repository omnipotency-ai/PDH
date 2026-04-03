# Next Session — Nutrition Card Implementation

## What to Do

Open in plan mode. Read the plan, then execute it wave by wave with parallel agents.

### Step 1: Read these files

- `docs/plans/nutrition-card-implementation-plan.json` — the full task breakdown (26 tasks, 6 waves)
- `.claude/plans/agile-tinkering-pony.md` — the plan summary with architecture decisions
- `memory/project_nutrition_card_decisions.md` — all 22 locked visual + behavioral decisions
- `memory/project_staging_matching_research.md` — parked staging/matching research notes
- `docs/plans/Worktree spec/user-annotations/` — 8 annotated screenshots (visual reference)

### Step 2: Execute Wave 0 (Research)

Launch 4 parallel agents (read-only, produce docs):

- W0-01: Audit Agent A vs real data model
- W0-02: Map food pipeline integration points
- W0-03: Audit fluid migration scope
- W0-04: Design portion data schema

### Step 3: Execute remaining waves

Each wave's tasks can run in parallel. Wait for dependencies before starting next wave.

- Wave 1: Foundation (schema, registry, data hooks)
- Wave 2: Core UI (6 components in parallel)
- Wave 3: Integration (wire to real pipeline)
- Wave 4: Migration (fluid → food for non-water drinks)
- Wave 5: Polish (dark mode, a11y, tests, edge cases)

### Step 4: Verify

After all waves:

1. `bun run typecheck` + `bun run build` + `bun run test`
2. Browser test on localhost:3005
3. Dark/light mode toggle
4. Log food, log water, test matching flow

## Key Constraints

- **No separate food system** — connect to existing `convex/foodParsing.ts` pipeline
- **Agent A is the base** — `.claude/worktrees/agent-a31ddf8f/`
- **Staging reconstructs rawInput** and sends through `useFoodParsing` hook
- **Water stays as type='fluid'** — only non-water drinks migrate to food
- **Clean Convex migration** — no backwards compat shims

## Worktree Branches (code reference)

- A: `.claude/worktrees/agent-a31ddf8f` — branch `worktree-agent-a31ddf8f`
- B: `.claude/worktrees/agent-aa467ec9` — branch `worktree-agent-aa467ec9`
- C: `.claude/worktrees/agent-a0b4b876` — branch `worktree-agent-a0b4b876`
- D: `.claude/worktrees/agent-a73daffd` — branch `worktree-agent-a73daffd`
- V4: `.claude/worktrees/agent-a1d74ee2` — branch `worktree-agent-a1d74ee2`
