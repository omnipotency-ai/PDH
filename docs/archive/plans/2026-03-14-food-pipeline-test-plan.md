# Food Pipeline Test Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematic end-to-end test coverage for the entire food pipeline — every branch, every error path, every consumer. Plus one full integration test and Playwright UI tests.

**Architecture:** Convex tests (vitest) for server-side logic, shared unit tests for parsing, Playwright for UI paths. Tests ordered by pipeline stage so they can run sequentially or in parallel.

**Tech Stack:** Vitest, Playwright, Convex test helpers

---

## Pipeline Flow Map

```
USER INPUT
    │
    ▼
┌─────────────────────────────────────────────┐
│ FoodSection.submitFood()                     │
│ → useFoodParsing.handleLogFood()            │
│ → logs.add({ rawInput, items: [] })         │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ BRANCH A: New-style (rawInput + empty items)│
│ → schedules processLogInternal (delay 0)    │
├─────────────────────────────────────────────┤
│ BRANCH B: Legacy (items pre-filled)         │
│ → rebuildIngredientExposuresForFoodLog()    │
│ → creates exposures immediately             │
└────────────────┬────────────────────────────┘
                 │ (Branch A continues)
                 ▼
┌─────────────────────────────────────────────┐
│ processLogImpl                               │
│ 1. sanitiseFoodInput(rawInput)              │
│ 2. splitRawFoodItems → segments             │
│ 3. For each segment:                        │
│    a. parseLeadingQuantity                  │
│    b. canonicalizeKnownFoodName             │
│    ┌──────────┴──────────┐                  │
│    │ MATCH               │ NO MATCH         │
│    │ → canonicalName     │ → unresolved     │
│    │ → resolvedBy:       │ → no canonical   │
│    │   "registry"        │                  │
│    └──────────┬──────────┘                  │
│ 4. Writes items to log                      │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ schedulePostProcessing                       │
│                                              │
│ IF unresolved items exist:                  │
│   → schedule matchUnresolvedItems (delay 0) │
│                                              │
│ ALWAYS:                                      │
│   → schedule processEvidence (delay 6h)     │
└───────┬─────────────────┬───────────────────┘
        │                 │
        ▼                 │
┌───────────────────┐     │
│ matchUnresolved   │     │
│ Items (LLM)       │     │
│                   │     │
│ IF no API key:    │     │
│   → silent return │     │
│                   │     │
│ IF API call fails:│     │
│   → silent return │     │
│                   │     │
│ IF parse fails:   │     │
│   → silent return │     │
│                   │     │
│ FOR each result:  │     │
│  ┌────┴────┐      │     │
│  │MATCH    │NO    │     │
│  │→llm     │MATCH │     │
│  │resolved │→stay │     │
│  │         │unres.│     │
│  └────┬────┘      │     │
│       ▼           │     │
│ applyLlmResults   │     │
│ → updates log     │     │
│   items           │     │
└───────────────────┘     │
                          │
        ┌─────────────────┘
        ▼ (6 hours later)
┌─────────────────────────────────────────────┐
│ processEvidence                              │
│                                              │
│ 1. Idempotency: skip if exposures exist     │
│ 2. Expire unresolved → unknown_food         │
│ 3. Create ingredientExposures for resolved  │
└─────────────────────────────────────────────┘

EDIT PATH:
┌─────────────────────────────────────────────┐
│ RawInputEditModal.handleSave()              │
│ → logs.update({ rawInput, items: [] })      │
│ → clearIngredientExposuresForLog()          │
│ → schedule processLogInternal (delay 0)     │
│ → full reprocess (new 6h evidence window)   │
└─────────────────────────────────────────────┘

CONSUMERS:
┌──────────────────┬──────────────────────────┐
│ Today's Log      │ Reads log.data.items     │
│ Patterns table   │ Reads ingredientExposures│
│                  │ + foodTrialSummary       │
│ AI analysis      │ Reads logs directly      │
│ Weekly digest    │ Reads foodTrialSummary   │
└──────────────────┴──────────────────────────┘
```

---

## BLOCKER: LLM Pipeline Not Working

**`OPENAI_API_KEY` is not set in the Convex environment.** It is also commented out in `.env.local`. The LLM matching action silently returns on every invocation. All unresolved items expire to `unknown_food` after 6 hours.

**Must fix before running LLM-related tests:**

```bash
npx convex env set OPENAI_API_KEY <key>
```

---

## Test Suite Structure

```
convex/
  __tests__/
    foodPipeline.test.ts        ← Server-side pipeline tests (Tests 1-12)
    foodPipelineIntegration.test.ts ← Full integration test (Test 13)
shared/
  __tests__/
    foodParsing.test.ts         ← Already exists (42 tests) — parsing/splitting
e2e/
  food-pipeline.spec.ts        ← Playwright UI tests (Tests 14-19)
```

---

## Server-Side Tests (Convex + Vitest)

### Test 1: New-style log triggers processing

**Branch:** `logs.add` → new-style path (rawInput present, items empty)

```
GIVEN a food log with rawInput "toast, banana" and items: []
WHEN logs.add is called
THEN processLogInternal is scheduled (delay 0)
AND the log is created with rawInput preserved
AND items array starts empty
```

**Verify:** Log exists in DB, items is empty array, rawInput = "toast, banana"

---

### Test 2: Legacy log skips new processing

**Branch:** `logs.add` → legacy path (items pre-filled)

```
GIVEN a food log with items: [{ name: "toast", canonicalName: "toast" }] and no rawInput
WHEN logs.add is called
THEN processLogInternal is NOT scheduled
AND ingredientExposures are created immediately
```

---

### Test 3: Deterministic parsing — all items match registry

**Branch:** `processLogImpl` → all segments resolve via `canonicalizeKnownFoodName`

```
GIVEN rawInput "toast, banana, rice"
WHEN processLogImpl runs
THEN items = [
  { parsedName: "toast", canonicalName: "toast", resolvedBy: "registry" },
  { parsedName: "banana", canonicalName: "banana", resolvedBy: "registry" },
  { parsedName: "rice", canonicalName: "white_rice", resolvedBy: "registry" }
]
AND no LLM matching is scheduled (all resolved)
AND processEvidence IS scheduled (6h delay)
```

---

### Test 4: Deterministic parsing — quantity extraction

**Branch:** `parseLeadingQuantity` handles various formats

```
GIVEN rawInput "4 toast, 200g rice, two bananas, a bit of jam"
WHEN processLogImpl runs
THEN items have:
  - { parsedName: "toast", quantity: 4, unit: null }
  - { parsedName: "rice", quantity: 200, unit: "g" }
  - { parsedName: "bananas", quantity: 2, unit: null }
  - { parsedName: "jam", quantity: null, unit: null }
AND parsedName never includes the quantity prefix
```

---

### Test 5: Deterministic parsing — partial match triggers LLM

**Branch:** `processLogImpl` → some unresolved → `schedulePostProcessing` schedules LLM

```
GIVEN rawInput "toast, kelitos, banana"
WHEN processLogImpl runs
THEN "toast" and "banana" are resolved (registry)
AND "kelitos" is unresolved (no canonicalName)
AND matchUnresolvedItems IS scheduled with unresolvedSegments: ["kelitos"]
AND processEvidence IS scheduled (6h delay)
```

---

### Test 6: Deterministic parsing — no matches triggers LLM

**Branch:** `processLogImpl` → all unresolved

```
GIVEN rawInput "kelitos, biscoff, something weird"
WHEN processLogImpl runs
THEN all 3 items are unresolved
AND matchUnresolvedItems IS scheduled with all 3 segments
```

---

### Test 7: LLM matching — no API key (silent failure)

**Branch:** `matchUnresolvedItems` → `OPENAI_API_KEY` missing

```
GIVEN OPENAI_API_KEY is not set
AND unresolved items exist
WHEN matchUnresolvedItems runs
THEN console.error is logged
AND items remain unresolved (no changes to log)
AND no error is thrown (silent return)
```

---

### Test 8: LLM matching — successful match

**Branch:** `matchUnresolvedItems` → OpenAI returns valid match → `applyLlmResults`

```
GIVEN rawInput has unresolved "biscoff"
AND OpenAI returns { segment: "biscoff", foods: [{ parsedName: "biscoff", canonical: "sweet_biscuit" }] }
WHEN matchUnresolvedItems runs
THEN applyLlmResults is called
AND the item is updated: canonicalName: "sweet_biscuit", resolvedBy: "llm"
```

**Note:** This test requires mocking the OpenAI API call.

---

### Test 9: LLM matching — NOT_ON_LIST result

**Branch:** `matchUnresolvedItems` → OpenAI returns NOT_ON_LIST

```
GIVEN rawInput has unresolved "completely_made_up_food"
AND OpenAI returns { segment: "completely_made_up_food", foods: [{ canonical: "NOT_ON_LIST" }] }
WHEN matchUnresolvedItems runs
THEN item stays unresolved (no canonicalName)
AND item will be expired by processEvidence at 6h
```

---

### Test 10: LLM matching — hallucinated canonical (not in registry)

**Branch:** `processLlmResults` → canonical not in registry → fallback chain

```
GIVEN OpenAI returns canonical: "fantasy_food" (not in FOOD_REGISTRY)
WHEN processLlmResults validates
THEN it tries canonicalizeKnownFoodName("fantasy_food") as fallback
THEN it tries canonicalizeKnownFoodName(parsedName) as second fallback
IF both fail: item stays unresolved
```

---

### Test 11: Evidence — 6-hour window creates exposures

**Branch:** `processEvidence` → normal path

```
GIVEN a food log with 3 resolved items (canonicalName set)
AND 6 hours have passed
WHEN processEvidence runs
THEN 3 ingredientExposures are created
AND each has correct userId, logId, itemIndex, canonicalName, logTimestamp
```

---

### Test 12: Evidence — expires unresolved items

**Branch:** `processEvidence` → unresolved items get expired

```
GIVEN a food log with 2 resolved items and 1 unresolved item
AND 6 hours have passed
WHEN processEvidence runs
THEN the unresolved item gets canonicalName: "unknown_food", resolvedBy: "expired"
AND only 2 ingredientExposures are created (not 3)
AND unknown_food items do NOT generate exposures
```

---

### Test 12b: Evidence — idempotency guard

**Branch:** `processEvidence` → exposures already exist

```
GIVEN processEvidence has already run for this log (exposures exist)
WHEN processEvidence runs again
THEN it returns immediately
AND no duplicate exposures are created
```

---

### Test 12c: Edit triggers full reprocess

**Branch:** `logs.update` → rawInput path → clear + reschedule

```
GIVEN a food log that was already processed (has items and exposures)
WHEN logs.update is called with new rawInput and items: []
THEN existing ingredientExposures are cleared
AND processLogInternal is scheduled (delay 0)
AND the log's items are cleared (will be rebuilt by pipeline)
```

---

## Full Integration Test (Test 13)

### Test 13: Complete pipeline — input to evidence

```
Step 1: Create food log with rawInput "toast, banana, kelitos"
Step 2: processLogImpl runs
  → toast: resolved (registry)
  → banana: resolved (registry)
  → kelitos: unresolved
Step 3: matchUnresolvedItems runs (mock OpenAI)
  → kelitos matched to some canonical (or NOT_ON_LIST)
Step 4: Advance clock 6 hours
Step 5: processEvidence runs
  → ingredientExposures created for resolved items
  → any remaining unresolved items expired
Step 6: Verify final state:
  → Log has correct items with correct resolvedBy values
  → ingredientExposures exist for resolved items only
  → unknown_food items have no exposures
Step 7: Edit the log (change rawInput to "toast, banana, rice")
Step 8: Verify old exposures cleared, new pipeline triggered
Step 9: Advance clock 6 hours again
Step 10: Verify new exposures created with updated items
```

---

## Playwright UI Tests

### Test 14: Log food — happy path

```
GIVEN user is on Track page
WHEN user types "toast, banana" and presses Enter
THEN food log appears with processing indicator
THEN after processing, items show green resolution dots
AND display names show "toast" and "banana" (no quantities in name)
```

---

### Test 15: Log food with quantities

```
GIVEN user is on Track page
WHEN user types "4 toast, 2 tbsp guacamole" and presses Enter
THEN items display as "toast" and "guacamole" (not "4 toast", "2 tbsp guacamole")
AND quantities are shown separately
```

---

### Test 16: Unresolved item shows pending indicator

```
GIVEN user logs "kelitos" (not in registry, LLM disabled)
WHEN the log appears
THEN the item shows an amber pending indicator
AND toast notification appears: "1 food couldn't be matched"
```

---

### Test 17: Review toast opens queue modal

```
GIVEN unresolved food items exist
AND toast notification is visible
WHEN user clicks "Review" on toast
THEN FoodMatchingModal opens with queue of unresolved items
AND shows "Item 1 of N" counter
```

---

### Test 18: Manual matching via modal

```
GIVEN FoodMatchingModal is open for an unresolved item
WHEN user searches for "bread" in the registry dropdown
AND selects "bread" from results
AND clicks "Match"
THEN item updates to green resolved indicator
AND modal advances to next unresolved item (or closes if last)
```

---

### Test 19: Edit raw input triggers reprocess

```
GIVEN a food log with processed items
WHEN user opens the raw input edit modal
AND changes text from "toast" to "toast, rice"
AND saves
THEN log shows processing indicator
THEN items update to show "toast" and "rice" both resolved
```

---

## Test Execution Order

**Phase 1 — Shared parsing (already exists, 42 tests):**

```bash
bun run test shared/__tests__/foodParsing.test.ts
```

**Phase 2 — Server-side pipeline (Tests 1-12):**

```bash
bun run test convex/__tests__/foodPipeline.test.ts
```

**Phase 3 — Full integration (Test 13):**

```bash
bun run test convex/__tests__/foodPipelineIntegration.test.ts
```

**Phase 4 — Playwright UI (Tests 14-19):**

```bash
bunx playwright test e2e/food-pipeline.spec.ts
```

---

## CI (Future)

CI pipeline does not exist yet. When built, it should run:

1. `bun run typecheck`
2. `bun run lint`
3. `bun run test` (all vitest)
4. `bun run build`
5. Playwright tests (requires running dev server + Convex)

---

## Pre-test Checklist

- [ ] Set `OPENAI_API_KEY` in Convex environment: `npx convex env set OPENAI_API_KEY <key>`
- [ ] Verify `openai` package is in `convex/package.json` dependencies
- [ ] Confirm dev server and Convex backend are running
- [ ] Fix display name priority (Task 3 from UI fixes plan) before running Playwright tests
