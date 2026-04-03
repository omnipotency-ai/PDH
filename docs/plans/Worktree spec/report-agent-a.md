# Agent A — Coral/Dark (localhost:3010)

**Branch:** `worktree-agent-a31ddf8f` | **Total code:** 2,360 lines across 9 files

## Architecture

Most modular of all 4. Uses `useReducer` (not Zustand), completely sidestepping the React 19 infinite loop bug. Separate component files for each view: `NutritionCard.tsx` (656-line orchestrator), `StagingModal.tsx`, `WaterModal.tsx`, `FavouritesView.tsx`, `MealSlotFilterView.tsx`, `CalorieDetailView.tsx`, plus mock data, store hook, and barrel export. Reuses existing `glass-card glass-card-food` CSS classes.

## Collapsed Card

- Header: "Nutrition" with chevron toggle, 3 icon buttons (heart, sliders, water droplet)
- SVG calorie ring showing 63% with green fill
- `1,141 / 1,800 kcal` with 3 macro pills (86g P, 163g C, 17g F)
- Search input bar with camera + mic placeholder icons, coral "Log Food" button
- Clean, compact — takes minimal vertical space

## Search

- Typing in the search box does NOT trigger live search results
- Search only fires when "Log Food" is clicked — text goes directly into the staging modal as a custom item
- Supports comma-separated block text: "200g chicken, 150g rice" → two staged items (confirmed in code)
- No autocomplete dropdown or live filtering
- **Verdict:** Search experience is weak — no intermediate step between typing and staging

## Favourites View

- Clicking heart icon expands card inline with "FAVOURITES" label
- Clean vertical list: food name on left, portion + calories on right, + button to add
- Items: Chicken Breast 150g 248 kcal, Scrambled Eggs 150g 224 kcal, White Rice 200g 260 kcal, Banana 120g 107 kcal, Oats (Porridge) 50g 190 kcal
- Clicking + adds directly to staging (accumulates — can add multiple items before opening staging modal)
- Heart icon highlighted coral when active
- **Verdict:** Clean and functional

## Filter / Meal Slot View

- Clicking sliders icon expands card with 4 tabs: Breakfast | Lunch | Dinner | Snack
- Active tab highlighted in teal
- Shows foods previously logged at that meal slot with relative timestamps ("about 6 hours ago", "about 2 hours ago")
- Each item has portion, calories, and + to add to staging
- Breakfast: Oats, Banana, Milk. Lunch: Chicken Breast, White Rice, Steamed Broccoli
- **Verdict:** Executed as meal-slot-based recent history. User found this poorly matched to their mental model — see overview report

## Water Modal

- Clicking water droplet icon opens a **centered modal** with dark overlay (best positioning of all 4)
- SVG progress ring in cyan showing current intake 450/1000 ml
- Below ring: − button, 200 ml amount display, + button (50ml increments)
- "Cancel" and "Log Water" (blue) buttons
- User reported the ring fills as you adjust amount before clicking Log — however I observed the ring staying at 450 even when amount was increased to 300. May be subtle animation visible only on physical device.
- X button in top-right to close
- Escape does NOT close the modal
- **Verdict:** Best modal positioning and UX of all 4. Centered = visible where you're actually looking

## Calorie Detail View

- Clicking the calorie ring opens inline expansion
- Stacked horizontal bar color-coded by meal slot (green=Breakfast, teal=Lunch, grey=Dinner, yellow=Snack)
- Legend with calorie counts: Breakfast 397, Lunch 625, Dinner 0, Snack 119
- `1,141 / 1,800 kcal` with `659 remaining` in green
- Grouped food entries below by meal slot, each with portion and calories
- **Verdict:** Most informative calorie breakdown — clear and scannable

## Staging Modal

- Opens as centered modal with dark overlay (same pattern as water)
- Header: "Log Food" with meal slot dropdown ("Snack ▾" auto-detected) and X close
- Listed rows: food name | − button | portion (g) | + button | calories | X to remove
- Macro summary at bottom: Protein, Carbs, Fat with total kcal
- "Clear" and coral "Log Food" button
- Accumulates items from different sources (search text + favourites + filter)
- **Aggregation:** YES — code shows `existing = stagingItems.find(i => i.foodId === action.item.foodId)` — adds portion rather than creating duplicate
- Staging persists across views (adding from favourites, then from filter, all accumulate)

## Keyboard / Escape

- Escape only registered on search input's `onKeyDown` — closes search view back to collapsed
- Does NOT close staging modal or water modal (no global handler)
- No global escape key support

## Theme

- Correctly renders dark mode with coral accents
- Uses existing CSS custom properties (`var(--section-food)`, glass-card classes)
- Light/dark toggle works correctly — only agent that handles both themes properly
