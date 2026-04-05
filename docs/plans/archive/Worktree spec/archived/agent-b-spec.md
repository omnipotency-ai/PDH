# Caca Traca — Food Logging UI: Agent B Brief

## Assignment
- **Primary colour:** Yellow
- **Mode:** Light
- **Approach:** This brief describes the functionality and goals. You have significant creative freedom in how you arrange, present, and design the UI. Surprise me with your layout choices, visual hierarchy, and interaction design. The functional requirements are firm; the visual execution is yours to interpret.

---

## What You're Building

Rebuild the Nutrition/food logging section of the Caca Traca home screen. This is a post-surgical food reintegration and calorie tracking app. The user needs to log food quickly with minimal friction, track calories, and log water separately.

You're working in a full clone of the production codebase (React, TypeScript, Convex, shadcn/ui, Lucide icons, Tailwind CSS) in a git worktree. Replace the existing Nutrition card. Keep all other home screen sections intact and visible (date strip, Health Tracking, Quick Capture).

Build a real, shippable feature — not a concept piece.

---

## Attached Reference Images

You have reference screenshots in three categories.

### Category 1: Mockups (images 01, 02, 03)

**01** — Three variations of a food logging page already explored by the founder. The dark variations (middle and right) are the direction he liked. Key takeaways: the staging area uses listed rows (not chips) — each row has food name, portion with `−`/`+` controls, calories, and X to remove. Recipes and Foods are in separate sections. There's a search bar with input method icons, meal slot selectors, and a calorie/macro summary bar. **This is a full-page design; your brief asks for a card + modal approach. Don't copy the layout — adapt the functional components.**

**02** — Home screen with the Health Tracking card expanded. Shows the accordion pattern: cards expand in-place, page scrolls. Study the rhythm.

**03** — Home screen with all cards collapsed. Shows the compact layout and section stacking order.

**These are Excalidraw wireframes, not the actual UI.** The visual design is yours to create — diverge significantly from the wireframe aesthetic.

### Category 2: Competitor References (images 04–10)

Real food tracking app screenshots. Your design should match or exceed this quality.

**04** — Cal AI food search: clean search bar, tab filters, food suggestions with calories and `+` buttons.
**05/06** — Calorie tracking widgets in dark and light mode with progress rings and macro breakdowns.
**07/09/10** — Food detail screens with macro cards, portion selectors, health scores.
**08** — Daily plan with meal slot cards, calorie rings, and water intake.

### Category 3: Full App Context (image 11)

**11** — Full app architecture wireframe showing all screens. Your work is the Nutrition card on the Home screen — this gives you the broader context.

---

## Tech Constraints

- React + TypeScript, Convex (mock the data), shadcn/ui components, Lucide React icons (no emojis), Tailwind CSS
- Mobile-first: 390px viewport
- Metric only: grams and millilitres. No imperial units.
- Light mode with yellow as your primary accent colour for the Nutrition section
- Yellow must work as the accent for icons, buttons, active states — ensure readability and contrast on light backgrounds

---

## Core Functionality

The home screen uses expandable cards (accordion pattern). The Nutrition card has a collapsed state and expands when the user starts interacting.

### What the user needs to do:

**Log food — the primary action.** The user should be able to:
1. Type food names or descriptions (e.g., "200g chicken, 150g rice") into a unified input
2. Search the food registry with fuzzy matching (typos tolerated)
3. See recent foods and saved meals for quick re-logging
4. Adjust portions with simple +/− controls (±50g for solids, ±50ml for liquids, ±1 for countable items) — both `+` and `−` must be on every staged food row
5. Stage multiple foods before committing them all with one "Log Food" action
6. The staging area must use listed rows, not chips — each food gets its own full-width row showing: food name, `−`/`+` portion controls, calorie count for current portion, and X to remove
7. A summary row at the bottom of the staging area showing total calories (and optionally protein, carbs, fat in grams)
8. Remove individual items from staging (X button or minus to zero)
9. Clear the entire staging area

**Track calories at a glance.** The collapsed card should show a minimal daily calorie summary (today's intake vs 1,800 kcal goal). Tapping it reveals a detailed breakdown by meal slot with a list of everything logged today.

**Log water separately.** A water button opens a modal with a visual progress indicator (your creative choice — fill graphic, progress ring, bottle, whatever works), ±50ml adjustment from a 200ml default, and a Log Water button. Water uses blue accent, not yellow.

**Filter and find foods:**
- A favourites view showing hearted foods
- A meal slot filter (Breakfast/Lunch/Dinner/Snacks tabs) showing foods previously logged under each slot, for quick re-logging

**Auto-detect meal slot** from time of day:
- 04:00–08:59 → Breakfast
- 13:00–16:59 → Lunch
- 20:00–22:59 → Dinner
- Everything else → Snack
- User can override via a dropdown

### How text input works:
The user can type anything — a single food ("avocado") or a block ("200g chicken, 100g rice, 50g broccoli"). The system accepts the text, the backend resolves it asynchronously against the food registry using fuzzy matching, vector search, and AI interpretation. There is no "no match" error in the UI. The input just accepts and moves on.

---

## Progressive Disclosure — Three Layers

**Layer 1 (collapsed card):** Everything the user needs at a glance. Calorie summary, the input bar, quick-access buttons for water/favourites/filter. Don't hide frequently needed things.

**Layer 2 (expanded card):** What a normal user needs for the active task. Search results, recent foods, saved meals, portion adjustment, staging area.

**Layer 3 (modals, advanced views):** Calorie detail breakdown, water logging modal, full food detail with portion editing. Accessed via explicit taps from Layer 2.

---

## Functional Screens/States Required

1. **Nutrition card collapsed** — calorie summary, input bar, water/favourites/filter buttons
2. **Nutrition card expanded with search** — auto-complete results (recency order), recent foods list, saved meals list, auto-detected meal slot
3. **Staging area modal** — accumulated food items with ±portion controls, X to remove, calorie total, Log Food to commit, Clear to reset
4. **Water logging modal** — visual progress toward 1,000ml daily goal, ±50ml from 200ml default, blue accent, Log Water button
5. **Favourites view** — within expanded card, list of hearted items with quick-add
6. **Meal slot filter view** — within expanded card, tabs for each meal slot, foods listed in recency order
7. **Calorie detail view** — expanded breakdown by meal slot, today's logged foods, edit/delete options

---

## Mock Data

Create a mocked data layer with at least 25 foods (mix of proteins, carbs, vegetables, dairy, fruits), 5 saved meals (composites like "Coffee 250ml", "Chicken & Rice", "Scrambled Eggs on Toast"), 8+ recent log entries, water tracking state, and a 1,800 kcal daily goal. All portions in grams or millilitres.

---

## Design Direction

You have creative freedom here. Some principles to respect:
- This must feel like a mobile app, not a web dashboard
- Food lists should be vertical, not horizontal chip rows (chips get unreadable at 10+ items)
- No food photography or decorative illustrations
- No oversized cards or marketing-style layouts
- The input bar should feel like the most natural thing to reach for
- Yellow is your accent — make it work elegantly on light backgrounds. Consider pairing with warm neutrals.
- shadcn/ui components for all interactive elements
- Lucide icons only, no emojis

---

## What NOT to Include

- No bottom navigation bar, no onboarding, no settings, no TRAC tab
- No FAB — the input bar is the primary entry point
- No composite meal scaling — meals log at fixed portions, only individual items adjust
- No "add new food to registry" flow
- No imperial units, no emojis
- Don't invent features beyond this spec
