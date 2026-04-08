## Base: Agent A's codebase (modular architecture, useReducer, 9 files)

All changes applied on top of A. Color theme swapped to D's orange.

## Visual Decisions

### #1 Collapsed Card

- Header: D (icon + "Nutrition" text, no dropdown arrow)
- Icons: Heart (orange/A), Filter (orange/A), Water (cyan/C)
- Calorie summary: D ("790 left · 1010 / 1800 kcal" + progress bar, tap to expand)
- Search input: A ("Search or type food")
- Log Food button: A recolored to orange
- Water progress: B (gradient bar showing drunk vs goal, below search)

### #2 Search View

- Layout: A (Meals first, then Foods in results)
- Icons: A (camera + mic in search bar)
- Meal auto-detect label: B ("Logging to: Breakfast")
- Color: D (orange palette)

### #3 Staging Modal (visual only — behavioral parked for research)

- Position: A (centered)
- Layout: A (header, food rows with −/+/cal/X)
- Macro totals: C style (5 macros: protein, carbs, fat, sugars, fibre)
- Buttons: C style in D's orange
- Match indicators: green tick (matched) / orange alert (needs input) — existing pipeline pattern

### #4 Water Modal

- Position: A (centered in panel)
- Prefill animation: A (ring fills as you adjust)
- Icon in button: B (droplet beside "Log Water")
- Ring design + plus/minus + button: C (cyan/teal)
- Heading + icon: D (droplet heading)
- Text under animation: D ("remaining" text)
- Escape to close: D

### #5 Calorie Detail (expanded)

- Color bar: C (segmented breakfast/lunch/dinner/snack)
- Per-slot calories: C style ("Breakfast 268 kcal")
- Macros: 5 columns (protein, carbs, fat, sugars, fibre)
- Accordions: B (one open at a time)
- Meal slot times: Breakfast 5am-9am, Lunch 1pm-4pm, Dinner 8pm-11pm, else Snack

### #6 Favourites

- A across the board (dedicated FavouritesView component)

### #7 Filter

- Tabs: Recent | Frequent | Favourites | All
- Zero state: recently logged foods for current meal slot
- No advanced filter panel (that's for Database/Patterns page)
- Meal slot = separate "log to" selector, not a filter

## Behavioral Decisions

- **#8 Architecture**: A's modular (separate component files)
- **#9 State management**: A's useReducer
- **#10 Fuzzy search**: Fuse.js, threshold 0.4, min 3 chars (user is dyslexic, needs transposition tolerance)
- **#11 Live search**: Yes (all agents had it)
- **#12 Block text parsing**: Use EXISTING `convex/foodParsing.ts` — do NOT rebuild
- **#13 Staging aggregation**: Same food = one row, summed quantity
- **#14 Staging persistence**: Survives view changes
- **#15 Global escape**: D's window-level keydown handler
- **#16 Dark mode**: A's correct theme handling (CSS custom properties)
- **#17 Modal positioning**: A's centered modals
- **#18 Accessibility**: D's aria-modal, role="dialog", focus management
- **#19 Unknown food**: Green tick / orange alert using existing FoodMatchingModal — parked for research
- **#20 Inline staging feedback**: B's "N items" count badge visible on main card
- **#21 Natural units**: V4's slice/piece/tsp alongside grams, +/- increments by 1 unit
- **#22 Macros**: 5 values (protein, carbs, fat, sugars, fibre) — kcal shown separately above

## Critical Implementation Notes

1. **No separate food system** — new UI connects to existing food parsing + matching pipeline
2. **Fluid migration (WQ-413)** — juice/tea/coffee/etc. become food items with liquid type flag. Water keeps its own modal. Fluid count (ml) still tracked for liquids.
3. **Convex migration** — clean schema changes, no backwards compatibility shims
4. **Registry needs** — each food entry needs: naturalUnit, unitWeightG, defaultPortionG (ties to WQ-400)
5. **Merge strategy** — consolidate changes in A's worktree, then merge to main preserving existing pipeline behaviors

**How to apply:** This is the complete spec for building the final Nutrition card. Visual decisions are final. Staging + matching behavioral integration needs research agents first (see `project_staging_matching_research.md`).
