# Next Session Prompt 1: Documentation & Branch Setup

> **Created:** 2026-04-08
> **Purpose:** Update all project tracking docs to reflect the new Food Platform master plan, archive superseded plans, create implementation branch.
> **Estimated scope:** ~15 minutes of doc edits, no code changes.

## Context

A new master plan was created that merges three streams: the `new-plan-food.md` architecture vision, the `kind-scribbling-bird` bug fix plan, and the existing waves-0-6 UI plan. The result is an 8-wave, 31-task plan at:

**Master plan:** `docs/plans/purrfect-juggling-squid.md`

The plan introduces a 3-layer architecture:

1. `clinicalRegistry` (NEW Convex table) — global medical truth
2. `ingredientProfiles` (extended) — per-user product catalog with customPortions, productName, barcode
3. OpenFoodFacts UK API — external nutrition data

Four architectural gotchas were incorporated:

1. clinicalRegistry is a separate table (not in foodEmbeddings — vector wipe safety)
2. `productId` on logs table (historical calorie integrity)
3. Math written to final shape (customPortions-first lookup chain)
4. Server-side unified search (no client-side multi-query merge)

## What to read first

1. `docs/plans/purrfect-juggling-squid.md` — the approved master plan (31 tasks, 8 waves)
2. `docs/ROADMAP.md` — current initiative status
3. `docs/WORK-QUEUE.md` — current task table (old wave IDs)
4. `docs/WIP.md` — execution log
5. `docs/reference/data-shapes-snapshot.md` — current data shapes for context

## Tasks for this session

### 1. Create implementation branch

- read `docs/BRANCHING.md` to understand the branching strategy
- create a new branch for the food platform

```bash
git checkout -b `new branch name` main
```

### 2. Archive old wave JSON plans

Move the following to `docs/plans/archive/`:

- `docs/plans/2026-04-06-food-page-and-meal-system-waves-0-1.json`
- `docs/plans/2026-04-06-food-page-and-meal-system-waves-2-3.json`
- `docs/plans/2026-04-06-food-page-and-meal-system-waves-4-6.json`

Do NOT archive:

- `docs/plans/2026-04-06-food-page-and-meal-system.md` — keep as PRD reference
- `docs/plans/new-plan-food.md` — keep as architecture vision reference

### 3. Copy master plan to docs/plans/

Rename `docs/plans/purrfect-juggling-squid.md` to `docs/plans/food-platform-master-plan.md` so it's clearly labelled.

### 4. Update `docs/ROADMAP.md`

Update the "Food Page, Meal System & Navigation Restructure" initiative:

- Status: change to `In Work Queue — plan superseded`
- Add note: `Superseded by Food Platform master plan (2026-04-08). Old wave JSONs archived.`
- Plan reference: update to `docs/plans/food-platform-master-plan.md`

Add a new initiative or update the existing one:

```markdown
### Food Platform & Navigation Restructure

> **Status:** In Work Queue — plan active
> **Plan:** `docs/plans/food-platform-master-plan.md`
> **Vision:** `docs/plans/new-plan-food.md`
> **Data shapes:** `docs/reference/data-shapes-snapshot.md`
> **Branch:** `branch name`

3-layer architecture (clinicalRegistry + ingredientProfiles + OpenFoodFacts API).
8 waves (W0-W7), 31 tasks. Merges bug fixes, data migration, nav restructure, Food page, product management.
Supersedes old waves-0-6 JSON plans (archived 2026-04-08).
```

Also update "Food Registry & Filter Overhaul" initiative — mark as `Superseded` by the Food Platform plan (its scope is absorbed).

### 5. Update `docs/WORK-QUEUE.md`

Replace the existing "Active: Food Page, Meal System & Navigation Restructure" section's task table with the new wave structure from the master plan. Use the same table format:

```
| Task   | Title                                               | Wave | Depends On     | Status  | Commit |
```

All 31 tasks from the master plan, new IDs (W0-T01 through W7-T02).

### 6. Update `docs/WIP.md`

Add a new entry at the top of the active section:

```markdown
### 2026-04-08 — Plan superseded: Food Platform master plan

Old wave JSONs (0-1, 2-3, 4-6) archived. New 8-wave plan with 31 tasks.
Key changes: clinicalRegistry table, ingredientProfiles product catalog, productId on logs,
server-side unified search, customPortions-first math. No code changes yet.
```

### 7. Commit

```
docs: adopt Food Platform master plan — archive old waves, update tracking docs

Supersedes the 22-task wave-0-6 plan with a 31-task, 8-wave plan that adds:
- clinicalRegistry table (global medical truth)
- ingredientProfiles product catalog (customPortions, productName, barcode)
- productId on logs (historical calorie integrity)
- Server-side unified search
- Bug fixes from kind-scribbling-bird absorbed into W1
```

## Verification

- All tracking docs reference the new plan
- Old wave JSONs are in archive/
- Branch `feat/food-platform` exists
- `docs/plans/food-platform-master-plan.md` exists in repo
- No code changes — only docs
