# Caca Traca — Food Logging UI: Agent A Brief

## Assignment
- **Primary colour:** Coral
- **Mode:** Dark
- **Approach:** This is a highly prescriptive spec. Follow the layout, structure, and interaction details closely. Your creative freedom is in the visual execution — icon choices, spacing, animation, typography — not in rearranging the architecture.

---

## What You're Building

You are rebuilding the Nutrition/food logging section of the Caca Traca home screen. Caca Traca is a post-surgical food reintegration and calorie tracking app built with React, TypeScript, Convex, shadcn/ui, Lucide icons, and Tailwind CSS. You are working in a full clone of the production codebase in a git worktree.

**Your task:** Replace the existing Nutrition card on the home screen with a fully functional food logging experience. Keep all other sections of the home screen intact (date strip, Health Tracking, Quick Capture). Include them as-is for context — they should remain visible and functional.

This is a real, shippable feature — not a mockup, not a Dribbble concept. It must feel like a polished mobile food tracking app (think Cal AI, Yazio, Cronometer quality).

---

## Attached Reference Images

You have been given reference screenshots organised into three categories. Read the guidance for each category carefully.

### Category 1: Mockups (images 01, 02, 03)

**01_MOCKUP_food-logging-page-3-variations.png** — Three variations of the food logging page the founder has already explored. The middle (dark) and right (dark) versions show a direction he liked. Key things to take from this mockup:
- The staging area at the bottom with listed rows is the preferred pattern (not chips). Each food in the staging area should show as a listed row with: food name, portion, `−` and `+` buttons for adjusting, calorie count, and an X to remove. The `+` button is important — the original mockup only had subtract, but you must include both add AND subtract on each staged item.
- Recipes and Foods are separated into labelled sections
- The search bar with mic/camera/clipboard icons to the left
- The meal slot chips (Breakfast, Lunch, Dinner, Snacks) across the top
- The calorie + macro summary bar at the bottom of the staging area

**However:** This mockup represents ONE direction explored. It is a full-page food logging screen, whereas your brief asks for this functionality to live within an expandable card on the home screen with modals. Do not copy this layout literally. Use it to understand the functional components and the founder's taste, then adapt it into the card + modal architecture described in this spec.

**02_WIREFRAME_home-screen-expanded-bm-tracker.png** — The home screen with the Health Tracking (bowel movement) card expanded. This shows the accordion expansion pattern you must follow: when a card is active, it expands in-place and the page scrolls to accommodate. Study the spatial rhythm, card stacking, and how the expanded card takes vertical space.

**03_WIREFRAME_home-screen-collapsed.png** — The home screen with all cards collapsed. Shows the compact state and overall page structure (Header → Date Strip → Nutrition → Health Tracking → Quick Capture). Your collapsed Nutrition card must fit harmoniously into this layout.

**These wireframes are Excalidraw mockups, not the actual UI.** The app does not look like this yet. Use them to understand the interaction pattern and section structure. The visual design — colours, icons, typography, polish — is entirely yours to create. Diverge significantly from the wireframe aesthetic.

### Category 2: Competitor References (images 04–10)

These are screenshots from real food tracking apps. Use them as quality and UX benchmarks — your design should match or exceed this level of polish.

**04_REFERENCE_cal-ai-food-search.png** — Cal AI's food search screen. Note the clean search bar, tab filters (All, My meals, My foods, Saved scans), suggestion list with calories and portion info, and the `+` buttons. This is the benchmark for your search/input experience.

**05_REFERENCE_calorie-tracking-dark.png** — Calorie and macro tracking widget in dark mode. Shows a large calorie number with a progress ring and macro breakdowns (protein, carbs, fats) below. Reference for your calorie detail view (Screen 7) in dark mode.

**06_REFERENCE_calorie-tracking-light.png** — Same concept in light mode. Reference for light mode agents.

**07_REFERENCE_food-detail-with-macros.png** — Food detail screen showing calories, protein, carbs, fats in a card layout with a health score. Reference for how food detail and macro information can be presented cleanly.

**08_REFERENCE_daily-plan-meal-slots-calories.png** — A daily plan screen with meal slot cards (Breakfast, Mid lunch, Night dinner) each showing calories and macro rings, plus a water intake section at the bottom. Reference for how meal slots and calorie tracking can be visualised together.

**09_REFERENCE_food-detail-macro-cards.png** — Another food detail layout with macro values in individual cards (Calories, Protein, Carbs, Fat) with edit buttons. Clean, scannable.

**10_REFERENCE_food-detail-health-score.png** — Similar to 07, showing a food detail with portion selector (+/−), calorie count, macros, and health score. Note the "Fix Results" button — we don't need that, but the layout and hierarchy is good reference.

### Category 3: Full App Context (image 11)

**11_MOCKUP_full-app-architecture-wireframe.png** — The full app architecture showing all screens (Home, Track, Insights) and how they connect. This gives you context for where the Nutrition card sits in the overall app. You are only building the Nutrition card on the Home screen — but understanding the broader app helps you make design decisions that will be consistent with the whole.

---

## Tech Stack & Constraints

- **React + TypeScript** — existing codebase conventions
- **Convex** — mock the food registry data (see Mock Data section below)
- **shadcn/ui** — use for inputs, buttons, badges, modals, dialogs, dropdowns, and all form controls
- **Lucide React icons** — use exclusively for all icons. No emojis anywhere in the UI.
- **Tailwind CSS** — all styling
- **Mobile-first** — 390px viewport width, standard mobile proportions
- **Metric units only** — grams (g) and millilitres (ml). No cups, ounces, fluid ounces, or any imperial measurements.
- **Dark mode** — design for dark mode. Use your coral primary as the accent colour for the Nutrition section (icons, buttons, active states, badges). Ensure sufficient contrast.

---

## Home Screen Structure

The home screen is a vertically scrollable page with expandable section cards. The full order:

1. **Header** — App logo + name + subtitle (already exists)
2. **Date strip** — Horizontal date selector (already exists)
3. **Nutrition card** ← YOU ARE REBUILDING THIS
4. **Health Tracking card** — Bristol stool chart (already exists, keep as-is)
5. **Quick Capture card** — Habit/metric tiles grid (already exists, keep as-is)

Each card follows the accordion pattern:
- **Collapsed:** Section header + minimal controls, compact height
- **Expanded:** Full input controls, takes as much vertical space as needed
- The page scrolls to accommodate expansion — nothing is clipped

---

## Progressive Disclosure — Three Layers

This app uses a three-layer progressive disclosure model. Follow it precisely:

**Layer 1 — At a Glance (collapsed card):**
Everything important and frequently needed is visible without any interaction. The user should never have to tap to find something they need constantly. Don't hide important things behind a first tap.

**Layer 2 — More Detail (expanded card):**
Normal, sensible detail for the active task. Shows what a regular user needs to complete the action. Does not overwhelm with every possible option.

**Layer 3 — All the Detail (modals, advanced views):**
For power users, edge cases, advanced configuration. Accessed via explicit actions from Layer 2.

---

## Screen 1: Nutrition Card — Collapsed (Layer 1)

This is the default state on the home screen.

### Layout (top to bottom):

**Row 1 — Section header:**
- Left: Lucide icon + "Nutrition" label
- Right: Three icon buttons in a tight group:
  - Heart icon → Favourites (coral accent)
  - SlidersHorizontal or Filter icon → Meal slot filter (coral accent)
  - Droplets icon → Water logging (use a blue accent — this is the one exception to coral)
- Each button is icon-only with a tooltip on hover

**Row 2 — Calorie summary (minimal):**
- A single line showing today's calorie intake vs goal
- Format: "620 / 1,800 kcal" or a slim progress bar with the numbers
- Tapping this row expands to show the calorie detail view (see Screen 7)
- This must be visible at a glance — it's Layer 1 information

**Row 3 — Unified input bar:**
- Left icons inside the input: Camera icon (greyed out, subtle — this is a v2 placeholder, not functional) + Mic icon (greyed out, subtle — v2 placeholder)
- Centre: Text input with placeholder "Search or type a food..."
- Right: "Log Food" button in coral, prominent
- The input bar spans the full width of the card

**Total collapsed height:** Approximately 3 rows — header, calorie line, input bar. Keep it compact.

### Behaviour:
- Tapping the input bar → expand the card to Screen 2
- Tapping the water icon → open Water Modal (Screen 4)
- Tapping the heart icon → expand card to Favourites view (Screen 5)
- Tapping the filter icon → expand card to Meal Slot Filter view (Screen 6)
- Tapping the calorie summary → expand to Calorie Detail (Screen 7)
- Tapping "Log Food" with text already typed → send text to staging area (Screen 3)

---

## Screen 2: Nutrition Card — Expanded / Active Search (Layer 2)

The user has tapped the input bar. The card expands in-place (accordion pattern, same as Health Tracking expansion).

### Layout:

**Input bar:** Now active/focused with cursor. Remains at the top of the expanded area.

**Auto-complete results:** Appear below the input as the user types.
- Results are listed in **recency order** (most recently logged first), not alphabetical
- Each result row shows:
  - Food name (left-aligned)
  - A small "Meal" badge (using shadcn Badge) if it's a saved meal/composite
  - Default portion and calorie count (right-aligned, subtle text)
  - A `+` button (Lucide Plus icon) on the far right for quick-add
- The text input does fuzzy matching — typos like "avacdo" still surface "Avocado"
- The system accepts any text. There is no "no match" error state. The backend asynchronously resolves typed text against the food registry. The UI simply accepts the input and moves on.

**Below the search results (or visible before typing begins):**

**Recent Foods section:**
- Section label: "Recent" (subtle, small)
- A short vertical list of the last 5–8 logged food items
- Each item shows: food name, portion, calorie count, and a `+` quick-add button
- No horizontal scrolling chips. Use a clean vertical list.

**Saved Meals section:**
- Section label: "Meals" (subtle, small)
- A short vertical list of saved composite meals (e.g., "Coffee (250ml)", "Scrambled Eggs on Toast")
- Each item shows: meal name, calorie count, and a `+` quick-add button

**Auto-detected meal slot:**
- Near the top of the expanded area, show a subtle label: "Logging to: Lunch" (or whichever slot is detected)
- Tappable to change. Opens a small dropdown: Breakfast, Lunch, Dinner, Snack
- Time-of-day detection rules:
  - 04:00–08:59 → Breakfast
  - 09:00–12:59 → Snack (morning snack)
  - 13:00–16:59 → Lunch
  - 17:00–19:59 → Snack (afternoon snack)
  - 20:00–22:59 → Dinner
  - 23:00–03:59 → Snack (evening snack)

### Behaviour:
- Tapping a food item (not the `+`) → opens Food Detail / Staging Modal (Screen 3)
- Tapping `+` → quick-adds the food with its default portion to the staging area, brief confirmation animation
- Typing a block of text like "200g chicken, 150g rice, 100g broccoli" → tapping Log Food parses this into the staging area (Screen 3) as separate line items

---

## Screen 3: Staging Area & Food Detail Modal (Layer 2/3)

A **centred modal** (shadcn Dialog) with the background dimmed. This is where the meal is assembled before logging.

### Layout:

**Modal title:** "Log Food" or the specific food name if opened from a single item tap

**Meal slot indicator:** Shows the auto-detected slot (e.g., "Lunch") with ability to change

**Staging area — food list (use listed rows, NOT chips):**
- Each food item in the staging area is a full-width row showing:
  - Food name (left)
  - `−` button | portion amount (e.g., "200g") | `+` button — both add AND subtract must be present on every row
  - Calorie count for the current portion (right side of the row)
  - An X button (Lucide X icon) to remove the item from staging
  - Adjustment increments:
    - Solids: ±50g per tap
    - Liquids: ±50ml per tap
    - Countable items (toast, eggs): ±1 per tap
  - If portion is decreased to 0, the item is removed from staging
- Multiple foods can be in the staging area simultaneously
- At the bottom of the staging list: a summary row showing total calories (and optionally macros: protein, carbs, fat in grams)

**Calorie total:** Running total of all items in the staging area, displayed prominently

**Action buttons (bottom of modal):**
- "Log Food" — primary action button (coral). Commits all staged items to the log.
- "Clear" — secondary/ghost button. Clears the entire staging area.

### Behaviour:
- The staging area accumulates foods. The user can add from search, type a block of text, or tap `+` on quick-add items — all feed into this staging area.
- Logging dismisses the modal and returns to the home screen
- A brief success confirmation (subtle toast or animation) appears after logging
- The calorie summary on the collapsed card updates immediately

---

## Screen 4: Water Logging Modal

Triggered by tapping the Droplets icon in the Nutrition card header. A **centred modal** (shadcn Dialog) with background dimmed.

### Layout:

**Title:** "Log Water"

**Visual indicator:** A progress graphic showing current water intake vs daily goal. Choose one:
- A bottle or glass that fills up proportionally
- A progress ring
The graphic should clearly show the ratio without needing separate number displays.

**Current intake and goal:** Integrated into or adjacent to the visual (e.g., "450 / 1,000 ml")

**Portion control:**
- Default amount displayed: 200ml
- `−` and `+` buttons: ±50ml per tap
- So the user can quickly set 50, 100, 150, 200, 250, 300ml etc.

**Action buttons:**
- "Log Water" — primary button (blue accent, not coral — water uses blue)
- "Cancel" — secondary/ghost button

### Behaviour:
- Designed for 1–2 tap logging: adjust amount if needed, tap Log Water
- Modal dismisses after logging
- The water data must sync with the Quick Capture water tile (same underlying data)
- **Fluid intake note:** Water (ml) + liquid foods logged in the Nutrition section (coffee, tea, etc. in ml) = total fluid intake. The water modal tracks pure water only. The total fluid calculation happens at the data layer, not in this modal UI.

---

## Screen 5: Favourites View (Layer 2, within expanded Nutrition card)

Triggered by tapping the Heart icon. The card expands (or swaps content if already expanded).

### Layout:
- Heart icon is highlighted/active state
- Vertical list of favourited foods and meals
- Each item: food name, default portion, calorie count, `+` quick-add button
- Empty state if no favourites: "No favourites yet. Tap the heart on any food to save it here."

---

## Screen 6: Meal Slot Filter View (Layer 2, within expanded Nutrition card)

Triggered by tapping the Filter icon. The card expands (or swaps content if already expanded).

### Layout:
- Filter icon is highlighted/active state
- Horizontal tab row (shadcn Tabs or similar): Breakfast | Lunch | Dinner | Snacks
- Below: vertical list of foods previously logged under the selected meal slot, in recency order
- Each item: food name, portion, calories, `+` quick-add, subtle date indicator for when it was last logged
- Use case: "Show me all my breakfasts so I can quickly re-log one"

---

## Screen 7: Calorie Detail View (Layer 2, within expanded Nutrition card)

Triggered by tapping the calorie summary line on the collapsed card.

### Layout:
- Expanded view of today's calorie tracking
- Breakdown by meal slot: Breakfast X kcal, Lunch X kcal, Dinner X kcal, Snacks X kcal
- Visual representation (a simple bar chart, stacked bar, or segmented progress bar — your creative choice)
- Total: X / 1,800 kcal
- List of today's logged foods grouped by meal slot, each showing food name, portion, calories
- Each logged item has options to edit (opens staging modal) or delete (with confirmation)

---

## Mock Data

Create a realistic mocked Convex-style data layer with:

### Food Registry (at least 25 items):
```
White Rice, Brown Rice, Chicken Breast, Chicken Thigh, Salmon Fillet, Scrambled Eggs, Boiled Egg, Toast (White), Toast (Wholemeal), Avocado, Banana, Greek Yoghurt, Cream Cheese, Butter, Olive Oil, Mashed Potato, Steamed Broccoli, Steamed Carrots, Pasta (Penne), Minced Beef, Lentil Soup, Tomato Sauce, Cheddar Cheese, Oats (Porridge), Apple
```
Each item needs: id, name, defaultPortionG (or defaultPortionMl for liquids), caloriesPer100g, unit ("g" or "ml"), isLiquid boolean.

### Saved Meals (at least 5):
```
Coffee (250ml) — coffee 30ml, water 180ml, milk 40ml, sugar 5g
Scrambled Eggs on Toast — scrambled eggs 150g, toast (white) 2 pieces, butter 10g
Chicken & Rice — chicken breast 200g, white rice 200g, steamed broccoli 100g
Porridge with Banana — oats 50g, milk 200ml, banana 1
Simple Pasta — pasta (penne) 200g, tomato sauce 100g, cheddar cheese 30g
```

### Recent Logs (at least 8 entries with timestamps from today/yesterday)

### Water Log: Current intake today, daily goal of 1000ml

### User calorie goal: 1,800 kcal/day

---

## Visual Design Guidance

- **Coral is your primary accent** — use it for the Nutrition section's icons, buttons, active states, badges, and the Log Food button
- **Blue is reserved for water** — the water icon and Log Water button use blue
- **Dark mode** — deep, rich background. Ensure coral pops against dark surfaces.
- **No emojis** — use Lucide icons exclusively
- **shadcn/ui components** — use for all inputs, buttons, badges, dialogs, dropdowns, tabs, toasts
- **No horizontal scrolling chip rows** for food lists — use clean vertical lists
- **No food photography or decorative illustrations**
- **No imperial units anywhere**
- **Mobile-native feel** — this must feel like an app, not a web page
- Icons and the Log Food button colour should be coral (your assigned primary)
- Aim for a premium, wellness-oriented aesthetic. Not clinical, not playful — refined.

---

## What NOT to Include

- No bottom navigation bar (exists elsewhere)
- No onboarding or first-use flows
- No settings or profile screens
- No TRAC/review tab (separate feature)
- No FAB (floating action button) — the unified input bar replaces this concept
- No composite meal scaling (selecting a meal logs it at its fixed portions; only individual item portions are adjustable via ±)
- No "add new food to registry" flow — the system accepts any text and resolves asynchronously
- No cups, ounces, or imperial measurements
- No emojis
- Do not invent controls, features, or screens beyond what is specified here
