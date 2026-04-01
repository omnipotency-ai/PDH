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

The app already has a mature dark theme (teal/cyan primary, pink/magenta secondary, dark card backgrounds with subtle borders). The app uses chip-based selection extensively (Bristol scale, urgency, effort, volume, fluid types, quick capture cards).

## Architecture

### Current vs. proposed navigation

**Current state:** The app has 3 top-level routes: **Track**, **Patterns**, **Settings**. The root `/` route renders Track. Food logging is a single text field in the Track page left column.

**Proposed state (from wireframes):** The wireframes show a new 4-tab navigation: **Home**, **Track**, **Food**, **Insights**. This PRD covers the **Food** page only. The new navigation structure (adding Home, Food, and Insights as routes; potentially restructuring Track) is a **separate prerequisite** that should be implemented before or alongside this PRD. This PRD does not define the Home or Insights pages.

### Entry Point

The **Food** tab in the proposed navigation. Until the new nav is built, this page can be developed as a standalone route (`/food`) and linked from the existing Track page food section.

### "What can I eat today?" (future — not in scope)

The wireframes show an AI-powered suggestion section on the proposed Home page with food recommendations based on tolerance history. **This is not part of this PRD's scope.** It depends on the food status system from Wave 3 and the Home page route which does not yet exist. Noted here for context only — it will be scoped in a future PRD after Waves 1-3 are complete.

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
// Meal slots — schema value is lowercase singular, display label is title case
// (e.g., schema: "snack", display: "Snacks")
type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

interface Recipe {
  // Convex ID — stored in a NEW `recipes` table (see note below)
  _id: Id<"recipes">;
  userId: string;
  name: string; // "Scrambled eggs on toast"
  ingredients: RecipeIngredient[]; // Default ingredients (expanded on add to staging)
  slotDefaults: {
    // Optional portion overrides per slot — falls back to `ingredients` if not set
    [slot in MealSlot]?: RecipeIngredient[];
  };
  slots: MealSlot[]; // Which slots this recipe appears in
  frequency: number; // Auto-incremented on each log
  isFavourite: boolean; // User-pinned to top of slot
}

interface RecipeIngredient {
  canonicalName: string; // "white rice", "large egg"
  quantity: number; // 200
  unit: string; // "g", "slice", "piece", "ml", "tsp"
}
```

**Relationship to `foodLibrary`:** Recipes are a **new `recipes` table**, not an extension of `foodLibrary`. The `foodLibrary` table stores canonical food definitions and composite ingredient lists (for the LLM parsing pipeline). Recipes are a user-facing layer on top: they reference canonical food names from the registry but add portions, slot defaults, frequency, and favourites. The two tables serve different purposes and should not be merged. Existing `foodLibrary` composites remain unchanged.

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

## Barcode Scanning (stub for v1)

Same purpose as nutrition label capture but using the product barcode. **The barcode icon should be present in the UI but is a v2 feature.** The existing `convex/ingredientNutritionApi.ts` only supports text-based search — a new barcode lookup action (using OpenFoodFacts' barcode endpoint) needs to be built before this flow can work.

**Planned flow (v2):**

1. User taps **barcode icon**
2. Scans product barcode
3. New action looks up barcode via OpenFoodFacts API (`/api/v0/product/{barcode}.json`)
4. If found: show nutrition data for review, save to registry
5. If not found: fall back to manual entry or nutrition label photo capture

## Data Model Integration

### Existing infrastructure (already built, needs wiring)

| System                   | What it does                                                       | Status                                  |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------- |
| `ingredientExposures`    | Tracks every food item eaten (canonical name, quantity, timestamp) | Active writes, no UI consumer           |
| `ingredientProfiles`     | Per-food metadata: nutrition per 100g, food group, tags            | Infrastructure ready, no data populated |
| `ingredientOverrides`    | User-set food status (safe/watch/avoid)                            | Backend ready, no UI to create          |
| `ingredientNutritionApi` | OpenFoodFacts text-based search (no barcode lookup)                | Fully built, untriggered                |
| `foodLibrary`            | Stores composite food definitions                                  | Active, used by food parsing            |

### New data needed

- **Recipes table** — name, ingredients with quantities, slot defaults, frequency, favourite flag
- **Meal slot association** — which slot a log entry belongs to (Breakfast/Lunch/Dinner/Snacks)
- The new `recipes` table is separate from `foodLibrary` (see Recipes section above for details)

## Failure States

The app is online-only (per CLAUDE.md: no fake offline). Input modes should fail clearly:

- **Network down:** Show explicit "No connection" state. Disable Log button. Staging area is preserved (Zustand state) so nothing is lost — user can retry when connected.
- **Camera permission denied:** Show a brief message explaining the permission is needed. Do not re-prompt automatically.
- **Voice input returns nothing:** No-op. The search field remains empty; user can type instead.
- **AI parsing fails or low confidence:** Show the raw text in the staging area with a warning badge. User can manually edit/correct items before logging.
- **Nutrition label photo is unreadable:** Show the review screen with empty/partial fields. User fills in manually. "Fix Results" is the primary flow for this case.
- **Search returns no results:** Show "No matches" with an option to add as a new food (plain text entry with manual portion).

## Staging Area Aggregation Rules

When items are added to the staging area:

- **Same food, same unit:** Quantities are summed (200g rice + 150g rice = 350g rice)
- **Same food, different units:** Shown as separate line items (1 cup rice + 200g rice = two rows). No automatic unit conversion — the user can manually adjust if needed.
- **Decrement:** Tapping an item in staging reduces by 1 default unit. If the item came from a recipe with a specific quantity (e.g., "1 tsp butter"), decrement removes that quantity.

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
