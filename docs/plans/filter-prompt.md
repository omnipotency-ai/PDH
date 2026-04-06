> **Ref:** `docs/plans/filter-prompt.md`
> **Updated:** 2026-04-05
> **Version:** 1.0
> **History:** v1.0 (2026-04-05) — standardized doc header

# Food Registry Multi-Filter System

> **Status:** NOT STARTED — this is Data Integration Plan Wave 2. Depends on nothing; can begin when Meal Logging (Wave 1) is stable.
>
> Design prompt for implementing a composable, multi-dimensional filter bar
> for the PDH food registry database. Based on the Linear-style filter pattern
> (chip-based: `[Type] [operator] [value(s)] [x]`).

## Registry Data Model (what we're filtering)

### Row Identity (composite key)

```
canonical + mechanicalForm + cookingMethod + skin
```

Example: `"potato" + "chipped" + "deep_fried" + "skin_on"` = one unique row.

### Entry Shape

```typescript
interface FoodRegistryEntry {
  // ── Identity ──
  canonical: string; // "potato", "chicken light meat", "coca-cola"
  displayName: string; // "Deep Fried Chips (skin on)"
  type: "food" | "liquid";

  // ── Preparation ──
  mechanicalForm: MechanicalForm;
  cookingMethod: CookingMethod;
  skin: "on" | "off" | "n/a";

  // ── Classification ──
  macros: Macro[]; // ["carbohydrate"] or ["protein", "fat"]
  subcategory: FoodSubcategory; // "root_vegetable", "poultry", "fizzy_drink"
  zone: 1 | 2 | 3;
  tags: string[]; // ["caffeinated", "nightshade", "fermented", ...]

  // ── Digestion Risk (graduated scales) ──
  osmoticEffect?: RiskLevel;
  fodmapLevel?: RiskLevel;
  totalResidue?: ResidueLevel;
  fiberTotalG?: number;
  fiberSolubleLevel?: RiskLevel;
  fiberInsolubleLevel?: RiskLevel;
  gasProducing?: GasLevel;
  dryTexture?: DryTextureLevel;
  irritantLoad?: RiskLevel;
  highFatRisk?: RiskLevel;
  lactoseRisk?: RiskLevel;

  // ── Nutrition (per 100g — populated later from external DB) ──
  kcal?: number;
  proteinG?: number;
  fatG?: number;
  saturatedFatG?: number;
  carbsG?: number;
  sugarsG?: number;
  fiberG?: number;
  saltG?: number;
  // Future: vitaminA, vitaminC, iron, calcium, ...

  // ── User Status (from trial tracking) ──
  status?: FoodStatus;
  baseline?: boolean; // confirmed stable control food
}
```

### Enums

```typescript
type MechanicalForm =
  | "whole" // intact — apple, whole potato, whole chicken
  | "mashed_pureed" // potato, veg
  | "diced_chopped_sliced" // meat, veg, nuts
  | "ground_minced" // spices, herbs, coffee, meat
  | "blended" // smoothies, soups, fully cooked meals
  | "juiced"; // fruits and veg, no pulp

type CookingMethod =
  | "raw" // uncooked
  | "al_dente" // partial cook
  | "wet_heat" // boiled, steamed, poached
  | "dry_heat_no_oil" // baked, roasted, grilled, barbecued
  | "shallow_fried" // sauteed, pan-fried, little oil
  | "deep_fried" // submerged in oil — changes fat composition
  | "processed"; // arrives ready-to-eat (Coca-Cola, cured ham, etc.)

type Macro = "carbohydrate" | "protein" | "fat";

type FoodStatus =
  | "building" // currently being trialled
  | "like" // tolerated well + like the taste
  | "dislike" // tolerated well + don't like the taste
  | "watch" // like the taste + don't tolerate well
  | "avoid"; // don't like + don't tolerate

// Foods with no status are untested.

type RiskLevel =
  | "none"
  | "low"
  | "low_moderate"
  | "moderate"
  | "moderate_high"
  | "high";
type ResidueLevel = "very_low" | "low" | "low_moderate" | "moderate" | "high";
type GasLevel = "no" | "possible" | "yes";
type DryTextureLevel = "no" | "low" | "yes";
```

---

## Filter System Design

### Architecture

Each active filter is a composable chip rendered in a horizontal bar:

```
[Zone] [is] [1, 2] [x]  [Macros] [include any of] [protein] [x]  [Tags] [exclude] [caffeinated] [x]  [+ Filter]
```

Clicking `[+ Filter]` opens a popover with grouped filter types.
Each chip has: **type label** → **operator dropdown** → **value combobox** → **remove button**.

### Filter Types

```typescript
enum FilterType {
  // ── Classification ──
  ZONE = "Zone",
  TYPE = "Type",
  MACROS = "Macros",
  SUBCATEGORY = "Subcategory",
  STATUS = "Status",

  // ── Preparation ──
  MECHANICAL_FORM = "Form",
  COOKING_METHOD = "Cooking",
  SKIN = "Skin",

  // ── Digestion Risk ──
  OSMOTIC_EFFECT = "Osmotic",
  FODMAP_LEVEL = "FODMAP",
  RESIDUE = "Residue",
  GAS_PRODUCING = "Gas",
  FAT_RISK = "Fat risk",
  IRRITANT_LOAD = "Irritant",
  LACTOSE_RISK = "Lactose",

  // ── Nutrition (numeric) ──
  FIBRE = "Fibre (g)",
  KCAL = "Calories",

  // ── Tags ──
  TAGS = "Tags",
}
```

### Operators Per Filter Type

```typescript
function getOperators(
  filterType: FilterType,
  selectedCount: number,
): FilterOperator[] {
  switch (filterType) {
    // Single-value enums
    case FilterType.ZONE:
    case FilterType.TYPE:
    case FilterType.SKIN:
    case FilterType.GAS_PRODUCING:
      return selectedCount > 1
        ? [FilterOperator.IS_ANY_OF, FilterOperator.IS_NOT]
        : [FilterOperator.IS, FilterOperator.IS_NOT];

    // Multi-value arrays (macros, tags)
    case FilterType.MACROS:
    case FilterType.TAGS:
      return selectedCount > 1
        ? [
            FilterOperator.INCLUDE_ANY_OF,
            FilterOperator.INCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_IF_ANY_OF,
          ]
        : [FilterOperator.INCLUDE, FilterOperator.DO_NOT_INCLUDE];

    // Graduated scales (osmotic, FODMAP, residue, etc.)
    case FilterType.OSMOTIC_EFFECT:
    case FilterType.FODMAP_LEVEL:
    case FilterType.RESIDUE:
    case FilterType.FAT_RISK:
    case FilterType.IRRITANT_LOAD:
    case FilterType.LACTOSE_RISK:
    case FilterType.STATUS:
    case FilterType.MECHANICAL_FORM:
    case FilterType.COOKING_METHOD:
    case FilterType.SUBCATEGORY:
      return selectedCount > 1
        ? [FilterOperator.IS_ANY_OF, FilterOperator.IS_NOT]
        : [FilterOperator.IS, FilterOperator.IS_NOT];

    // Numeric thresholds
    case FilterType.FIBRE:
    case FilterType.KCAL:
      return [FilterOperator.ABOVE, FilterOperator.BELOW];
  }
}
```

### Filter Operators

```typescript
enum FilterOperator {
  // Single/multi enum
  IS = "is",
  IS_NOT = "is not",
  IS_ANY_OF = "is any of",

  // Array membership (macros, tags)
  INCLUDE = "include",
  DO_NOT_INCLUDE = "do not include",
  INCLUDE_ALL_OF = "include all of",
  INCLUDE_ANY_OF = "include any of",
  EXCLUDE_ALL_OF = "exclude all of",
  EXCLUDE_IF_ANY_OF = "exclude if any of",

  // Numeric
  ABOVE = "above",
  BELOW = "below",
}
```

### Filter Value Options

```typescript
const filterValueOptions: Record<FilterType, FilterOption[]> = {
  [FilterType.ZONE]: [
    { name: "1", label: "Early recovery" },
    { name: "2", label: "Expanding" },
    { name: "3", label: "Experimental" },
  ],
  [FilterType.TYPE]: [{ name: "food" }, { name: "liquid" }],
  [FilterType.MACROS]: [
    { name: "carbohydrate", label: "Carbs" },
    { name: "protein" },
    { name: "fat" },
  ],
  [FilterType.SUBCATEGORY]: [
    // Populated from registry — all unique subcategory values
  ],
  [FilterType.STATUS]: [
    { name: "building", label: "Currently testing" },
    { name: "like", label: "Safe + like" },
    { name: "dislike", label: "Safe + don't like" },
    { name: "watch", label: "Like + don't tolerate" },
    { name: "avoid", label: "Don't like + don't tolerate" },
  ],
  [FilterType.MECHANICAL_FORM]: [
    { name: "whole" },
    { name: "mashed_pureed", label: "Mashed / pureed" },
    { name: "diced_chopped_sliced", label: "Diced / chopped" },
    { name: "ground_minced", label: "Ground / minced" },
    { name: "blended" },
    { name: "juiced" },
  ],
  [FilterType.COOKING_METHOD]: [
    { name: "raw" },
    { name: "al_dente", label: "Al dente" },
    { name: "wet_heat", label: "Boiled / steamed" },
    { name: "dry_heat_no_oil", label: "Baked / grilled" },
    { name: "shallow_fried", label: "Pan-fried / sauteed" },
    { name: "deep_fried", label: "Deep fried" },
    { name: "processed", label: "Processed / ready-made" },
  ],
  [FilterType.SKIN]: [
    { name: "on", label: "Skin on" },
    { name: "off", label: "Skin off" },
    { name: "n/a" },
  ],

  // Graduated risk scales — all share the same options
  [FilterType.OSMOTIC_EFFECT]: RISK_LEVEL_OPTIONS,
  [FilterType.FODMAP_LEVEL]: RISK_LEVEL_OPTIONS,
  [FilterType.FAT_RISK]: RISK_LEVEL_OPTIONS,
  [FilterType.IRRITANT_LOAD]: RISK_LEVEL_OPTIONS,
  [FilterType.LACTOSE_RISK]: RISK_LEVEL_OPTIONS,
  [FilterType.RESIDUE]: RESIDUE_LEVEL_OPTIONS,
  [FilterType.GAS_PRODUCING]: [
    { name: "no" },
    { name: "possible" },
    { name: "yes" },
  ],

  // Numeric — rendered as input field, not combobox
  [FilterType.FIBRE]: [],
  [FilterType.KCAL]: [],

  // Tags — populated dynamically from all unique tags in registry
  [FilterType.TAGS]: [],
};

const RISK_LEVEL_OPTIONS: FilterOption[] = [
  { name: "none" },
  { name: "low" },
  { name: "low_moderate", label: "Low–moderate" },
  { name: "moderate" },
  { name: "moderate_high", label: "Moderate–high" },
  { name: "high" },
];

const RESIDUE_LEVEL_OPTIONS: FilterOption[] = [
  { name: "very_low", label: "Very low" },
  { name: "low" },
  { name: "low_moderate", label: "Low–moderate" },
  { name: "moderate" },
  { name: "high" },
];
```

### Filter Popover Groups

When clicking the `[+ Filter]` button, the popover shows filter types
organised into groups with separators:

```typescript
const filterViewGroups: FilterOption[][] = [
  // ── Classification ──
  [
    { name: FilterType.ZONE, icon: <MapPin /> },
    { name: FilterType.TYPE, icon: <Droplets /> },
    { name: FilterType.MACROS, icon: <Dna /> },
    { name: FilterType.SUBCATEGORY, icon: <Apple /> },
    { name: FilterType.STATUS, icon: <Heart /> },
  ],
  // ── Preparation ──
  [
    { name: FilterType.MECHANICAL_FORM, icon: <Scissors /> },
    { name: FilterType.COOKING_METHOD, icon: <Flame /> },
    { name: FilterType.SKIN, icon: <Layers /> },
  ],
  // ── Digestion Risk ──
  [
    { name: FilterType.OSMOTIC_EFFECT, icon: <Waves /> },
    { name: FilterType.FODMAP_LEVEL, icon: <Beaker /> },
    { name: FilterType.RESIDUE, icon: <Leaf /> },
    { name: FilterType.GAS_PRODUCING, icon: <Wind /> },
    { name: FilterType.FAT_RISK, icon: <CircleDot /> },
    { name: FilterType.IRRITANT_LOAD, icon: <Zap /> },
    { name: FilterType.LACTOSE_RISK, icon: <Milk /> },
  ],
  // ── Nutrition ──
  [
    { name: FilterType.FIBRE, icon: <Wheat /> },
    { name: FilterType.KCAL, icon: <Gauge /> },
  ],
  // ── Tags ──
  [
    { name: FilterType.TAGS, icon: <Tag /> },
  ],
];
```

---

## Example Queries

| Goal                         | Filters                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Zone 1 caffeine-free options | `Zone is 1` + `Tags do not include caffeinated`                               |
| Lean protein, wet heat only  | `Macros include protein` + `Fat Risk is none, low` + `Cooking is wet_heat`    |
| Safest foods for a bad day   | `FODMAP is none, low` + `Gas is no` + `Osmotic is none, low` + `Zone is 1, 2` |
| Nightshade elimination check | `Tags include nightshade`                                                     |
| What's confirmed safe?       | `Status is any of like, dislike`                                              |
| High-fibre safe foods        | `Fibre above 3` + `Status is any of like, dislike`                            |
| Everything I can deep fry    | `Cooking is deep_fried`                                                       |
| Baseline control foods       | `Status is like` + (baseline flag = true, handled separately)                 |
| Low-residue liquids          | `Type is liquid` + `Residue is very_low, low`                                 |

---

## Implementation Notes

### Stack compatibility

- Project uses React + Vite + Tailwind v4 + shadcn/ui (Base UI migration underway)
- Existing UI components: Popover, DropdownMenu, Command (cmdk), Checkbox, Button
- Animation: `motion/react` (framer-motion successor) — already in the project
- IDs: use `crypto.randomUUID()` (no nanoid dependency needed)

### What to reuse from the original filter component

- `AnimateChangeInHeight` wrapper (ResizeObserver-based)
- `FilterOperatorDropdown` pattern (dropdown for operator selection)
- `FilterValueCombobox` pattern (searchable multi-select for values)
- The composable chip layout (`[type] [operator] [values] [x]`)

### What to change

- Replace all Linear-specific enums (Status, Assignee, Priority, Labels, DueDate) with food registry enums
- Replace `FilterIcon` with food-domain icons (lucide-react)
- Add `FilterValueNumericInput` component for Fibre/Kcal (threshold input instead of combobox)
- Tags combobox should be dynamically populated from all unique tags in the registry
- Subcategory combobox should be dynamically populated from all unique subcategories
- Filter state integrates with TanStack React Table's `ColumnFiltersState` on the Patterns database page

### What to delete

- The existing `FilterSheet.tsx` sliding panel — replaced by this inline filter bar
- The existing `SmartViews` system if it conflicts (or adapt it to save filter presets)

### Numeric filter component

For Fibre and Kcal, render an input field instead of a combobox:

```
[Fibre (g)] [above] [3___] [x]
```

The input accepts a number. The operator is `above` or `below`.

### Tag management

Tags are free-form strings stored as arrays on registry entries.
The filter combobox collects all unique tags across the registry and presents them.
Common tags to seed: `caffeinated`, `nightshade`, `cruciferous`, `fermented`,
`gluten_containing`, `lactose_containing`, `high_histamine`, `added_sugar`,
`whole_grain`, `refined`.

### Baseline flag

The `baseline` boolean is not a filter type in the bar — it's a toggle
or secondary indicator on the database table. A food marked baseline
is visually distinct (e.g., a small anchor icon) and can be toggled
via a separate control, not the filter system.
