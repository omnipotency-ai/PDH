# Food Page, Meal System & Navigation Restructure

> **Ref:** `docs/prd/2026-04-06-food-page-and-meal-system.md`
> **Created:** 2026-04-06
> **Status:** Draft
> **Supersedes:** `docs/plans/archive/meal-logging-prd.md` (deferred items)
> **Related:** `docs/plans/data-integration-plan.md`, `docs/ROADMAP.md`
> **Design refs:** `docs/plans/archive/Worktree spec/user-annotations/pdh-light-mode-reference.png`, `pdh-dark-mode-reference.png`

---

## 1. Overview

PDH needs to evolve from a 3-tab layout (Track/Patterns/Settings) into a 4-tab + header-settings app (Home/Track/Food/Insights). The current Track page does too much: logging, daily summary, Dr. Poo, and the nutrition card all compete for space.

This PRD covers:

- **Navigation restructure** — 4 bottom tabs + Settings in header
- **Home** — Lightning-fast daily logging (food, fluids, modifiers)
- **Track** — Today's Log only (currently the right column)
- **Food** — Deep food management, meal templates, editing, backfill logging
- **Meal system** — Base + modifier templates (McDonald's ordering model)
- **AI text parser** — Natural language food input (Phase 1)
- **Voice capture** — Whisper-style mic input (Phase 2, deferred)
- **Universal interactions** — Heart = favourite toggle everywhere, Plus = stage + auto-navigate

The Patterns tab becomes **Insights** with two sub-tabs for now: Patterns (existing page) and Dr. Poo Report (moved from Track). A full Insights redesign is a separate, deferred PRD.

---

## 2. Goals

1. Daily food logging in under 5 taps for known meals
2. Meal templates that model real food (coffee = espresso + water + milk + sugar, with add/subtract modifiers)
3. Heart icons work consistently everywhere — no dead or misleading hearts
4. Clear separation: Home = fast logging, Food = deep management, Track = daily log review
5. AI text parser handles messy dictated input ("two toast with butter, um, and jam")
6. User's ~30-food post-surgery diet is fully modelled with accurate portions

## 3. Non-Goals

- Offline support (app is online-only per CLAUDE.md)
- Meal planning / scheduling future meals (Insights scope)
- Social features or multi-user
- Full Insights/Patterns tab redesign (separate PRD — for now, Insights = two sub-tabs: Patterns + Dr. Poo Report)
- Voice capture hardware integration (Phase 2, separate PRD)
- Barcode scanning (parking lot)
- Photo nutrition label capture (parking lot)

---

## 4. Navigation Restructure

### Current state

```
[Track]  [Patterns]  [Settings]
```

Track page has 3 columns: NutritionCard (left), Dr. Poo + content (center), Today's Log (right).

### Target state

```
Bottom tabs:  [Home]  [Track]  [Food]  [Insights]
Header:       [App logo]  ...  [dark mode toggle]  [Settings gear]  [Profile avatar]
```

| Tab      | Route       | Purpose                                                                    |
| -------- | ----------- | -------------------------------------------------------------------------- |
| Home     | `/`         | Lightning-fast logging — food chips, modifier chips, coach summary         |
| Track    | `/track`    | Today's Log — the vertical daily timeline (currently right column)         |
| Food     | `/food`     | Deep food management — search, meals, favourites, editing, backfill        |
| Insights | `/insights` | Two sub-tabs: Patterns (existing page) + Dr. Poo Report (moved from Track) |

- **Settings** moves to a gear icon in the header (route: `/settings`, renders as page not tab)
- **Dr. Poo report** moves from Track center column to Insights (as its own sub-tab alongside Patterns)
- **Dr. Poo chat** accessible from Home via two touchpoints (see US-010)

### Mobile vs Desktop

- Mobile: bottom tab bar, single column per page
- Desktop: tabs can render as a sidebar or top nav; Home and Track can optionally show side-by-side (2-column layout)

---

## 5. User Stories

### Navigation

#### US-001: Four-tab navigation

**Description:** As a user, I want a 4-tab bottom navigation so that each concern has its own space.

**Acceptance Criteria:**

- [ ] Bottom nav shows Home, Track, Food, Insights tabs with icons
- [ ] Settings is a gear icon in the header, not a tab
- [ ] Active tab is visually highlighted
- [ ] Routes: `/` (Home), `/track`, `/food`, `/insights`, `/settings`
- [ ] Deep links work (navigating directly to `/food` renders Food page)
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### Home Page (Quick Logging)

#### US-002: Home page layout

**Description:** As a user, I want a Home page that gives me lightning-fast logging so that I can log a meal in under 5 taps.

**Acceptance Criteria:**

- [ ] Home page shows: greeting, nutrition summary, food/drink chips, modifier chips, coach summary
- [ ] Nutrition summary is compact: calorie ring + calorie bar + fluid bar side by side
- [ ] Calorie bar shows `{consumed} / {goal} kcal` (e.g. "608 / 1850 kcal")
- [ ] Fluid bar shows `{consumed} / {goal} ml` (e.g. "1600 / 2000 ml")
- [ ] Both bars sit beside the circular progress ring, not stacked vertically below
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-003: Meal slot context on Home

**Description:** As a user, I want Home to know which meal slot I'm logging for so that it shows relevant food suggestions.

**Acceptance Criteria:**

- [ ] Meal slot auto-detected from time of day (existing logic)
- [ ] Slot chips shown: Breakfast, Lunch, Dinner, Snack — tappable to override
- [ ] Selected slot determines which favourites, recents, and frequent items surface
- [ ] Slots are categories, not time windows — no validation on which slot is selected
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-004: Favourites on Home (slot-scoped via auto-tagging)

**Description:** As a user, I want my favourites for the current meal slot to surface on Home so that I can log them in one tap.

**How slot-scoping works:** Favourites are a global list (heart toggle adds/removes from one list). Foods are auto-tagged with meal slots based on logging history — if coffee has been logged at breakfast and snack, it appears in favourites when either of those slots is active. No manual slot assignment needed. The system learns from behaviour.

**Acceptance Criteria:**

- [ ] Favourites section shows up to 7 items tagged for the current meal slot
- [ ] "Show more" button loads the next 7 items
- [ ] Each item shows: food name, portion, kcal
- [ ] Heart icon (filled orange) shown on each — tappable to unfavourite
- [ ] Green (+) button stages the food and auto-navigates to staging
- [ ] If no favourites for this slot, section shows "No favourites for {slot}" with link to Food page
- [ ] Slot tags are auto-assigned when a favourited food is logged in a given slot
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-005: Recent and Frequent on Home (slot-scoped)

**Description:** As a user, I want recent and frequent foods for the current meal slot to surface on Home.

**Acceptance Criteria:**

- [ ] Recent section shows last 7 unique foods logged in this slot
- [ ] Frequent section shows top 7 foods by log count for this slot
- [ ] Same row format as favourites: name, portion, kcal, heart toggle, (+) to stage
- [ ] "Show more" loads next 7
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-006: Quick-log food chips on Home

**Description:** As a user, I want tappable food chips on Home so that I can log with minimal interaction.

**Acceptance Criteria:**

- [ ] Food chips appear as tappable pills/chips below the nutrition summary
- [ ] Tapping a chip stages the food (with default portion for current slot)
- [ ] View auto-navigates to staging area after staging
- [ ] Chips show food name and optionally a small calorie label
- [ ] Chip order: favourites first, then frequent, then recent
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-007: Modifier logging chips on Home

**Description:** As a user, I want quick-access modifier chips (sleep, stress, mood, activity, medication, cigarettes, supplements) on Home.

**Acceptance Criteria:**

- [ ] Modifier row shows chip icons: Sleep, Stress, Mood, Activity, Medication, Cigarettes, Supplements
- [ ] Tapping a modifier chip opens its existing logging flow (modal or inline)
- [ ] This reuses existing Track page modifier/habit logging components
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-007b: Quick Capture on Home (streamlined)

**Description:** As a user, I want Quick Capture on Home to be one-click logging for my regular items — no customisation, just click and done.

**Acceptance Criteria:**

- [ ] Quick Capture section stays on Home page (moved from Track)
- [ ] Shows only regularly logged items that don't change (e.g. "Done: Brush Teeth", "750ml Coffee", "250ml Tea", "5/7hrs Sleep")
- [ ] One tap = logged with current timestamp. No confirmation dialog, no further interaction
- [ ] No customisation UI — items are derived from frequent logging patterns or pre-configured
- [ ] Streamlined visual: compact cards, minimal chrome
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-008: Search bar on Home

**Description:** As a user, I want a search bar on Home so that I can find foods not shown in chips.

**Acceptance Criteria:**

- [ ] Search bar with placeholder "Search or type a food..."
- [ ] Log Food button beside search bar
- [ ] Typing triggers fuzzy search against food registry (existing Fuse.js logic)
- [ ] Results show as food rows with heart toggle and (+) to stage
- [ ] Search bar + Log Food matches current NutritionCard search UX
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-009: Water quick-action on Home

**Description:** As a user, I want a water button on Home that opens the water modal.

**Acceptance Criteria:**

- [ ] Water/droplet icon visible near nutrition summary or in food chip row
- [ ] Tapping opens existing WaterModal
- [ ] Logging water updates the fluid bar in real-time
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-010: Dr. Poo on Home — two touchpoints

**Description:** As a user, I want two ways to interact with Dr. Poo from Home: I can proactively ask, or Dr. Poo can proactively nudge me.

**Touchpoint 1 — "Ask Dr. Poo" button (user-initiated):**
Top of Home page. Tapping opens the Dr. Poo chat panel (slide-out or modal). User asks questions, gets responses. This is the user being proactive.

**Touchpoint 2 — Proactive card (Dr. Poo-initiated):**
Bottom of Home page. A card showing Dr. Poo's latest AI-summarized message (max 150 characters, summarized not truncated). Examples:

- "Have you logged any bowel movements today?"
- "It's nearly 3pm — want to log lunch?"
- "Your last 3 days show a pattern with coffee timing"
- Suggestion based on recent logs or missing logs

Card actions: "Got it" (dismiss) | "Chat with Dr. Poo" (opens chat about this topic)

**Chat Dr. Poo vs Report Dr. Poo:**

- Chat Dr. Poo (Home) = interactive, real-time, listens to logging activity, proactively nudges
- Report Dr. Poo (Insights tab) = daily/periodic summary, the existing report format

**Acceptance Criteria:**

- [ ] "Ask Dr. Poo" button at top of Home page with Dr. Poo branding
- [ ] Tapping opens chat panel (slide-out or modal, not full navigation)
- [ ] Proactive card at bottom of Home page shows latest 150-char summarized message
- [ ] Card updates based on logging activity (missing logs, time-based prompts, pattern observations)
- [ ] "Got it" dismisses the card; "Chat with Dr. Poo" opens chat panel with the topic pre-loaded
- [ ] Chat panel connects to existing Dr. Poo conversation system
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### Track Page (Today's Log)

#### US-011: Simplified Track page

**Description:** As a user, I want Track to be a clean daily log timeline so that I can review what I've logged today.

**Acceptance Criteria:**

- [ ] Track page shows Today's Log only (currently the right column on Track page)
- [ ] Vertical timeline with all log entries: food, fluids, BMs, medication, habits, etc.
- [ ] Yesterday/Today toggle preserved
- [ ] No NutritionCard, no Dr. Poo report, no Quick Capture on this page
- [ ] Entries are tappable to expand details (existing behaviour)
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### Food Page (Deep Management)

#### US-012: Food page layout

**Description:** As a user, I want a dedicated Food page for deep food management so that I can build meals, edit nutrition data, and backfill logs.

**Acceptance Criteria:**

- [ ] Food page has: search bar, view switcher, content area
- [ ] View switcher icons/tabs: Search, Favourites, Filter (recent/frequent/zone), All
- [ ] Views are primary (replace content area), not secondary (appended below)
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-013: Food page search view

**Description:** As a user, I want to search all foods on the Food page.

**Acceptance Criteria:**

- [ ] Search queries entire food registry (no 50-item cap — registry is ~300-400 items)
- [ ] Results show: food name, zone badge, portion, kcal, heart toggle, (+) to stage
- [ ] Empty search shows all foods (replaces the "All" view concept)
- [ ] Fuse.js fuzzy matching (existing)
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-014: Food page favourites view

**Description:** As a user, I want a Favourites view on the Food page that shows all my favourited foods.

**Acceptance Criteria:**

- [ ] Favourites view shows all foods where heart is toggled on
- [ ] Same row format: name, zone badge, portion, kcal, heart (filled), (+) to stage
- [ ] Can be scoped by meal slot via slot chips at top
- [ ] Empty state: "No favourites yet — tap the heart on any food to add it"
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-015: Food page filter view

**Description:** As a user, I want to filter foods by recent, frequent, and zone on the Food page.

**Acceptance Criteria:**

- [ ] Filter view has sub-filters: Recent, Frequent, Zone
- [ ] Recent: foods logged in the last 7 days, sorted by last-logged
- [ ] Frequent: foods sorted by total log count, descending
- [ ] Zone: filter by zone badge (Z1, Z2, Z3, Z4) — show zone chip toggles
- [ ] Filters can combine (e.g. Recent + Z1)
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-016: Food detail editing

**Description:** As a user, I want to tap a food on the Food page to edit its calories, grams, macros, and portion info.

**Acceptance Criteria:**

- [ ] Tapping a food name/row opens a detail panel or modal
- [ ] Editable fields: name, default portion size, unit, kcal, protein, fat, carbs, fibre, sugar, salt
- [ ] Changes save to food registry / ingredientProfiles
- [ ] Cancel discards changes
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-017: Backfill logging from Food page

**Description:** As a user, I want to log food for earlier meals from the Food page (end-of-day catch-up).

**Acceptance Criteria:**

- [ ] Food page has a date/time picker for "Logging for: [date] [meal slot]"
- [ ] Defaults to current time and auto-detected slot
- [ ] User can change to earlier today (or previous days)
- [ ] Staged foods log with the selected timestamp, not current time
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### Universal Interactions

#### US-018: Heart = favourite toggle everywhere

**Description:** As a user, I want every heart icon on every food row to work as a favourite toggle.

**Acceptance Criteria:**

- [ ] Heart icon appears on every food row in: Home chips, search results (Home and Food), zero-state/recent list, filter view, favourites view
- [ ] Empty heart (gray outline) = not favourited. Tap → fills orange, adds to favourites
- [ ] Filled heart (orange) = favourited. Tap → empties, removes from favourites
- [ ] Favourites persist to profile (`foodFavourites` array on profiles table)
- [ ] No dead/non-functional hearts anywhere — if a heart renders, it works
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-019: Plus = stage + auto-navigate

**Description:** As a user, I want the (+) button on any food row to stage it and take me to the staging area.

**Acceptance Criteria:**

- [ ] Green (+) button on every food row stages the food with its default portion
- [ ] After staging, the view auto-navigates to the staging area (LogFoodModal or inline staging)
- [ ] Staging area shows all staged items with quantities, running calorie/macro totals
- [ ] Works identically on Home and Food pages
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### Meal System

#### US-020: Meal template data model

**Description:** As a developer, I need a data model for meal templates (base + modifiers) so that composites can be created, stored, and logged.

**Acceptance Criteria:**

- [ ] Meal templates stored in `foodLibrary` with `type: "composite"` (no new table)
- [ ] Schema extended with: `structuredIngredients`, `slotDefaults`, `modifiers`, `sizes`
- [ ] `structuredIngredients`: array of `{ canonicalName, quantity, unit }`
- [ ] `slotDefaults`: optional per-slot ingredient overrides
- [ ] `modifiers`: array of `{ canonicalName, quantity, unit, isDefault }` — add/subtract options
- [ ] `sizes`: array of `{ name, adjustments }` — e.g. "250ml cup" vs "450ml cup" for coffee
- [ ] Teaspoon-to-gram conversion data stored per ingredient in `ingredientProfiles`
- [ ] Typecheck passes

**Example — Coffee template:**

```
name: "Coffee"
structuredIngredients: [
  { canonicalName: "espresso", quantity: 1, unit: "shot" },
  { canonicalName: "water", quantity: 200, unit: "ml" },
  { canonicalName: "milk", quantity: 50, unit: "ml" }
]
modifiers: [
  { canonicalName: "sugar", quantity: 5, unit: "g", isDefault: false },
  { canonicalName: "espresso", quantity: 1, unit: "shot", isDefault: false }  // "double"
]
sizes: [
  { name: "250ml cup", adjustments: [] },  // base
  { name: "450ml cup", adjustments: [{ canonicalName: "water", quantity: 350, unit: "ml" }] }
]
```

**Example — Toast template:**

```
name: "Toast"
structuredIngredients: [
  { canonicalName: "toast", quantity: 2, unit: "slice" }
]
modifiers: [
  { canonicalName: "butter", quantity: 5, unit: "g", isDefault: false },
  { canonicalName: "jam", quantity: 5, unit: "g", isDefault: false },
  { canonicalName: "peanut butter", quantity: 5, unit: "g", isDefault: false },
  { canonicalName: "cream cheese", quantity: 10, unit: "g", isDefault: false }
]
```

#### US-021: Meal template creation (on Food page)

**Description:** As a user, I want to create meal templates on the Food page so that I can log complex meals quickly.

**Acceptance Criteria:**

- [ ] "Create Meal" button on Food page
- [ ] Builder flow: name the meal → search and add base ingredients with quantities → add optional modifiers → define size variants → assign to meal slots → save
- [ ] Each ingredient has: name, quantity, unit (g, ml, tsp, tbsp, slice, piece, shot, pinch)
- [ ] Modifiers are optional add/subtract items (toppings, extras)
- [ ] Sizes are named variants that adjust specific ingredient quantities
- [ ] Preview shows total calories and macros for the base configuration
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-022: Meal template creation from logging history

**Description:** As a user, I want to save a logged meal as a template so that I don't have to rebuild it manually.

**Acceptance Criteria:**

- [ ] After logging food, "Save as Meal" option appears
- [ ] Pre-populates template with the logged items and quantities
- [ ] User can name, adjust, add modifiers, and save
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-023: Logging a meal template

**Description:** As a user, I want to log a meal template with add/subtract modifiers in a McDonald's ordering flow.

**Acceptance Criteria:**

- [ ] Tapping a meal chip/row opens a meal ordering view
- [ ] Shows base ingredients with quantities
- [ ] Modifier buttons: each modifier shows as a toggle chip (+jam, +sugar, +extra shot)
- [ ] Quantity stepper on base items (2 toast → 3 toast → 4 toast)
- [ ] Size selector if sizes are defined (250ml cup / 450ml cup)
- [ ] Running calorie/macro total updates as modifiers are toggled
- [ ] "Add to staging" commits the configured meal to staging
- [ ] Typecheck passes
- [ ] Browser verification completed

---

### AI Text Parser

#### US-024: Natural language food input (Phase 1)

**Description:** As a user, I want to type (or dictate via keyboard speech-to-text) a natural language food description and have AI parse it into structured log entries.

**Acceptance Criteria:**

- [ ] Text input field accepts free-form text (e.g. "two toast with butter and jam, coffee 250 double one sugar")
- [ ] AI parser processes text and returns structured items:
  - Strips filler words (um, ah, like, so, uh)
  - Handles self-corrections ("two toast, no three toast" → 3 toast)
  - Handles repetitions and grammar issues
  - Matches against known meal templates and food registry
  - Resolves quantities and modifiers ("double" = 2x espresso)
  - Resolves colloquial portions ("a teaspoon", "a splash", "milky")
- [ ] Confirmation step: shows parsed result for user review before staging
  - e.g. "Did you mean: 2x Toast + butter (5g) + jam (5g), 1x Coffee 250ml double + 1 sugar (5g)?"
- [ ] User can accept, edit, or reject
- [ ] Unknown foods flagged: "I don't recognise 'chaelitos' — add to registry?"
- [ ] Typecheck passes
- [ ] Browser verification completed

#### US-025: Parser integration with meal templates

**Description:** As a developer, the AI parser should prefer matching against existing meal templates before falling back to individual food items.

**Acceptance Criteria:**

- [ ] Parser checks meal templates first (e.g. "coffee double" matches Coffee template with double modifier)
- [ ] Falls back to individual food registry lookup if no template match
- [ ] Partial matches surface as suggestions (e.g. "toast" matches Toast template, offers modifier selection)
- [ ] Parser returns confidence score; low confidence items shown with warning badge
- [ ] Typecheck passes

---

### Voice Capture (Phase 2 — Deferred)

#### US-026: Built-in voice input

**Description:** As a user, I want a mic button that records my voice and converts it to text with AI cleanup.

**Acceptance Criteria (future):**

- [ ] Mic button in search bar area
- [ ] Records audio, sends to Whisper (or equivalent) for transcription
- [ ] AI post-processing: removes ums/ahs, fixes repetitions, handles self-corrections, adds punctuation
- [ ] Transcribed text feeds into the same AI text parser (US-024)
- [ ] Falls back gracefully if mic permission denied

**Status:** Deferred. User has working keyboard speech-to-text as interim solution. Text parser (US-024) is the priority.

---

### Seed Data

#### US-027: Pre-populate user's food registry

**Description:** As a user, I want my known ~30 foods pre-loaded with accurate portion and nutrition data.

**Acceptance Criteria:**

- [ ] The following foods exist in the registry with portion sizes, units, and nutrition per 100g:

**Bread & carbs:** toast (slice, 30g), plain pasta (100g), rice (100g), wraps (1 wrap), breadsticks, tostadas, chaelitos (piece), bread snacks

**Protein:** lean meat (100g), lean fish (100g), chicken broth (250ml), eggs (1 large, 60g), grated cheddar (30g), sliced cheddar (20g slice)

**Fruit & veg:** banana (1 medium, 120g), mashed pumpkin (100g), mashed potato (100g)

**Spreads & fats (teaspoon-measured):** butter (1 tsp, 5g), jam (1 tsp, 5g), peanut butter (1 tsp, 5g), cream cheese (1 tbsp, 10g), olive oil (1 tsp, 5ml)

**Seasoning:** salt (pinch), pepper (pinch), fine herbs (pinch)

**Drinks:** coffee (espresso shot), milk (50ml), sugar (1 tsp, 5g), tea (cup, 240ml), diluted juice (cup, 240ml), carbonated drink (can, 330ml)

- [ ] Teaspoon-to-gram conversions stored per ingredient where density varies
- [ ] Nutrition data sourced from McCance & Widdowson / USDA / Open Food Facts
- [ ] Two meal templates pre-created: Coffee (250ml) and Toast (2 slices)
- [ ] Typecheck passes

---

## 6. Design Considerations

### Visual language

- Follows existing dark theme (emerald, teal, orange, sky, violet accents on dark card backgrounds)
- Reference images: `pdh-light-mode-reference.png` and `pdh-dark-mode-reference.png` in `docs/plans/archive/Worktree spec/user-annotations/`
- Home page layout follows light-mode reference: greeting → nutrition summary → food chips → modifier chips → coach card

### Calorie + Fluid bar layout

```
┌──────────────────────────────────────────┐
│  ┌──────┐  795 / 1850 kcal  ████████░░  │
│  │ Ring │  1600 / 2000 ml   ██████████░  │
│  └──────┘                                │
└──────────────────────────────────────────┘
```

Ring = circular progress (existing). Bars = horizontal, stacked vertically beside the ring. Orange for calories, blue for fluids.

### View switching (Food page)

Views are **primary** — clicking Favourites replaces the entire content area. Not appended below existing content. Think tab switching, not accordion expanding.

### Meal ordering UI

The McDonald's model: base item shown with quantity stepper, modifiers shown as toggle chips below. Visual reference: fast-food ordering kiosks.

```
┌─────────────────────────────────┐
│  Coffee (250ml cup)             │
│  ─────────────────              │
│  espresso   [1 shot]  [+ −]    │
│  water      [200 ml]           │
│  milk       [50 ml]            │
│  ─────────────────              │
│  ADD:  [+sugar] [+extra shot]  │
│  SIZE: [250ml] [450ml]         │
│  ─────────────────              │
│  Total: 27 kcal                 │
│           [Add to staging]      │
└─────────────────────────────────┘
```

### Accessibility

- All interactive elements have aria-labels
- Heart buttons: `aria-label="Add {food} to favourites"` / `"Remove {food} from favourites"`
- View switcher buttons have `aria-pressed` state
- Meal ordering stepper has `aria-live="polite"` for quantity changes
- Tab navigation keyboard-accessible

### Mobile-first

- Bottom tab bar: 4 icons with labels
- All views work single-column on 375px viewport
- Food chips wrap naturally
- Staging modal is bottom-sheet style on mobile

---

## 7. Technical Considerations

### Existing infrastructure to reuse

| Component/Module               | Reuse as                        | Location                                                  |
| ------------------------------ | ------------------------------- | --------------------------------------------------------- |
| NutritionCard search (Fuse.js) | Home + Food search              | `src/components/track/nutrition/NutritionCard.tsx`        |
| useNutritionStore              | Staging state management        | `src/components/track/nutrition/useNutritionStore.ts`     |
| FoodRow                        | Universal food row component    | `src/components/track/nutrition/FoodRow.tsx`              |
| WaterModal                     | Water quick-action              | `src/components/track/nutrition/WaterModal.tsx`           |
| LogFoodModal                   | Staging review modal            | `src/components/track/nutrition/LogFoodModal.tsx`         |
| useFoodFavourites              | Favourite toggle logic          | `src/hooks/useProfile.ts`                                 |
| FavouritesView                 | Base for Food page favourites   | `src/components/track/nutrition/FavouritesView.tsx`       |
| FoodFilterView                 | Base for Food page filter       | `src/components/track/nutrition/FoodFilterView.tsx`       |
| CircularProgressRing           | Calorie ring                    | `src/components/track/nutrition/CircularProgressRing.tsx` |
| processLogInternal             | Backend food logging pipeline   | `convex/foodParsing.ts`                                   |
| foodLibrary table              | Meal template storage           | `convex/schema.ts`                                        |
| ingredientProfiles table       | Nutrition data per food         | `convex/schema.ts`                                        |
| foodRegistry (shared)          | Static food classification data | `src/shared/foodRegistry.ts`                              |

### Schema changes needed

1. **`foodLibrary` table** — extend with: `structuredIngredients`, `slotDefaults`, `modifiers`, `sizes` (all optional, widen-migrate-narrow)
2. **`ingredientProfiles` table** — add `tspToGrams` field for density-aware teaspoon conversions
3. **`profiles` table** — `foodFavourites` already exists as a flat `string[]`. Add `foodFavouriteSlotTags` as `Record<canonicalName, MealSlot[]>` to store auto-learned slot associations. When a favourited food is logged in a slot, that slot is added to its tags. Favourites view filters by `slotTags` for the active slot.
4. **No new tables** (per project convention)

### 50-item search cap

The current 50-item cap in search results is a UX guardrail. With ~300-400 foods in the registry, querying all is fine — Convex document bandwidth for a few hundred small documents is negligible cost. Remove the cap or raise to 500.

### AI text parser

- Convex action that calls Claude API with the user's food registry + meal templates as context
- Input: raw text string
- Output: structured array of `{ canonicalName, quantity, unit, matchedTemplate?, confidence }`
- Low confidence items flagged for user review
- Parser prompt includes the user's food list and meal templates for accurate matching

### Routing

- Uses TanStack Router (existing)
- New routes: `/` (Home), `/track`, `/food`, `/insights`
- `/settings` stays as-is but is no longer a tab — accessed via header gear icon
- Lazy-loaded route components (existing pattern for all routes except Track — see WQ-090)

---

## 8. Success Metrics

- Log a known meal (e.g. "Coffee 250, double, one sugar") in 3 taps or fewer from Home
- Log a simple food (e.g. toast x2 with butter) in under 5 taps from Home
- Heart toggle works on 100% of food rows across all views (zero dead hearts)
- (+) button stages and auto-navigates on 100% of food rows
- AI text parser correctly parses 90%+ of inputs matching known foods/templates
- End-of-day backfill logging from Food page is possible without workarounds

---

## 9. Phases

| Phase                            | Scope                                                                      | Depends on |
| -------------------------------- | -------------------------------------------------------------------------- | ---------- |
| **P1: Navigation**               | 4-tab layout, route restructure, Settings to header                        | Nothing    |
| **P2: Track simplification**     | Track = Today's Log only                                                   | P1         |
| **P3: Home page**                | Quick logging, nutrition bars, food/modifier chips, search, water, staging | P1         |
| **P4: Universal interactions**   | Fix heart toggle everywhere, (+) auto-navigate                             | P3         |
| **P5: Food page**                | Search (no cap), Favourites, Filter, view switching, food editing          | P1         |
| **P6: Seed data**                | Pre-populate registry, nutrition data                                      | P5         |
| **P7: Meal system (deferred)**   | Templates, base+modifiers, sizes, meal ordering UI, "Save as Meal"         | P5         |
| **P8: AI text parser**           | Natural language input, template matching, confirmation step               | P7         |
| **P9: Voice capture (deferred)** | Whisper integration, mic button, AI cleanup                                | P8         |

**Parallel tracks after P1:**

- P2 (Track simplification) and P3 (Home page) can run in parallel
- P5 (Food page) can start alongside P3
- P6 (Seed data) can start as soon as P5 schema work is done

**Deferred (user will weigh ingredients and build formulas manually first):**

- P7 (Meal system) — user needs to establish baseline weights and recipes before the app can model them
- P9 (Voice capture) — keyboard speech-to-text is the interim solution

---

## 10. Open Questions

### Resolved

1. ~~**Slot-scoped favourites vs. global favourites**~~ — **RESOLVED: Global list + auto-tagging.** Favourites are one global list. Foods get auto-tagged with meal slots based on logging history. Favourites view filters by the active slot's tags. No manual slot assignment needed.

2. ~~**Insights tab sub-tabs**~~ — **RESOLVED: Simple for now.** Two sub-tabs: Patterns (existing page as-is) + Dr. Poo Report (moved from Track). Full Insights redesign is a separate, deferred PRD.

3. ~~**Dr. Poo chat from Home**~~ — **RESOLVED: Two touchpoints.** Top: "Ask Dr. Poo" button (user-initiated). Bottom: proactive card with 150-char AI-summarized nudge (Dr. Poo-initiated). Card has "Got it" (dismiss) and "Chat with Dr. Poo" (opens chat). See US-010.

4. ~~**Quick Capture section**~~ — **RESOLVED: Stays on Home, streamlined.** No customisation. One-click log-and-done for daily regulars. See US-007b.

5. ~~**Portion unit conversions**~~ — **RESOLVED: User-measured.** User will weigh ingredients themselves and input the data. App stores the resulting gram values per portion unit. Standard lookup tables (McCance & Widdowson / USDA) used as starting points, user overrides as needed.

6. ~~**Meal template sharing across slots**~~ — **RESOLVED: One template, auto-tagged slots.** Same auto-tagging mechanism as favourites. A Coffee template gets tagged for breakfast, lunch, snack based on when it's been logged. Slot-specific defaults (slotDefaults field) can optionally override portions per slot when the meal system is built.

### Still Open

7. **Insights full redesign scope** — Peter mentioned reports, food safety, food categorisation, menu planning, meal building, exports as future Insights sub-tabs. Needs its own PRD when the time comes.

8. **Desktop layout** — Should Home and Track show side-by-side on wide screens, or always single-page? Current Track is a 3-column layout; the new design is mobile-first single-column. Desktop treatment TBD.

9. **Coach summary card on Home** — The design reference shows a coach section with "Observations, Reflective Questions, Encouragement, Results." Is this the same as the Dr. Poo proactive card, or a separate section? If separate, what feeds it?
