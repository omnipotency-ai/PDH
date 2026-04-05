# Caca Traca — Food Logging UI: Agent C Brief

## Assignment
- **Primary colour:** Blue
- **Mode:** Light
- **Approach:** This brief gives you clear functional structure with room for design interpretation. The screens and interactions are defined; the visual treatment, component styling, and micro-interactions are yours to craft.

---

## What You're Building

You are rebuilding the Nutrition/food logging section of the Caca Traca home screen — a post-surgical food reintegration and calorie tracking app built with React, TypeScript, Convex, shadcn/ui, Lucide icons, and Tailwind CSS.

You're working in a full clone of the production codebase in a git worktree. Replace the existing Nutrition card on the home screen. Keep all other sections (date strip, Health Tracking, Quick Capture) intact and visible as context.

This is a shippable feature for a real app. Design and build it to the quality standard of Cal AI, Yazio, or Cronometer.

---

## Attached Reference Images

You have reference screenshots in three categories.

### Category 1: Mockups (images 01, 02, 03)

**01_MOCKUP_food-logging-page-3-variations.png** — Three variations of a food logging page the founder explored. The dark variations (middle and right) show a direction he liked. Key things to note:
- The staging area uses listed rows, not chips — each row shows food name, portion with `−`/`+` controls, calories, and X to remove. Both add and subtract buttons must be present on every staged row.
- Recipes and Foods are in separate labelled sections
- Search bar with input method icons (mic, camera, clipboard)
- Meal slot chips (Breakfast/Lunch/Dinner/Snacks)
- Calorie + macro summary at the bottom of the staging area
- **This mockup is a full-page layout. Your brief calls for a card + modal architecture. Adapt the components, don't copy the page layout.**

**02_WIREFRAME_home-screen-expanded-bm-tracker.png** — Home screen with the Health Tracking card expanded. Demonstrates the accordion pattern: cards expand in-place, page scrolls.

**03_WIREFRAME_home-screen-collapsed.png** — Home screen fully collapsed. Shows the compact section stacking.

**These are Excalidraw wireframes, not the actual UI.** The visual design is entirely yours. Diverge from the wireframe aesthetic — create something significantly more polished.

### Category 2: Competitor References (images 04–10)

Screenshots from real food tracking apps. Your design should match or exceed this quality level.

- **04** — Cal AI food search: clean input, tab filters, food suggestion list with calories and `+` buttons
- **05/06** — Calorie tracking in dark and light mode — progress rings, macro breakdowns
- **07/09/10** — Food detail screens with macro cards, portion `+`/`−` selectors, health scores
- **08** — Daily plan with meal slot cards showing calories/macros and water intake

### Category 3: Full App Context (image 11)

**11_MOCKUP_full-app-architecture-wireframe.png** — Full app architecture showing Home, Track, and Insights screens. You're building the Nutrition card on Home — this gives you the broader context.

---

## Tech Constraints

- React + TypeScript, Convex (mocked data), shadcn/ui, Lucide React icons (no emojis), Tailwind CSS
- Mobile-first: 390px viewport
- Metric only: grams (g) and millilitres (ml). No imperial units anywhere.
- Light mode. Blue is your primary accent for the Nutrition section.
- **Exception:** Water logging also uses blue, so you'll need to visually differentiate the water button/modal from the general blue accent. Consider using a lighter/different shade or pairing with an icon treatment that distinguishes it.

---

## Home Screen Context

Vertically scrollable page with expandable section cards:
1. Header + Date strip (existing)
2. **Nutrition card** ← your focus
3. Health Tracking card (existing, keep as-is)
4. Quick Capture card (existing, keep as-is)

Cards follow an accordion pattern: compact when collapsed, expanding in-place when active, page scrolls to accommodate.

---

## Progressive Disclosure

Three layers — follow this intentionally:

**Layer 1 — At a Glance (collapsed):** The most important, frequently needed information. Visible without tapping anything. Don't tuck essential things behind the first tap.

**Layer 2 — More Detail (expanded):** What's needed to complete the current task. Sensible defaults, common options. Not everything — just what a regular user needs.

**Layer 3 — All the Detail (modals/advanced):** Power user territory. Full editing, detailed breakdowns, edge cases.

---

## Screen Specifications

### Screen 1: Nutrition Card — Collapsed

**Header row:**
- Left: Icon + "Nutrition" label
- Right: Three icon buttons (Lucide icons, icon-only with tooltips):
  - Heart → Favourites (blue accent)
  - Filter/SlidersHorizontal → Meal slot filter (blue accent)
  - Droplets → Water logging (differentiate from the general blue — lighter shade, or pair with a distinct visual treatment)

**Calorie summary row:**
- Single line: today's intake vs 1,800 kcal goal (e.g., "620 / 1,800 kcal")
- Could be a number, a slim progress bar, or a combination — your choice
- Tappable → expands to calorie detail (Screen 7)

**Input bar row:**
- Left inside input: Camera icon (greyed, v2 placeholder) + Mic icon (greyed, v2 placeholder)
- Centre: placeholder text "Search or type a food..."
- Right: "Log Food" button (blue accent, prominent)

Keep the collapsed card compact — three rows maximum.

### Screen 2: Nutrition Card — Expanded (Active Search)

Triggered by tapping the input bar. Card expands in-place.

**Active input** with cursor, same position.

**Auto-complete results** below input as user types:
- Recency order (most recently logged first)
- Each row: food name | "Meal" badge if composite (shadcn Badge) | portion + calories (subtle) | `+` button (Lucide Plus)
- Fuzzy matching — typos tolerated
- No "no match" error state. The system accepts any typed text; backend resolves asynchronously.
- Typing a block like "200g chicken, 100g rice" is valid input — goes to staging on Log Food tap

**Before typing / below results:**

"Recent" section — vertical list, last 5–8 logged items, each with name, portion, calories, `+` button. No horizontal chip scrolling.

"Meals" section — vertical list of saved composite meals, each with name, calories, `+` button.

**Auto-detected meal slot** — subtle label near top of expanded area ("Logging to: Lunch"), tappable dropdown to override.
- 04:00–08:59 → Breakfast
- 13:00–16:59 → Lunch
- 20:00–22:59 → Dinner
- All other times → Snack

### Screen 3: Staging Area Modal

Centred modal (shadcn Dialog), dimmed background. Where the meal is assembled before logging.

**Contents:**
- Modal title (e.g., "Log Food")
- Meal slot indicator with override option
- Staged food items as listed rows (NOT chips), each showing:
  - Food name (left)
  - `−` button | portion amount | `+` button — both add AND subtract on every row
  - Calories for current portion (right)
  - X button to remove (or minus to zero removes automatically)
  - Adjustment increments: ±50g solids, ±50ml liquids, ±1 countable
- Summary row at the bottom: total calories, and optionally protein/carbs/fat in grams
- Running calorie total for all staged items
- "Log Food" button — primary (blue), commits all staged items
- "Clear" button — secondary/ghost, clears staging

### Screen 4: Water Logging Modal

Triggered by Droplets icon. Centred modal, dimmed background.

**Contents:**
- "Log Water" title
- Visual progress indicator showing intake vs 1,000ml daily goal (progress ring, fill graphic, bottle — your choice, but it should clearly communicate the ratio)
- Portion control: 200ml default, `−` / `+` at ±50ml
- "Log Water" button (blue accent)
- "Cancel" button (secondary)
- Water data syncs with Quick Capture water tile (same underlying data)
- Fluid intake note: water + liquid foods from Nutrition section = total fluids. This modal tracks pure water. Total calculation is backend-side.

### Screen 5: Favourites View (within expanded card)

Triggered by Heart icon. Card expands or swaps content.
- Heart button shows active state
- Vertical list of favourited foods/meals: name, portion, calories, `+` quick-add
- Empty state: "No favourites yet. Tap the heart on any food to save it here."

### Screen 6: Meal Slot Filter View (within expanded card)

Triggered by Filter icon. Card expands or swaps content.
- Filter button shows active state
- Horizontal tabs (shadcn Tabs): Breakfast | Lunch | Dinner | Snacks
- Below: vertical list of foods logged under selected slot, recency order
- Each item: name, portion, calories, `+` quick-add, subtle last-logged date

### Screen 7: Calorie Detail View (within expanded card)

Triggered by tapping the calorie summary.
- Breakdown by meal slot with calorie subtotals
- Visual representation — your choice (segmented bar, small bar chart, pie, etc.)
- Total: X / 1,800 kcal
- List of today's logged foods grouped by meal slot
- Each item has edit (opens staging modal) and delete options

---

## Mock Data

Create a mocked data layer with:
- **25+ foods:** White Rice, Brown Rice, Chicken Breast, Chicken Thigh, Salmon Fillet, Scrambled Eggs, Boiled Egg, Toast (White), Toast (Wholemeal), Avocado, Banana, Greek Yoghurt, Cream Cheese, Butter, Olive Oil, Mashed Potato, Steamed Broccoli, Steamed Carrots, Pasta (Penne), Minced Beef, Lentil Soup, Tomato Sauce, Cheddar Cheese, Oats (Porridge), Apple
- Each with: id, name, defaultPortionG/Ml, caloriesPer100g, unit, isLiquid
- **5 saved meals** (e.g., Coffee 250ml, Scrambled Eggs on Toast, Chicken & Rice, Porridge with Banana, Simple Pasta) — each with ingredient list and portion
- **8+ recent logs** with timestamps
- **Water state:** current intake today, 1,000ml goal
- **Calorie goal:** 1,800 kcal/day

---

## Design Notes

- Blue primary accent for Nutrition icons, buttons, active states, Log Food button
- Differentiate the water icon/modal visually from the general blue (shade variation or distinct treatment)
- Light mode — consider warm or cool neutrals as your background palette
- No emojis — Lucide icons only
- shadcn/ui for all interactive components
- Vertical lists for food items, not horizontal chip rows
- No food photography or decorative illustrations
- Mobile-native feel, not a web dashboard
- Premium, wellness-oriented aesthetic

---

## Exclusions

- No bottom navigation, onboarding, settings, TRAC tab, or FAB
- No composite meal scaling — meals log at fixed portions, individual items adjust
- No "add new food to registry" flow
- No imperial units, no emojis
- Don't invent features beyond this spec
