## Staging Modal

- Best layout: C and B
- Must aggregate same food (B failed — showed Whole Milk 3 times)
- A's 50g increment on second add is wrong — should match standard portion (150g)
- Calorie data inconsistent across agents (Greek Yogurt: C=146, others=89)
- Coffee logging: A over-splits (coffee+milk+sugar), B logs "whole milk only", C just "coffee" — none correct
- Reduce to 0 should remove from staging (A and C do this correctly)
- D's staging only accessible via filter route (not direct) — bad UX

## Calorie Detail

- D's colours + A's layout + expanded from A/B/C
- Meal-time-grouped (07:00 Breakfast, 13:00 Lunch, etc.) with expandable sections
- Full macro cards (P/C/F) in distinct colours
- Per-food detail: portion, individual macros, calorie count

## Unknown Food Handling

- B best: "Logged food — resolving in background"
- D good: "Food will be matched by backend after logging"
- A weak: "Food logged successfully" (no context)
- C fail: no acknowledgment

## Water Modal (composite)

- A: centered positioning (middle of screen, not bottom)
- A: prefill animation on ring when adjusting amount
- B: icon inside the "Log Water" button, water progress bar on collapsed card
- C: ring design, plus/minus controls, button colours (teal/cyan)
- D: heading with droplet icon, "remaining" text under animation

## Search

- D: colour and layout (dark mode), but NOT dropdown arrow on cals line
- A: camera+mic icons, "log to meal" feature, search results display (MEALS+FOODS sections)
- A: letter-by-letter filtering (but fuzzy search too loose — tighten threshold)
- B: auto-detected meal allocation label
- B and C search views rejected entirely

## Favourites

- A's design wins (clean list, heart icons, portions+calories, + to add)

## From Round 1 V4 (port 3014)

- Natural unit portions: "1 slice", "2 tsp", "5 piece", "1 tbsp" — not just grams
- Need BOTH natural units AND grams displayed
- Full macro bar with different colours: kcal, protein, carbs, fat, fibre, sugar (6 values, not just P/C/F)
- The round 1 V4 chip-based food list shows all foods with starred favourites — useful reference

**How to apply:** Final implementation must use all 6 macro values (including fiber and sugar), display natural units alongside grams, use the composite water/search/staging decisions above.
