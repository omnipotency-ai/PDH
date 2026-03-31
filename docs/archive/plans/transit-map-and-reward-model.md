# Transit Map & Reward Model — Design Reference

**Date:** 2026-03-12  
**Status:** Design intent captured. 4-group/11-line hierarchy implemented in Phase 2.5. Transit map UI deleted — will be rebuilt in Phase 5.  
**Related:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Food System Rebuild](./food-system-rebuild.md)

---

## The transit map metaphor

The transit map is a **historical record of where the user has been**, not a live
journey or a progress gate. Think of it as a tube map showing every station you
have ever visited — not which line you are currently riding.

Each **station** is a canonical food from the registry. Its **zone** determines
which part of the network it sits in (Zone 1 = central lines, Zone 2 = outer
network, Zone 3 = the wild periphery). Its **status** determines its colour.

### Station status colours

| Colour             | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Grey               | Never trialled. Station not yet visited.                                      |
| Blue               | Trialling — fewer than the minimum resolved trials. Still gathering evidence. |
| Green              | Safe. Consistently good outcomes across trials.                               |
| Green (teal)       | Safe-loose. Good outcomes but tends toward loose stools.                      |
| Green (amber tint) | Safe-hard. Good outcomes but tends toward firm/hard.                          |
| Amber / Orange     | Watch. One or more concerning outcomes. More trials needed.                   |
| Red                | Avoid. Consistent bad outcomes. Strong evidence against.                      |

### What "visited" means

A station is visited the first time a user logs that food. Its colour updates
as evidence accumulates. A station can move from grey → blue → green, or grey
→ blue → orange → red, depending on what the trials show.

Visiting a station is always a win — even if it ends up red, that's valuable
information.

---

## The reward model

The app is designed with ADHD and reward/game theory in mind. Celebrations fire
on **information gain**, not on compliance or "good" behaviour.

### Milestone triggers

| Milestone                                              | Celebration reason                           |
| ------------------------------------------------------ | -------------------------------------------- |
| First food logged ever                                 | Starting the journey                         |
| First food trialled (resolved)                         | First completed experiment                   |
| Zone 1 complete on a sub-line                          | Explored the safe core for this food type    |
| 5 stations green                                       | Building a safe menu                         |
| 10 stations any status                                 | Active explorer                              |
| First station turned red / avoid                       | Detective work done. You know what to avoid. |
| First station turned orange / watch                    | Suspicious! More trials needed.              |
| First station cleared (orange → green)                 | Vindicated! It was fine after all.           |
| All sub-lines in a group have Zone 1 stations visited  | Group foundations complete                   |
| Full sub-line complete (all zones visited)             | Sub-line mastered                            |
| First Zone 3 station trialled                          | Adventurous                                  |
| Longest trial streak (N consecutive days with a trial) | Consistent                                   |

### Design principles for celebrations

- **A red station is not a failure.** Knowing a food causes diarrhea is useful,
  actionable data. It belongs on the avoid list. The user is safer for knowing.
  Celebrate it.
- **Negative discoveries deserve the same celebration as positive ones.**
  The detective framing: every resolved trial is a case closed.
- **No punishment for eating anything.** The system never warns against eating
  a Zone 3 food before the user has trialled Zone 1. It may note "this is a
  Zone 3 food — here's what that means" but it never blocks or scolds.
- **Small wins matter.** First log, first trial, first green station — each gets
  its own moment. Users with ADHD benefit from frequent, low-threshold rewards.

---

## What the transit map is NOT

- **Not a live journey indicator.** There is no "you are here" pin showing the
  current food in transit. Transit times are shown as evidence summaries, not
  as a live countdown.
- **Not a progression lock.** Zone 3 stations are visible and accessible from
  day one. The user can see what's out there and choose their own path.
- **Not punitive.** No red warning before eating. No blocked actions. No shame.

---

## Current implementation state

The transit map UI exists in the codebase but uses **mock/static data** from the
broken legacy engine. It is not wired to Convex. The legacy engine's data was
wrong — none of the analytics, transit times, or food statuses it produced were
usable.

The legacy transit map UI (`TransitMap.tsx`, `StationDetailPanel.tsx`,
`TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) was **deleted
in Phase 2.5**. The transit map will be rebuilt from scratch in Phase 5 using
the new registry hierarchy and correct data.

**Do not use any legacy transit map data for product decisions.**

---

## Hierarchical structure — Groups, Lines, and Stations

> Updated 2026-03-12 (Phase 2.5 — complete). Replaces the flat 6-line model.

The transit map is **not one big map of 100 foods**. It is a set of
per-subcategory line maps. The user taps a food group (e.g. "Carbs") and sees
multiple sub-lines on one map. They tap a specific sub-line (e.g. "Vegetables")
and see just that line with its zone progression.

The data model is hierarchical: **Group → Line → Station**.

### The four macronutrient groups

| Group         | Sub-lines                                    | Clinical purpose                                        |
| ------------- | -------------------------------------------- | ------------------------------------------------------- |
| **Protein**   | Meat & Fish, Eggs & Dairy, Vegetable Protein | Users can see if they're getting enough protein sources |
| **Carbs**     | Grains, Vegetables, Fruit                    | Users can see carbohydrate variety and balance          |
| **Fats**      | Oils, Dairy Fats, Nuts & Seeds               | Users can see if they're missing fat sources            |
| **Seasoning** | Sauces & Condiments, Herbs & Spices          | Users can track flavouring tolerance                    |

These groups serve a clinical purpose: even when regressed to basic foods, a user
can see at a glance whether they have a balanced diet across macronutrient groups.

### Per-line independent progression

**Progression is per line, not global.**

Each sub-line has its own sequence of stations, and a user travels each line
independently. They can be at completely different stages on different lines
simultaneously — this is normal and expected.

Example: a user might be at Zone 3 on the Meat & Fish line (they eat air-fried
chicken wings fine) while still at Zone 1 on the Vegetables line (cooked carrot
is as adventurous as they get). The map shows both lines accurately. There is
no "complete Zone 1 before Zone 2" gate.

### Per-line zone structure (the visual concept)

Each sub-line view shows:

- **Zone 1**: A single track, 2–4 stations. Safest, most basic preparations.
- **Interchange node**: Visual zone boundary (structural, not a food). Zone 1 → 2.
- **Zone 2**: Track splits into 2–3 branches. More stations, more adventurous
  preparations. Visually metro-like with parallel tracks and interchanges.
- **Interchange node**: Zone 2 → 3 boundary.
- **Zone 3**: 1–2 lines, fewer stations. Key foods only (fried, raw, spicy
  variants). Arrows indicating "and beyond."

Each view is small and manageable: ~10–15 stations per sub-line, not 100 foods
on one page. This is buildable and useful.

### Key classification decisions

- **Garlic** → Herbs & Spices (Seasoning). It is a herb.
- **Onion** → Vegetables (Carbs). It is a vegetable.
- **Dairy is split**: yogurt, cottage cheese, milk, kefir → Eggs & Dairy
  (Protein). Butter, cream, hard cheese, cream cheese, soft rind cheese →
  Dairy Fats (Fats).
- **Salad** is not a separate sub-line. Raw salad items are Zone 2–3 stations
  on the Vegetables line.
- **Avocado** → Nuts & Seeds (Fats).

### What "next station" means in the UI

The map should make it easy for a user to see:

- Which stations on each line they have visited (any colour other than grey)
- The next unvisited station on each line
- Their overall coverage per line and per group as a simple progress indicator

This gives users with ADHD a clear, low-friction answer to "what should I try
next?" without overwhelming them with the full food list at once.

---

## Liquids — tracked, not mapped

Zone 1A liquids (water, broth, juice, herbal tea, nutritional supplement) are
the pre-map starting point. Every anastomosis patient learns these in hospital
before discharge. They are tracked in the app but **do not appear as stations**
on the transit map.

They may appear as:

- A reference card or tooltip within the map view
- A single introductory "Liquids" node with tooltip listing them
- A fallback reference ("these are your safe basics")

**Milk and kefir are NOT liquids.** They belong under Eggs & Dairy (Protein).
Milk was poorly tolerated early in recovery; kefir caused bad diarrhea. Dr. Poo
will advise against drinking milk too early when it appears in logs.

---

## Registry fields: group, line, and lineOrder

> Updated 2026-03-12 (Phase 2.5 — complete). Replaces the flat `TransitLine` model.

Each `FoodRegistryEntry` has three fields powering the transit map:

```typescript
group: FoodGroup; // "protein" | "carbs" | "fats" | "seasoning"
line: FoodLine; // "meat_fish" | "eggs_dairy" | "vegetables" | "grains" | etc.
lineOrder: number; // suggested exploration order within the sub-line (1 = try first)
```

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

Helper functions from `foodRegistry.ts` / `foodCanonicalization.ts`:

- `getFoodGroup(canonical)` → `FoodGroup | undefined`
- `getFoodLine(canonical)` → `FoodLine | undefined`
- `getFoodsByLine(line)` → sorted by `lineOrder`
- `getLinesByGroup(group)` → all sub-lines for a group
- `getLineDisplayName(line)` → human-readable name
- `getGroupDisplayName(group)` → human-readable name

Constants:

- `FOOD_GROUPS` → all four `FoodGroup` values
- `FOOD_LINES` → all eleven `FoodLine` values

**Status:** Phase 2.5 complete. Hierarchy implemented in registry. Transit map UI deleted — will be rebuilt in Phase 5.

---

## Verification Audit (2026-03-12)

Audited by Claude against the actual codebase (`src/lib/foodRegistry.ts`).

### Types and constants — PASS

- `FoodGroup`, `FoodLine`, `FOOD_GROUPS`, `FOOD_LINES` all exist and match the doc exactly.
- `FoodRegistryEntry` has `group`, `line`, and `lineOrder` fields as documented.

### Helper functions — PASS

All six helpers exist in `foodRegistry.ts` and are re-exported from `foodCanonicalization.ts`:

- `getFoodGroup`, `getFoodLine`, `getFoodsByLine`, `getLinesByGroup`, `getLineDisplayName`, `getGroupDisplayName`.

### Hierarchy (4 groups / 11 lines) — PASS

Group-to-line mapping matches the registry's `GROUP_LINES` constant exactly.

### Key classification decisions — PASS

- Garlic: `herbs_spices` (seasoning) — correct.
- Onion: `vegetables` (carbs) — correct.
- Dairy split: yogurt/egg/milk/cottage cheese in `eggs_dairy` (protein); butter/cream cheese/hard cheese/cream/ice cream/soft rind cheese/double cream in `dairy_fats` (fats) — correct.
- Avocado: `nuts_seeds` (fats) — correct.
- Raw salad: `vegetables` (carbs), Zone 3 — correct.

### Station counts per line — DISCREPANCY

Doc claims "~10-15 stations per sub-line". Actual counts from registry:

| Line              | Stations | Matches "10-15"? |
| ----------------- | -------- | ---------------- |
| meat_fish         | 12       | Yes              |
| eggs_dairy        | 6        | No (below)       |
| vegetable_protein | 1        | No (far below)   |
| grains            | 13       | Yes              |
| vegetables        | 23       | No (far above)   |
| fruit             | 13       | Yes              |
| oils              | 3        | No (below)       |
| dairy_fats        | 7        | No (below)       |
| nuts_seeds        | 4        | No (below)       |
| sauces_condiments | 6        | No (below)       |
| herbs_spices      | 7        | No (below)       |

**Total: 95 stations.** Only 3 of 11 lines fall in the claimed 10-15 range. 6 lines have fewer than 8 stations. Vegetables has 23 (far above). The "~10-15" claim is aspirational, not factual.

### "Not one big map of 100 foods" — BORDERLINE

Total is 95, which is close to 100. The statement is technically correct but misleading since it implies a much smaller number.

### Current implementation state — CONTRADICTION (lines 92 vs 98)

- Line 92: "The transit map UI exists in the codebase"
- Line 98: legacy UI was "deleted in Phase 2.5"

These contradict. Verified: legacy source files (`TransitMap.tsx`, `StationDetailPanel.tsx`, `TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) are deleted. Only a stale dist artifact remains (`dist/assets/TransitMapTest-D4XZXwZk.js`). `Patterns.tsx` has a no-op `handleViewOnMap` placeholder. The UI is deleted — line 92 is stale/wrong.

### Liquids section — INACCURACY

Doc lists "Zone 1A liquids (water, broth, juice, herbal tea, nutritional supplement)". The registry has only 2 Zone 1A entries: `clear broth` and `smooth soup`. Water, juice, herbal tea, and nutritional supplement are not registry entries at all. The doc's framing implies they are Zone 1A registry foods; they are actually unregistered items tracked separately (if at all).

### Raw salad classification — MINOR INACCURACY

Doc says "Raw salad items are Zone 2-3 stations on the Vegetables line." In the registry, `raw salad` is Zone 3 only. No salad items exist in Zone 2. Should say "Zone 3".

### Legacy file deletion — PASS

All five legacy files confirmed deleted from source. `Patterns.tsx` handler is a documented no-op.

### Reward model milestones — DESIGN ONLY

No milestone/celebration logic exists in the codebase. These are design intent, not implemented features. The doc does not explicitly mark them as unimplemented.

### Summary

| Area                 | Status        |
| -------------------- | ------------- |
| Types and constants  | PASS          |
| Helper functions     | PASS          |
| Hierarchy            | PASS          |
| Classifications      | PASS          |
| Station counts       | DISCREPANCY   |
| Implementation state | CONTRADICTION |
| Liquids              | INACCURACY    |
| Raw salad            | MINOR         |
| Legacy deletion      | PASS          |
| Reward model         | DESIGN ONLY   |
