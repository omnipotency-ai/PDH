# Nutrition Card — Fix All Deviations from Spec

> **Status:** COMPLETE (2026-04-05). All 12 tasks executed and committed on `feat/nutrition`.
>
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 31 behavioral, visual, and architectural deviations from the locked 22-decision spec in the NutritionCard feature.

**Architecture:** The collapsed card (calorie ring, search bar, log button, water bar) becomes a permanent fixed header that never disappears. All secondary content (search results, filters, favourites, calorie detail) renders BELOW the water bar. Modals (staging, water) center inside the nutrition card panel, not full-screen center. All increments become flat 50g/50ml. Liquid units always display as ml.

**Tech Stack:** React, TypeScript, Zustand-style useReducer, Fuse.js, Base UI Dialog, Convex, Vitest, Playwright

**Branch:** `feat/nutrition`

**Spec references (agents MUST read these before implementing):**

- Locked decisions: `/Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-PDH/memory/project_nutrition_card_decisions.md`
- Visual comparison feedback: `/Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-PDH/memory/feedback_round2_full_comparison.md`
- Water/filter feedback: `/Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-PDH/memory/feedback_round2_water_filter.md`
- Annotated screenshots: `docs/plans/Worktree spec/user-annotations/` (12.png–19.png)
- Wave 0 decisions: `/Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-PDH/memory/project_wave0_decisions.md`

**Verification commands (run after EVERY task):**

```bash
bun run typecheck && bun run build && bun run lint:fix && bun run test && bun run format
```

**CRITICAL RULES:**

1. Do NOT create new files unless absolutely necessary — edit existing ones.
2. Do NOT add comments, docstrings, or type annotations to code you didn't change.
3. Do NOT refactor surrounding code beyond what the task requires.
4. Run verification commands after every task. If they fail, fix before committing.
5. Commit each task separately to `feat/nutrition` with a descriptive message.
6. Use `bun run typecheck` and wait 5 seconds for the language server before investigating TS errors.
7. Read CLAUDE.md and `convex/_generated/ai/guidelines.md` for project conventions.

---

## Task 1: Architecture — Remove view switching, make collapsed card permanent

**Why:** Currently `NutritionCard.tsx` uses `state.view` to show mutually exclusive views (collapsed/search/calorieDetail/favourites/foodFilter). When you click search, the calorie ring and water bar disappear. The spec says the collapsed card is ALWAYS visible — search results, filters, favourites, and calorie detail all appear BELOW the water bar.

**Files to modify:**

- `src/components/track/nutrition/NutritionCard.tsx`
- `src/components/track/nutrition/useNutritionStore.ts`

**Files to read for context:**

- The two files above (read fully before making changes)
- The spec references listed at the top of this plan

**What to change:**

1. In `useNutritionStore.ts`:
   - Remove `"collapsed"` and `"search"` from `NutritionView` type. Keep `"favourites" | "foodFilter" | "calorieDetail"` as expandable panels that show BELOW the card. Add `"none"` as the default (nothing expanded).
   - In `SET_VIEW` action: if view is set to the current view, toggle to `"none"` (collapse).
   - In `RESET_AFTER_LOG`: set view to `"none"` instead of `"collapsed"`.
   - Remove `SET_SEARCH_QUERY` clearing the searchQuery when switching views (search stays persistent).

2. In `NutritionCard.tsx`:
   - The collapsed card (CalorieRing + search bar + Log Food button + WaterProgressRow) is ALWAYS rendered — not conditional on `state.view`.
   - When the search input gets text, show `SearchResultsList` directly BELOW the WaterProgressRow (inline, not a separate view).
   - When `state.view === "calorieDetail"`, render `CalorieDetailView` BELOW the water bar.
   - When `state.view === "favourites"`, render `FavouritesView` BELOW the water bar.
   - When `state.view === "foodFilter"`, render `FoodFilterView` BELOW the water bar.
   - Remove the `SearchView` component entirely — its logic merges into the always-visible card.
   - Remove `CollapsedView` component — its contents are always rendered directly.
   - Remove `handleSearchFocus` that dispatches `SET_VIEW: "search"`. Search is always inline.
   - On search input focus (when empty), immediately show the zero-state content (recent foods) below water bar.
   - The Escape handler should: if search has text, clear it. If a panel is open, close it (set view to "none").

**Acceptance criteria:**

- Calorie ring, search bar, Log Food button, and water progress bar are ALWAYS visible regardless of what panel is open
- Typing in search shows results below the water bar without hiding anything
- Clicking the calorie ring expands detail BELOW the water bar
- Clicking heart icon shows favourites BELOW the water bar
- Clicking filter icon shows filter tabs BELOW the water bar
- Escape clears search first, then closes panels
- All existing tests pass
- TypeScript compiles
- App renders correctly on localhost:3005

---

## Task 2: Fix staging increments, editable amounts, and liquid units

**Why:** The `+`/`-` buttons in the staging modal use `unitWeightG` (varies per food, often 10-36g) as the step. User wants flat 50g for solids, 50ml for liquids. Re-adding from search should add a full `defaultPortionG`. The amount display is a `<span>` — user needs to click on it and type a custom value. Liquid foods show "g" but must show "ml".

**Files to modify:**

- `src/components/track/nutrition/LogFoodModal.tsx`
- `src/components/track/nutrition/useNutritionStore.ts`

**Files to read for context:**

- `shared/foodPortionData.ts` (understand the data shape, which foods have `isLiquid` or type info)
- `shared/foodRegistryData.ts` (FoodRegistryEntry shape — check for `subcategory` to determine liquids)

**What to change:**

1. In `LogFoodModal.tsx`:
   - Change `DEFAULT_INCREMENT_G` from `10` to `50`.
   - Change `getStep()` to always return `50` — ignore `unitWeightG`. The step is flat 50g/50ml for all foods.
   - Change `canDecrement` from `item.portionG > step` to `item.portionG > 0`. This allows the user to click `-` one more time to reach 0, which triggers removal via the reducer's existing logic.
   - Make the amount display (`formatPortion` result) an editable input: replace the `<span>` with an `<input type="number">` that shows the current g/ml value. On blur or Enter, dispatch `onUpdateQuantity` with the typed value. Show "g" or "ml" suffix based on whether the food is a liquid.
   - In `formatPortion()`: if the food is a liquid (check via FOOD_PORTION_DATA or a new `isLiquid` flag on StagedItem), show "ml" instead of "g". Remove "cup" display logic entirely.

2. In `useNutritionStore.ts`:
   - Add `isLiquid: boolean` to the `StagedItem` interface.
   - In `createStagedItem()`: determine if the food is a liquid by checking the food registry entry's subcategory (hot_drink, juice, fizzy_drink, etc.) or by checking if the FOOD_PORTION_DATA entry has a liquid indicator. Set `isLiquid` accordingly.
   - In `ADD_TO_STAGING` aggregation: change the increment from `portionData.unitWeightG ?? portionData.defaultPortionG` to just `portionData.defaultPortionG`. Re-adding from search always adds a full default portion.
   - The `ADJUST_STAGING_PORTION` action already handles reduce-to-0 removal (lines 255-258) — no changes needed there.

**Acceptance criteria:**

- `+`/`-` buttons always change by 50 (g or ml)
- `-` button is enabled when portion > 0, and pressing it at 50 removes the item
- Clicking on the amount opens an editable field where you can type a custom number
- Liquid foods display "ml" suffix, solid foods display "g"
- No food ever shows "cup" as a unit
- Re-adding the same food from search adds a full default portion (e.g., rice: +180g, coke: +200ml)
- All tests pass, TypeScript compiles

---

## Task 3: Fix Water Modal

**Why:** Multiple deviations from spec: positioned full-screen center (should be inside card panel), ring shows projected total as one fill (should show 3 segments: consumed/to-add/remaining), increment is 200ml (should be 50ml), has redundant Cancel button, icon has 1 drop (should be 2), "Goal Reached" text is white (should match ring color).

**Files to modify:**

- `src/components/track/nutrition/WaterModal.tsx`
- `src/components/track/nutrition/CircularProgressRing.tsx`

**Files to read for context:**

- Annotated screenshots: `docs/plans/Worktree spec/user-annotations/15.png`
- Water feedback: the memory file `feedback_round2_water_filter.md`
- The current WaterModal.tsx and CircularProgressRing.tsx

**What to change:**

1. In `WaterModal.tsx`:
   - Change `STEP_ML` from `200` to `50`.
   - Change positioning: instead of `fixed top-1/2 left-1/2`, the modal should appear anchored/centered within the nutrition card panel. One approach: use a positioned container relative to the nutrition card rather than fixed viewport positioning. The exact implementation depends on how the card is structured after Task 1 — read the updated NutritionCard.tsx.
   - Remove the "Cancel" button. The X button in the top-right and Escape key are sufficient to close.
   - Change the `Droplet` icon to `Droplets` (2 drops) from lucide-react — import `Droplets` instead of `Droplet`.
   - "Goal Reached!" text: change color from `var(--text-muted)` to the `WATER_COLOR` constant so it matches the ring.
   - The number displayed in the ring center should be `currentIntakeMl` (what's already been consumed), NOT `projectedTotal`. The +/- selector shows the amount TO ADD.
   - Fix `remainingMl` — it should account for the projected amount: `Math.max(0, goalMl - currentIntakeMl - amount)` so the "remaining" text updates as the user adjusts the amount.

2. In `CircularProgressRing.tsx`:
   - Add support for a TWO-TONE ring: bright color segment for `consumed` and faded/lighter color segment for `toAdd`. The ring needs to show 3 visual segments:
     - Bright cyan arc: already consumed water
     - Faded/lighter cyan arc: amount about to be added (preview)
     - Dark grey: remaining to goal
   - The component may need new props: `consumed: number`, `toAdd: number`, `goal: number` (instead of just `value` and `goal`).
   - The faded cyan segment should animate/change size as the user presses +/-.

**Acceptance criteria:**

- Water modal appears anchored to/within the nutrition card, not full-screen center
- Ring shows 3 segments: consumed (bright cyan), to-add preview (faded cyan), remaining (grey)
- Center number shows current consumed amount, not projected total
- +/- changes by 50ml
- No Cancel button — just X and Escape
- Icon is 2 drops (Droplets)
- "Goal Reached!" text is cyan, not white
- Ring preview segment animates as user adjusts amount
- All tests pass, TypeScript compiles

---

## Task 4: Add "Logging to: Meal" auto-detect and search zero-state

**Why:** Decision #2 specifies B's auto-detected meal allocation ("Logging to: Breakfast"). Also, when clicking into the search field with no text, the zero-state should immediately show recent foods.

**Files to modify:**

- `src/components/track/nutrition/NutritionCard.tsx`

**Files to read for context:**

- `src/hooks/useNutritionData.ts` (for `recentFoods` data)
- `src/lib/nutritionUtils.ts` (for `getMealSlot`)
- The updated NutritionCard.tsx from Task 1

**What to change:**

1. Add a "Logging to: Breakfast" (or Lunch/Dinner/Snack based on time) label near the search bar. Use `state.activeMealSlot` which is already computed and stored. Show it as a small label like `<span className="text-xs text-[var(--text-muted)]">Logging to: {capitalize(activeMealSlot)}</span>`.

2. When the search input is focused and the query is empty, show the zero-state content below the water bar: a list of recent foods (from `recentFoods` prop, already available from `useNutritionData`). Use the same `FoodRow` component as the filter view. Add a small header like "Recent".

3. Add a `searchFocused` boolean to component state (local useState, not in the reducer). Set to true on focus, false on blur (with a small delay to allow click events on results).

**Acceptance criteria:**

- "Logging to: Breakfast/Lunch/Dinner/Snack" label shows near the search bar based on current time
- Clicking into empty search immediately shows recent foods below the water bar
- Typing replaces recent foods with search results
- Clearing search returns to recent foods
- All tests pass, TypeScript compiles

---

## Task 5: Add heart-to-favourite on search results and food rows

**Why:** There's no mechanism to favourite a food. FavouritesView says "Tap the heart icon on any food" but no food has a heart icon to tap.

**Files to modify:**

- `src/components/track/nutrition/FoodRow.tsx`
- `src/components/track/nutrition/NutritionCard.tsx` (SearchResultRow)
- `src/hooks/useProfile.ts` (check if toggleFavourite exists)

**Files to read for context:**

- `src/hooks/useProfile.ts` (understand `useFoodFavourites` — does it have a toggle mutation?)
- `convex/profile.ts` (check if there's a mutation to add/remove favourites)
- Annotated screenshot: `docs/plans/Worktree spec/user-annotations/17.png`

**What to change:**

1. In `FoodRow.tsx`: Add a heart toggle button. If the food is in favourites (pass `isFavourite` prop, already exists on FoodRow but may not be wired to a toggle), clicking the heart adds/removes from favourites. The heart should be filled orange when favourited, outline when not.

2. In `NutritionCard.tsx` (SearchResultRow): Add the same heart toggle to search result rows.

3. If `useProfile.ts` doesn't have a `toggleFavourite` function, create one that calls the appropriate Convex mutation. Check `convex/profile.ts` for existing mutations.

4. Wire the toggle through from NutritionCard → FoodRow → the Convex mutation.

**Acceptance criteria:**

- Every food row (in search results, filter tabs, favourites) has a heart icon
- Clicking the heart toggles favourite status
- Heart is filled/orange when favourited, outline when not
- Favourited foods appear in the FavouritesView
- All tests pass, TypeScript compiles

---

## Task 6: Remove Favourites tab from FoodFilterView

**Why:** The heart icon already provides a dedicated FavouritesView. Having a "Favourites" tab in the filter is redundant.

**Files to modify:**

- `src/components/track/nutrition/FoodFilterView.tsx`

**What to change:**

1. Remove `"favourites"` from the `FilterTab` type.
2. Remove the Favourites entry from the `TABS` array.
3. Remove `validFavourites` memo and its usage from `displayedItems`.
4. Remove the `favourites` tab case from the switch in `displayedItems`.
5. Remove `favourites` from `tabCounts`.
6. Remove `favourites` key from `EmptyTabState` messages.
7. Clean up unused `Heart` import if no longer used.

**Acceptance criteria:**

- Filter tabs show: Recent | Frequent | All (no Favourites)
- All tab functionality still works
- TypeScript compiles, tests pass

---

## Task 7: Add zone badges and `+` button to search results

**Why:** Decision W3-06: search results should show "canonical name, zone badge, portion info, + button". Currently results show name + portion + kcal with no zone badge and no explicit + button (whole row is clickable).

**Files to modify:**

- `src/components/track/nutrition/NutritionCard.tsx` (SearchResultRow component)

**Files to read for context:**

- `shared/foodRegistryData.ts` (FoodRegistryEntry has `zone` field — check what values exist)
- The existing SearchResultRow in NutritionCard.tsx

**What to change:**

1. In `SearchResultRow`: add a zone badge (small colored pill showing the food's zone from the registry entry, e.g., "Zone 1", "Zone 2"). Use zone-appropriate colors.

2. Add an explicit `+` button on the right side of each result row (like the FoodRow component uses). The whole row can still be clickable, but the `+` button makes the affordance explicit.

**Acceptance criteria:**

- Each search result shows: name, zone badge, portion, calories, `+` button
- Zone badge color reflects the food's zone
- `+` button adds to staging (same as clicking the row)
- All tests pass, TypeScript compiles

---

## Task 8: Fix per-item macros in CalorieDetailView

**Why:** Per-food items in the meal slot accordions show only 3 macros (P/C/F). Spec says all 5 (protein, carbs, fat, sugars, fiber).

**Files to modify:**

- `src/components/track/nutrition/CalorieDetailView.tsx`

**What to change:**

1. In the food item row inside `MealSlotAccordion` (around line 282), change the macro display from:

   ```
   {macros.portionG}g · {macros.protein}g P · {macros.carbs}g C · {macros.fat}g F
   ```

   To include all 5 macros:

   ```
   {macros.portionG}g · {macros.protein}g P · {macros.carbs}g C · {macros.fat}g F · {macros.sugars}g S · {macros.fiber}g Fi
   ```

2. Check that `getItemMacros()` in `nutritionUtils.ts` returns sugars and fiber. If not, add them.

**Acceptance criteria:**

- Each food item in calorie detail shows all 5 macro values
- All tests pass, TypeScript compiles

---

## Task 9: Add unknown food feedback

**Why:** Decision #19: when a food is logged that isn't in the registry, the user should see feedback like "Logged food — resolving in background" (B's style). Currently there's no feedback.

**Files to modify:**

- `src/components/track/nutrition/NutritionCard.tsx`

**Files to read for context:**

- `src/hooks/useFoodParsing.ts` (understand how unmatched foods are handled)
- Annotated screenshot: `docs/plans/Worktree spec/user-annotations/14.png`

**What to change:**

1. After a food is logged via `handleLogFood`, if any staged items don't have a match in the food registry (check if the food parsing pipeline would need to resolve them), show a toast: "Food logged — matching in background" using the existing `toast` import from sonner.

2. In the staging modal, add a visual indicator: green tick icon next to matched items, orange alert icon next to unmatched items. An item is "matched" if its `canonicalName` exists in `FOOD_PORTION_DATA`. Items typed via free text that aren't in the registry should show the orange alert.

**Acceptance criteria:**

- Toast shows when unmatched food is logged
- Staging modal shows green tick on matched items, orange alert on unmatched
- All tests pass, TypeScript compiles

---

## Task 10: Remove old FoodSection + FluidSection from Track page

**Why:** W3-05/W4-02: the old input sections should not render alongside the new NutritionCard.

**Files to modify:**

- `src/pages/Track.tsx`

**Files to read for context:**

- `src/pages/Track.tsx` (read fully to understand what's imported and rendered)
- `src/components/track/panels/index.ts`

**What to change:**

1. Remove the rendering of `FoodSection` and `FluidSection` components from the Track page JSX.
2. Keep the import/file alive (rollback safety) — just stop rendering them.
3. Ensure `QuickCapture` still has `handleLogFluid` for fluid habits (water, tea, coffee via habit buttons).
4. Ensure `FoodMatchingModal`, `useFoodLlmMatching`, `useUnresolvedFoodQueue` remain untouched.

**Acceptance criteria:**

- Track page shows NutritionCard but NOT FoodSection or FluidSection
- QuickCapture fluid habits still work (water button, etc.)
- FoodMatchingModal still works if triggered
- All tests pass, TypeScript compiles, app renders on localhost:3005

---

## Task 11: Visual polish pass

**Why:** Several small visual issues remain after the functional fixes.

**Files to modify:**

- `src/components/track/nutrition/WaterModal.tsx` (button alignment)
- `src/components/track/nutrition/NutritionCard.tsx` (any remaining visual issues)

**Files to read for context:**

- Annotated screenshots in `docs/plans/Worktree spec/user-annotations/`
- Current state of all modified files from previous tasks

**What to change:**

1. Water modal button layout: "Log Water" button should be properly sized and right-aligned, not stretching to edges. Review the annotated screenshots for the intended layout.

2. Verify dark mode works correctly — use CSS custom properties (glass-card system), no hardcoded colors.

3. Run the app on localhost:3005 via Claude-in-Chrome, take screenshots of:
   - Collapsed card
   - Search with results
   - Staging modal
   - Water modal
   - Calorie detail expanded
     Compare against the annotated screenshots and fix any remaining visual deviations.

**Acceptance criteria:**

- All components visually match the annotated screenshots
- Dark mode works correctly
- No hardcoded colors — all using CSS custom properties
- All tests pass, TypeScript compiles

---

## Task 12: Write E2E test for full nutrition flow

**Why:** W3-07 was never written. This is the critical integration test that proves the feature works end-to-end.

**Files to create:**

- `e2e/nutrition-full-flow.spec.ts`

**Files to read for context:**

- Existing `e2e/` tests for patterns and helpers
- The full NutritionCard component and its subcomponents

**What to test (one test, 15+ steps):**

1. Navigate to Track page (/)
2. Verify NutritionCard renders with calorie ring, search bar, water bar
3. Verify old FoodSection and FluidSection are NOT visible
4. Type "white rice" in search — verify results appear below water bar
5. Verify "Logging to: [meal]" label is visible
6. Click a result — verify staging badge updates on Log Food button
7. Click Log Food button — verify staging modal opens
8. Verify amount shows in g, increment/decrement by 50
9. Click `+` — verify amount increases by 50g
10. Click Log Food in modal — verify food logged, staging clears, calorie ring updates
11. Open water modal — verify ring shows 3 segments, increment is 50ml
12. Log water — verify water progress bar updates
13. Tap calorie ring — verify calorie detail expands BELOW the card (ring still visible)
14. Verify per-food macros show all 5 values
15. Search for a liquid food (e.g., "clear broth") — verify it shows "ml" not "g"

**Acceptance criteria:**

- E2E test passes: `bunx playwright test e2e/nutrition-full-flow.spec.ts`
- Test runs in under 60 seconds
- All other tests still pass
