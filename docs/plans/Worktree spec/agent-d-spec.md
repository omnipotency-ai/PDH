# Caca Traca — Food Logging UI: Agent D Brief

## Assignment
- **Primary colour:** Orange
- **Mode:** Dark
- **Approach:** This brief provides clear structure with some design latitude. The functional requirements and screen architecture are defined. You have freedom in visual treatment, animation, component styling, and how you balance the layout — but follow the screen flow as specified.

---

## What You're Building

Rebuild the Nutrition/food logging card on the Caca Traca home screen. Caca Traca is a post-surgical food reintegration and calorie tracking app. The tech stack is React, TypeScript, Convex, shadcn/ui, Lucide icons, and Tailwind CSS.

You're working in a full clone of the production codebase in a git worktree. Replace the existing Nutrition card. Keep all other home screen sections (date strip, Health Tracking, Quick Capture) intact and visible.

Build this as a real, shippable feature at the quality level of apps like Cal AI or Yazio.

---

## Attached Reference Images

You have reference screenshots in three categories.

### Category 1: Mockups (images 01, 02, 03)

**01** — Three variations of a food logging page explored by the founder. The two dark variations (middle and right) are the preferred direction. Takeaways: staging area uses listed rows (not chips) with food name, `−`/`+` portion controls, calories per row, and X to remove. Both add and subtract on every staged item. Recipes and Foods in separate sections. Search bar with input icons. Calorie/macro summary bar at the bottom. **This was a full-page design — your brief uses a card + modal approach. Adapt the components into that architecture.**

**02** — Home screen with Health Tracking expanded. Shows the accordion pattern you must follow.

**03** — Home screen collapsed. Shows the compact stacking order.

**These are Excalidraw wireframes, not the current UI.** The visual design is yours — diverge significantly.

### Category 2: Competitor References (images 04–10)

Real app screenshots. Match or exceed this quality.

- **04** — Cal AI food search: clean input, filters, suggestion list with calories and `+` buttons
- **05/06** — Calorie tracking dark/light with progress rings and macros
- **07/09/10** — Food detail screens: macro cards, `+`/`−` portions, health scores
- **08** — Daily plan with meal slot cards, calorie rings, water intake

### Category 3: Full App Context (image 11)

**11** — Full app architecture showing Home, Track, Insights. You're building the Nutrition card on Home.

---

## Tech Constraints

- React + TypeScript, Convex (mocked data), shadcn/ui, Lucide React icons (no emojis), Tailwind CSS
- Mobile-first: 390px viewport
- Metric only: grams (g) and millilitres (ml). Zero imperial units.
- Dark mode. Orange is your primary accent.
- Use orange for the Nutrition section's icons, buttons, active states, and the Log Food button
- Water elements use blue accent (not orange)

---

## Home Screen Structure

Vertically scrollable page with expandable cards:
1. Header + Date strip (existing)
2. **Nutrition card** ← rebuild this
3. Health Tracking card (keep as-is)
4. Quick Capture card (keep as-is)

Accordion pattern: collapsed = compact, expanded = takes the space it needs, page scrolls.

---

## Progressive Disclosure — Three Layers

**Layer 1 (collapsed card):** Everything important at a glance. Calorie summary, input bar, action buttons. Nothing essential hidden behind a tap.

**Layer 2 (expanded card):** Normal task detail. Search results, recent foods, saved meals, portion controls. What a regular user needs.

**Layer 3 (modals):** Full detail. Staging area with editing, calorie breakdown, water logging. Explicit action required to reach this level.

---

## Screens

### 1. Nutrition Card — Collapsed

Three-row compact layout:

**Row 1 — Header:**
- Left: Lucide icon + "Nutrition"
- Right: Three icon buttons with tooltips:
  - Heart → Favourites (orange)
  - SlidersHorizontal/Filter → Meal slot filter (orange)
  - Droplets → Water (blue accent)

**Row 2 — Calorie tracker (minimal):**
- Today's intake vs 1,800 kcal goal — as a number, progress bar, or both
- Tappable → expands to detailed calorie breakdown (Screen 7)
- This is Layer 1 — must be visible without any interaction

**Row 3 — Input bar:**
- Left inside: Camera icon (greyed, v2 placeholder) + Mic icon (greyed, v2 placeholder)
- Centre: "Search or type a food..." placeholder
- Right: "Log Food" button (orange, prominent)

### 2. Nutrition Card — Expanded (Search Active)

Card expands in-place when input is tapped.

**Input bar:** Active/focused with cursor.

**Auto-complete results** below input:
- Recency-ordered (most recently logged first)
- Each row: food name | optional "Meal" badge (shadcn Badge) | portion + kcal (subtle) | `+` quick-add button
- Fuzzy matching on typos
- No error states for unmatched text — system accepts anything, backend resolves asynchronously
- Block text input supported (e.g., "200g chicken, 100g rice") — goes to staging on Log Food

**Below results / before typing:**

"Recent" — vertical list, 5–8 items, each with name, portion, kcal, `+` button. No chip rows.

"Meals" — vertical list of saved composites, each with name, kcal, `+` button.

**Meal slot auto-detection** — label near top ("Logging to: Lunch"), tappable dropdown to override:
- 04:00–08:59 → Breakfast
- 13:00–16:59 → Lunch  
- 20:00–22:59 → Dinner
- All other times → Snack

### 3. Staging Area Modal

Centred shadcn Dialog, dimmed background.

- Staged food items as listed rows (NOT chips):
  - Food name | `−` button | portion | `+` button | calories for current portion | X to remove
  - Both add AND subtract on every row
  - ±50g solids, ±50ml liquids, ±1 countable
  - Minus to zero = auto-remove
- Summary row at bottom: total calories (and optionally protein/carbs/fat in grams)
- Meal slot indicator (with override)
- Running calorie total
- "Log Food" — primary (orange), commits all
- "Clear" — secondary/ghost, resets staging
- Dismisses on log, brief toast/animation confirmation

### 4. Water Modal

Triggered by Droplets icon. Centred modal, dimmed.

- "Log Water" title
- Visual progress: intake vs 1,000ml goal (fill graphic, ring, bottle — your choice)
- Portion: 200ml default, `−`/`+` at ±50ml
- "Log Water" (blue accent) + "Cancel" (secondary)
- Syncs with Quick Capture water tile
- Pure water only — liquid foods in Nutrition section contribute to total fluid intake at the data layer

### 5. Favourites View (expanded card)

Heart icon active state. Vertical list of favourited foods/meals with name, portion, kcal, `+` quick-add. Empty state message if none saved.

### 6. Meal Slot Filter (expanded card)

Filter icon active state. Tabs (shadcn Tabs): Breakfast | Lunch | Dinner | Snacks. Below: vertical list of foods logged under selected slot, recency order, with name, portion, kcal, `+`, last-logged date.

### 7. Calorie Detail (expanded card)

Tapped from calorie summary. Meal slot breakdown with subtotals, visual chart (your choice), total vs goal, today's foods grouped by slot with edit/delete.

---

## Mock Data

Build a mocked Convex-style data layer:

**25+ foods:** White Rice, Brown Rice, Chicken Breast, Chicken Thigh, Salmon Fillet, Scrambled Eggs, Boiled Egg, Toast (White), Toast (Wholemeal), Avocado, Banana, Greek Yoghurt, Cream Cheese, Butter, Olive Oil, Mashed Potato, Steamed Broccoli, Steamed Carrots, Pasta (Penne), Minced Beef, Lentil Soup, Tomato Sauce, Cheddar Cheese, Oats (Porridge), Apple

Each: id, name, defaultPortionG or defaultPortionMl, caloriesPer100g, unit ("g"/"ml"), isLiquid.

**5 saved meals:** Coffee (250ml), Scrambled Eggs on Toast, Chicken & Rice, Porridge with Banana, Simple Pasta — each with ingredients and portions.

**8+ recent logs** with timestamps spanning today and yesterday.

**Water:** current intake, 1,000ml goal.

**Calorie goal:** 1,800 kcal/day.

---

## Design Notes

- Orange primary accent for Nutrition section throughout
- Blue for water only
- Dark mode — orange on dark backgrounds should feel warm and inviting, not harsh
- Lucide icons only, no emojis
- shadcn/ui for all UI components
- Vertical lists, not horizontal chip rows for food items
- No food photography
- Mobile-native, not desktop/dashboard feel
- Premium wellness aesthetic — functional and refined

---

## Exclusions

- No bottom navigation, onboarding, settings, TRAC tab, or FAB
- No composite meal scaling — meals log at fixed portions, individual item portions adjust
- No "add new food to registry" flow
- No imperial units, no emojis
- Don't invent features beyond this spec
