# ADR-0002: Food Registry and Canonicalization System

## Status

**Accepted and implemented.** Registry, canonicalization, evidence pipeline, Convex migration, and server-side food pipeline are all complete. Transit map UI (Phase 5) continues separately.

Implementation history (phases 1-4, server pipeline, audit addenda) archived to `docs/archive/0002-implementation-log.md`.

## Context

The app tracks what a user eats and correlates food intake and lifestyle contributing factors with digestive
outcomes (Bristol Stool Scale, transit time, symptoms). For this to work,
multiple entries that represent the same food must be grouped under a single
**canonical name** — the tracking unit.

The legacy system had `foodCanonicalization.ts` with a hand-written
`CanonicalFood` union type and a flat array of regex rules. It had two
structural problems:

1. **Fine-grained canonicals that prevented trial accumulation.** "Scrambled
   egg", "poached egg", and "omelette" were all separate canonicals. A user
   who ate five different egg preparations would need 3–5 trials behind each
   one before the transit map showed anything meaningful. This was wrong:
   all no-added-fat egg preparations are digestively equivalent and should
   accumulate trials together under a single canonical `"egg"`.

2. **No single source of truth.** The `CanonicalFood` type, the `RULES` array,
   and the test fixtures were three separate places to maintain. Adding a food
   meant updating all three independently.

Additionally, the system had no concept of **dietary zones** — which foods are
safe for a post-anastomosis patient in week 1 vs week 8 vs long-term. The
transit map needed a clinical basis for zone assignment.

## Decision

### 1. A single food registry as the source of truth

`shared/foodRegistry.ts` defines every canonical food the system recognises.
All other food-related modules derive their data from this file. To add,
rename, or reclassify a food, only this file changes.

Each entry carries:

```typescript
interface FoodRegistryEntry {
  canonical: string; // the tracking unit
  zone: FoodZone; // 1 | 2 | 3
  subzone?: FoodSubzone; // "1A" | "1B" — only set for zone 1
  category: FoodCategory; // nutritional category (retained as secondary metadata)
  subcategory: FoodSubcategory;
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: FoodRiskLevel;
  fiberSolubleLevel?: FoodRiskLevel;
  gasProducing?: FoodGasLevel;
  dryTexture?: FoodDryTextureLevel;
  irritantLoad?: FoodRiskLevel;
  highFatRisk?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
  examples: ReadonlyArray<string>; // natural-language phrases → this canonical
  group: FoodGroup; // macronutrient group: "protein" | "carbs" | "fats" | "seasoning"
  line: FoodLine; // sub-line within group (e.g. "meat_fish", "grains", "dairy_fats")
  lineOrder: number; // suggested exploration order within the sub-line (1 = try first)
  notes?: string;
}
```

> **Phase 2.5 change (2026-03-12):** `line: TransitLine` was replaced with
> `group: FoodGroup` + `line: FoodLine`. The flat 7-value `TransitLine` type
> ("hub", "protein", "grain", etc.) was replaced with a two-level hierarchy:
> 4 macronutrient groups containing 11 sub-lines. See section 6 below.

### 2. Collapsed canonicals based on digestive equivalence

The canonical grouping principle is: **same digestive profile = same
canonical**. Preparation method is only a separate canonical when it
meaningfully changes the digestive load.

| User input         | Canonical                                              |
| ------------------ | ------------------------------------------------------ |
| "scrambled eggs"   | `"egg"`                                                |
| "six poached eggs" | `"egg"`                                                |
| "two egg omelette" | `"egg"`                                                |
| "fried egg"        | `"fried egg"` (added fat = different profile)          |
| "boiled chicken"   | `"boiled white meat"`                                  |
| "grilled chicken"  | `"grilled white meat"` (different zone, different fat) |

### 3. Three-zone model — clinical geography, not gates

Zone assignment is derived from post-anastomosis dietary guidelines (NHS
low-residue diet leaflets, UCSF ileostomy diet, Bowel Cancer Australia, Leeds
Teaching Hospitals). The zones:

- **Zone 1A** – Clear/full liquids. Immediate post-op.
- **Zone 1B** – Soft, low-residue solids. <2g fibre/serving. No skins, seeds,
  hulls, spice.
- **Zone 2** – Expanded but defensive. Peeled/well-cooked veg, more protein
  preparations, mild herbs/spices. No garlic, onion, chili, fried foods,
  legumes, raw salads.
- **Zone 3** – Everything else. Higher residue, stronger spice, fried foods,
  legumes, raw veg, fast food.

**Zones are suggested introduction order, not permission gates.**

A user can log and trial any food at any time, regardless of its zone. The zone
is metadata — it tells the transit map where a station sits on the network and
informs the suggested order of exploration. It does not restrict logging or
penalise choices.

The progression is non-linear by design. Some users tolerate Zone 2 foods
before fully exploring Zone 1. Some Zone 3 foods suit certain users better than
some Zone 2 foods, depending on individual physiology, lifestyle factors
(smoking, stimulants, exercise, stress), and gut state on any given day.

**The app records, correlates, and celebrates. It never blocks.**

The key rule for moving a food from Zone 3 → Zone 2 is **peeling + thorough
cooking**: many vegetables become low-residue once skin and seeds are removed
and the flesh is cooked soft. Zone membership is about the food's typical
digestive profile, not about where in their journey the user is.

### 4. Dual-path canonicalization

The system supports two resolution paths that share the same registry:

**Deterministic path** (`canonicalizeKnownFoodName` in
`shared/foodCanonicalization.ts`): builds a lookup map from every example string in
the registry → canonical. O(1) lookup after normalization. Returns
`string | null` — null means "not recognised, escalate to LLM".

**Food-parsing LLM path** (`src/lib/foodLlmCanonicalization.ts` for prompt
utilities, `convex/foodLlmMatching.ts` for runtime matching): the registry's
canonicals, examples, zones, and categories are formatted into the LLM system
prompt as a vocabulary table the model must select from. After the LLM responds,
`postProcessCanonical` resolves the result against the registry deterministically.
The model returns a canonical name or null.

**Dr. Poo report path** (`src/lib/aiAnalysis.ts` + `convex/extractInsightData.ts`):
the narrative report model does **not** receive a full registry dump. Instead,
it receives canonical hints from food-log items and the `foodTrialDatabase`.
The prompt now requires canonical food labels whenever available and requires
patient-facing food verdicts to be mirrored into structured `foodAssessments`.
The extractor also repairs partial reports by canonicalizing and splitting
combined labels such as `"toast / white bread"` into separate structured rows.

The return type `string | null` (replacing the previous `string` fallback) is
intentional: a null explicitly signals "pass to LLM", rather than silently
falling back to the raw input as a pseudo-canonical.

**2026-03-13 parser follow-up:** runtime food parsing is now
**deterministic-first, registry-first**. Simple known inputs are resolved
locally and only unresolved fragments are sent to GPT-5 mini. GPT is therefore
the fallback parser for unresolved or ambiguous input, not the primary parser.

### 5. Normalized alias injectivity

Normalized aliases must map to exactly one canonical.

The earlier first-match-wins behaviour was rejected because it silently hid
registry mistakes and produced wrong deterministic classifications when two
canonicals shared the same normalized alias. This was observed with collisions
including `"chili"`, `"rice cake"`, and `"mild herb"`.

The current rule is:

- Remove ambiguous duplicate aliases from the registry.
- Reject future duplicate normalized aliases at load/test time.
- Treat alias collisions as registry errors, not runtime tie-break cases.

### 6. Hierarchical food grouping — groups and sub-lines

> Added 2026-03-12 (Phase 2.5). Replaces the flat `TransitLine` model.

The transit map is not one big map of all foods. It is a **set of per-subcategory
line maps**. The user taps a food group (e.g. "Carbs") and sees multiple sub-lines.
They tap a specific sub-line (e.g. "Vegetables") and see that line's zone progression.

The data model is hierarchical: **Group → Line → Station**.

**4 macronutrient groups, 11 sub-lines:**

| Group         | Sub-lines                                    | Purpose                          |
| ------------- | -------------------------------------------- | -------------------------------- |
| **Protein**   | Meat & Fish, Eggs & Dairy, Vegetable Protein | Animal and plant protein sources |
| **Carbs**     | Grains, Vegetables, Fruit                    | Carbohydrate-dominant foods      |
| **Fats**      | Oils, Dairy Fats, Nuts & Seeds               | Fat-dominant foods               |
| **Seasoning** | Sauces & Condiments, Herbs & Spices          | Flavourings and aromatics        |

```typescript
type FoodGroup = "protein" | "carbs" | "fats" | "seasoning";

type FoodLine =
  | "meat_fish"
  | "eggs_dairy"
  | "vegetable_protein" // Protein
  | "grains"
  | "vegetables"
  | "fruit" // Carbs
  | "oils"
  | "dairy_fats"
  | "nuts_seeds" // Fats
  | "sauces_condiments"
  | "herbs_spices"; // Seasoning
```

**Key classification decisions:**

- **Garlic** → Herbs & Spices (Seasoning), not Vegetables. It is a herb.
- **Onion** → Vegetables (Carbs). It is a vegetable/salad item.
- **Dairy is split**: yogurt, cottage cheese, milk, kefir → Eggs & Dairy (Protein).
  Butter, cream, hard cheese, cream cheese, soft rind cheese → Dairy Fats (Fats).
- **Salad** is not a separate sub-line. Raw salad items are Zone 2–3 stations on the
  Vegetables line.
- **Avocado** → Nuts & Seeds (Fats).

**Liquids (Zone 1A)** — water, broth, juice, herbal tea, nutritional supplement —
are tracked in the app but **not mapped as stations** on the transit map. They are
the pre-map starting point that every anastomosis patient learns in hospital.
Milk and kefir are not liquids — they belong under Eggs & Dairy (Protein).

**Interchanges** are structural zone-boundary nodes on the visual map (Zone 1→2,
Zone 2→3). They are not food items and do not appear in the data model.

**Why this replaces the flat model:** The original `TransitLine` had 7 values
mixing macronutrient groups with subcategories ("protein" alongside "grain",
"vegetable", "fruit"). It also included "hub" for liquids that shouldn't be on
the map. The hierarchical model correctly separates the grouping level (what tab
the user sees) from the line level (what track they follow within that tab).

## Consequences

### Positive

- Adding a food requires one file change in one place.
- The LLM prompt vocabulary is always in sync with the deterministic rules.
- Trial data accumulates faster because preparations that are digestively
  equivalent are grouped.
- Zone assignment has a documented clinical basis.
- Known-food parsing is cheaper, faster, and more predictable because GPT is
  only used for unresolved fragments.
- Raw user-entered names can be preserved in logs/history while canonicals
  continue to power evidence and aggregation.

### Tradeoffs

- `CanonicalFood` is no longer a TypeScript union type (would require
  `as const` inference on a 100+ entry array). It is now `string` validated at
  runtime via `CANONICAL_FOOD_NAMES: ReadonlySet<string>`.
- `canonicalizeKnownFoodName` now returns `string | null` instead of `string`,
  which is a breaking change from the legacy API. Callers that relied on the
  old fallback-to-input behaviour need updating.
- Registry maintenance is stricter: duplicate normalized aliases now fail fast
  instead of being tolerated by ordering.

## Key Files

| File                                         | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                     | Single source of truth (all canonicals, zones, groups, lines, metadata) |
| `shared/foodCanonicalization.ts`             | Deterministic lookup from registry. Returns `string \| null`.           |
| `shared/foodNormalize.ts`                    | Text normalization utilities                                            |
| `shared/foodEvidence.ts`                     | Bayesian evidence pipeline (registry-aware)                             |
| `shared/foodParsing.ts`                      | Shared deterministic parsing utilities                                  |
| `convex/foodParsing.ts`                      | Server mutations (processLog, processEvidence, resolveItem)             |
| `convex/foodLlmMatching.ts`                  | LLM action with web search (fallback for unresolved food)               |
| `src/lib/foodLlmCanonicalization.ts`         | Builds LLM prompt vocabulary from registry                              |
| `src/components/track/FoodMatchingModal.tsx` | Manual user resolution UI                                               |
| `docs/research/food-zone-phase.md`           | Clinical research basis for zone assignments                            |

## Research Basis

Primary sources: NHS Trust low-residue and ileostomy diet leaflets (Leeds, UCSF, Torbay, Bowel Cancer Australia), PMC review on ileostomy dietary management (2025), Academy of Nutrition and Dietetics low-fibre handout (UPenn), FOWUSA diet guide. Full citations in `docs/research/food-zone-phase.md`.

## Current Architectural Understanding

The food system is:

- **Registry-first** for canonical food identity
- **Deterministic-first** for routine parsing and matching
- **LLM-assisted** only for unresolved or ambiguous food parsing
- **Prompt-constrained and extraction-repaired** for Dr. Poo report food verdicts
- **Canonical-internal but raw-name-preserving** where user-facing history benefits from the original phrasing

## Implementation History

Phases 1-4, server pipeline (11/11 tasks), verification audits, and addenda are archived in `docs/archive/0002-implementation-log.md`.
