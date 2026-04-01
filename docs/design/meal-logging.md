# Meal Logging PRD

> Redesign of the food logging experience for PDH. Replaces the current single text field
> with a chip-based, slot-aware meal builder that minimises friction for daily use.

## Problem

Logging friction is the #1 UX blocker. The current food input is a single text field ("eg. Ham sandwich") with a Log button. On bad days (diarrhea, fatigue, low motivation), the user skips logging entirely — which is exactly when data matters most. The user has ADHD and needs minimal-friction input that works across energy levels.

## Design Principles

- **Taps > toggles/dropdowns.** Even 10-12 taps is fine. Scrolling through dropdown options is not.
- **Progressive disclosure.** Don't show everything at once. Meal slots scope what's visible.
- **Shopping cart pattern.** Build up a staging area, review at a glance, commit with one action.
- **Aggregated totals.** The staging area deduplicates — 4 toast + 2 toast = 6 toast, not two rows.
- **Multiple input modes.** Different moods, different inputs: tap, type, voice, camera, AI.
- **No time validation.** Meal slots are food categories, not schedules. Breakfast at midnight is fine.

## Visual References

### App reference images (in `docs/design/food-trackers/`)

- **`pdh-light-mode-reference.png`** — Complete light-mode app wireframe showing all pages: Home (with Nutrition section, Quick Capture, AI Coach, "What can I eat today?" suggestions), Track (daily log), Food page, and Settings. **This is the primary style and layout reference.**
- **`pdh-dark-mode-reference.png`** — Complete dark-mode app showing: Track page, Patterns page with Bristol trend charts, Corridors view (Protein/Carbs/Fats/Seasoning corridors with individual food items and trial data), food detail page. **Use this for dark-mode palette and the existing design language.**
- **`pdh-home-mockup.png`** — Closer detail of the Home page mockup showing the Nutrition section layout, icon bar, search field, Food Logs panel, and Quick Capture section.

### Interaction pattern references (in `docs/design/food-trackers/`)

| Pattern                         | File                        | What to borrow                                                                                                 |
| ------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Search + tabs + suggestion list | `cal-ai-search-food-db.png` | Tabs (All / My meals / My foods / Saved scans), natural language search field, suggestion list with "+" to add |
| Ingredient chips                | `tinu.webp`                 | Circular tappable ingredient chips with labels under "Ingredients" section                                     |
| Staging area chips              | `musemind-pro.webp`         | Removable filter chips with X dismiss (Breakfast x, Lunch x, Dinner x)                                         |
| Photo nutrition capture         | `cal-ai-1.png`              | Photo + parsed nutrition + serving stepper + "Fix Results" / "Done"                                            |
| Macro row display               | `musemind-pro.webp`         | Horizontal macro chips (kcal, protein, carbs, fat) per meal                                                    |
| Home with recent logs           | `cal-ai-track.png`          | Recently logged entries with timestamp, photo, and macro summary                                               |

### Existing app design language

The app already has a mature dark theme (teal/cyan primary, pink/magenta secondary, dark card backgrounds with subtle borders). The app uses chip-based selection extensively (Bristol scale, urgency, effort, volume, fluid types, quick capture cards). The Food page is a **top-level nav destination** (bottom nav: Home, Track, Food, Insights).

## Architecture

### Entry Point

The **Food** tab in the bottom navigation (Home, Track, **Food**, Insights). This is a dedicated page, not a subsection of Home. The Home page also has a Nutrition quick-access section that links to the Food page.

### "What can I eat today?" (Home page)

The Home page includes an AI-powered suggestion section showing 3-4 food recommendations based on tolerance history:

- Frequently logged safe foods ("Scrambled eggs on white toast — Scanned 4 times, your go-to")
- Foods currently being tested ("Banana with yogurt — Gentle, building")
- Next food to try ("Cooked carrots — Stage 3, Low gas, Soft texture")

Each suggestion has a **Log** button for one-tap logging or a **Start** button for foods being trialled for the first time. This section is informational and motivational — the full meal builder lives on the Food page.

### Food Logging Page Layout (top to bottom)

```
┌─────────────────────────────────────────────┐
│  [mic] [camera] [  Search foods...       ]  │  ← Input bar
├─────────────────────────────────────────────┤
│  [Breakfast] [Lunch] [Dinner] [Snacks]      │  ← Meal slot chips
├─────────────────────────────────────────────┤
│                                             │
│  Recipe/food chips for selected slot        │  ← Chip selection area
│  (scrollable, shows favourites + recents)   │
│                                             │
├─────────────────────────────────────────────┤
│  Staging area (aggregated ingredients)      │  ← Cart / review area
│  ┌──────┐ ┌────────┐ ┌──────┐              │
│  │6 toast│ │3 eggs  │ │butter│  ...         │
│  └──────┘ └────────┘ └──────┘              │
│                                             │
│  Kcal: 450  P: 28g  C: 52g  F: 18g         │  ← Running nutrition total
├─────────────────────────────────────────────┤
│                              [  Log Food  ] │  ← Commit button
└─────────────────────────────────────────────┘
```

### Components

#### 1. Input Bar

A search field with smart autocomplete and input mode icons.

**Search behaviour:**

- Type-ahead matching against recipes and individual foods
- Typing "egg" surfaces: "Scrambled eggs on toast", "Single egg", "Egg (boiled)"
- Typing "mash" surfaces: "Mashed potato", "Mashed pumpkin", "Mashed carrot"
- Search overrides meal slot context — searches everything regardless of selected slot
- Tapping a search result adds it to the staging area (recipes expand into ingredients)

**Input mode icons:**

- **Mic** — voice input (uses device voice; not in-app speech recognition)
- **Camera** — nutrition label scanning (see Nutrition Capture section below)
- **Barcode** — product barcode scan to look up or create a food in the registry
- **AI** — free-text "sort it out" mode (sends text to AI for parsing)

#### 2. Meal Slot Chips

Horizontal row: **Breakfast**, **Lunch**, **Dinner**, **Snacks**.

- Tapping a slot filters the chip selection area to show that slot's recipes and favourites
- No slot is selected by default — shows general "all favourites" view
- Slots are categories, not time windows. No validation. Log breakfast at midnight, snacks at 6am.
- Tapping a selected slot deselects it (returns to "all" view)

#### 3. Chip Selection Area

Shows recipes and individual foods as tappable chips for the selected meal slot.

**Chip types:**

- **Recipe chips** — named combos with slot-aware default portions (e.g., "Scrambled eggs on toast" shows as one chip, tapping it adds all ingredients with the default portions for that slot)
- **Food chips** — individual foods with default portions (e.g., "Rice 200g", "Coffee", "Kaleitos 20")

**Ordering:** Most frequently logged items first (frequency-based, not recency-based). Explicit favourites pinned to top.

**Slot-aware defaults:** The same recipe can have different default portions per slot:

- "Scrambled eggs on toast" in Breakfast = 3 eggs, 4 toast, butter, oil, salt, pepper
- "Scrambled eggs on toast" in Snacks = 1 egg, 2 toast, butter, oil, salt, pepper

#### 4. Staging Area

The cart. Shows aggregated ingredients with quantities. Always visible once items have been added.

**Key behaviours:**

- **Aggregation:** Adding "Scrambled eggs on toast" (4 toast) then tapping "Toast" twice = staging shows "6 toast", not "4 toast" + "1 toast" + "1 toast"
- **Tap to decrement:** Tap an item in staging to reduce quantity by 1 (or by its default unit)
- **Tap chip to increment:** Tap the food chip again to add another unit
- **Remove:** When quantity reaches 0, the item disappears from staging
- **Nutrition row:** Running total of kcal, protein, carbs, fat displayed below the staging items

**Visual pattern:** Items displayed as removable chips/pills (reference: Musemind filter chips with X dismiss). Each chip shows food name + quantity.

#### 5. Log Button

Commits everything in the staging area to the database. Single tap. Can also use Enter/Return key.

- Logs all items with current timestamp
- Associates with the selected meal slot (or "unslotted" if no slot selected)
- Clears the staging area after successful log
- Brief success confirmation (non-blocking toast/flash, not a modal)

### Water & Liquids

Water has its own quick-action via the droplet icon (visible in the input bar area). All other liquids (coffee, hot chocolate, tea, juice) are logged as food — they appear in the chip selection area and go through the same staging flow. Only water gets special treatment as hydration tracking.

## Recipes

### What is a Recipe?

A named combination of ingredients with default portions. Recipes are the primary quick-log mechanism.

```typescript
interface Recipe {
  id: string;
  name: string; // "Scrambled eggs on toast"
  ingredients: RecipeIngredient[]; // Expanded on add to staging
  slotDefaults: {
    // Portion overrides per slot
    [slot: string]: RecipeIngredient[];
  };
  slots: MealSlot[]; // Which slots this recipe appears in
  frequency: number; // Auto-tracked for sorting
  isFavourite: boolean; // User-pinned
}

interface RecipeIngredient {
  canonicalName: string; // "white rice", "large egg"
  quantity: number; // 200
  unit: string; // "g", "slice", "piece", "ml", "tsp"
}
```

### Example Recipes

**Scrambled eggs on toast (Breakfast defaults):**

- 3 large egg
- 4 slice white toast
- 1 tsp butter
- 1 tsp olive oil
- pinch salt
- pinch pepper

**Scrambled eggs on toast (Snack defaults):**

- 1 large egg
- 2 slice white toast
- 1 tsp butter
- 1 tsp olive oil
- pinch salt
- pinch pepper

**Toast with toppings (builder):**

- Base: N slice toast (user sets count)
- Toppings area: jam, peanut butter, cream cheese, turkey, cheese, ham, butter
- Each topping tap = one-slice generous portion
- Tap 3 times = 3 portions

**Coffee:**

- 1 espresso shot
- 30-40 ml lactose-free skimmed milk

**Bread snacks (Kaleitos):**

- 20 piece kaleitos

### Recipe Management

- Recipes are created from logged meals ("Save as recipe" after logging)
- Recipes can be edited (add/remove ingredients, change defaults)
- Recipes can be assigned to meal slots
- Recipes can be marked as favourites (pinned to top of their slot)
- No recipe management UI needed in v1 — build recipes through logging, edit through a simple detail view

## Nutrition Label Capture

### Purpose

Scan a nutrition label photo to populate the food registry with accurate nutrition data. This is a setup-phase activity — done once per product, not every meal.

### Flow

1. User taps **camera icon** in the input bar
2. Camera opens (or photo picker for existing photos)
3. User photographs the nutrition facts panel on packaging
4. AI extracts: food name, serving size, kcal, protein, carbs, sugars, fat, saturated fat, fibre, salt
5. Review screen shows parsed data with editable fields
6. "Fix Results" to correct any misreads, "Done" to save
7. Data saves to `ingredientProfiles.nutritionPer100g` (normalized to per-100g)
8. Food is now in the registry with full nutrition data

### Visual reference

See `cal-ai-1.png` — photo at top, parsed nutrition below, serving stepper, Fix Results / Done buttons.

### Frequency

Rare after initial setup. User buys the same products weekly from the same supermarkets. ~15-20 products to scan initially, then occasional new items during reintroduction.

## Barcode Scanning

Same purpose as nutrition label capture but using the product barcode:

1. User taps **barcode icon**
2. Scans product barcode
3. Look up in OpenFoodFacts API (already integrated: `convex/ingredientNutritionApi.ts`)
4. If found: show nutrition data for review, save to registry
5. If not found: fall back to manual entry or nutrition label photo capture

## Data Model Integration

### Existing infrastructure (already built, needs wiring)

| System                   | What it does                                                       | Status                                  |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------- |
| `ingredientExposures`    | Tracks every food item eaten (canonical name, quantity, timestamp) | Active writes, no UI consumer           |
| `ingredientProfiles`     | Per-food metadata: nutrition per 100g, food group, tags            | Infrastructure ready, no data populated |
| `ingredientOverrides`    | User-set food status (safe/watch/avoid)                            | Backend ready, no UI to create          |
| `ingredientNutritionApi` | OpenFoodFacts API lookup                                           | Fully built, untriggered                |
| `foodLibrary`            | Stores composite food definitions                                  | Active, used by food parsing            |

### New data needed

- **Recipes table** — name, ingredients with quantities, slot defaults, frequency, favourite flag
- **Meal slot association** — which slot a log entry belongs to (Breakfast/Lunch/Dinner/Snacks)
- Recipes can build on the existing `foodLibrary` composite concept but need the slot-aware defaults and portion tracking that composites don't currently have

## Non-Goals (v1)

- In-app voice recognition (user's device voice works fine)
- Meal planning / scheduling future meals
- Photo-of-plate AI identification (just nutrition labels and barcodes)
- Social features, sharing, or multi-user
- Offline support
- Barcode scanning UI (can stub the icon, implement in a later wave)

## Success Criteria

- Log a typical breakfast (scrambled eggs on toast) in under 5 taps
- Log a snack (20 kaleitos) in 2 taps (tap Snacks, tap Kaleitos chip)
- Log a complex meal (toast + variable toppings) by tapping base + individual toppings, review staging, confirm
- Zero dropdowns or scroll-to-select interactions in the primary logging flow
- Staging area correctly aggregates duplicate ingredients
- Nutrition totals update in real-time as items are added/removed

## Implementation Notes

- This is a **web app** (React + Vite + Tailwind v4), not a native mobile app. Design should be mobile-responsive but the primary development target is desktop browser.
- The existing Track page left column is where the food input currently lives. The new design may replace or significantly rework this section.
- The food parsing pipeline (`convex/foodParsing.ts` → `processLogInternal`) already handles the backend work of creating log entries and ingredient exposures. The new UI should feed into this existing pipeline.
- Recipes are a new concept that wraps the existing `foodLibrary` composites with user-facing features (naming, slot defaults, favourites, frequency tracking).
