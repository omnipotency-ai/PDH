# Transit Map & Reward Model — Current State

**Date:** 2026-03-12
**Status:** Registry hierarchy implemented. Transit map UI deleted. Reward system not implemented.
**Related:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Food System Rebuild](./food-system-rebuild.md)
**Archived version:** [archive/transit-map-and-reward-model.md](./archive/transit-map-and-reward-model.md)

---

## What exists in code

### Registry hierarchy (implemented in Phase 2.5)

The food registry (`src/lib/foodRegistry.ts`) implements a 4-group / 11-line hierarchy with 95 total stations (canonical foods).

Each `FoodRegistryEntry` has:

- `group: FoodGroup` — macronutrient group
- `line: FoodLine` — sub-line within the group
- `lineOrder: number` — suggested exploration order (1 = try first)

### Groups, lines, and actual station counts

| Group         | Line              | Stations | Display Name        |
| ------------- | ----------------- | -------- | ------------------- |
| **Protein**   | meat_fish         | 12       | Meat & Fish         |
|               | eggs_dairy        | 6        | Eggs & Dairy        |
|               | vegetable_protein | 1        | Vegetable Protein   |
| **Carbs**     | grains            | 13       | Grains              |
|               | vegetables        | 23       | Vegetables          |
|               | fruit             | 13       | Fruit               |
| **Fats**      | oils              | 3        | Oils                |
|               | dairy_fats        | 7        | Dairy Fats          |
|               | nuts_seeds        | 4        | Nuts & Seeds        |
| **Seasoning** | sauces_condiments | 6        | Sauces & Condiments |
|               | herbs_spices      | 7        | Herbs & Spices      |

**Group totals:** Protein 19, Carbs 49, Fats 14, Seasoning 13.

Station distribution is uneven. Vegetables alone has 23 stations. Vegetable Protein has 1 (legumes only). Several lines have fewer than 7 stations. This is the actual registry — the UI will need to handle variable line lengths.

### Types

```typescript
type FoodGroup = "protein" | "carbs" | "fats" | "seasoning";

type FoodLine =
  | "meat_fish"
  | "eggs_dairy"
  | "vegetable_protein"
  | "grains"
  | "vegetables"
  | "fruit"
  | "oils"
  | "dairy_fats"
  | "nuts_seeds"
  | "sauces_condiments"
  | "herbs_spices";
```

### Helper functions (available now)

Defined in `foodRegistry.ts`, re-exported from `foodCanonicalization.ts`:

- `getFoodGroup(canonical)` — returns `FoodGroup | undefined`
- `getFoodLine(canonical)` — returns `FoodLine | undefined`
- `getFoodsByLine(line)` — returns entries sorted by `lineOrder`
- `getLinesByGroup(group)` — returns all sub-lines for a group
- `getLineDisplayName(line)` — returns human-readable name (e.g. "Meat & Fish")
- `getGroupDisplayName(group)` — returns human-readable name (e.g. "Protein")

Constants:

- `FOOD_GROUPS` — all four `FoodGroup` values
- `FOOD_LINES` — all eleven `FoodLine` values

### Key classification decisions

- **Garlic** — herbs_spices (Seasoning), not vegetables
- **Onion** — vegetables (Carbs), not seasoning
- **Dairy split**: yogurt, egg, milk, cottage cheese, kefir, fried egg in eggs_dairy (Protein). Butter, cream cheese, hard cheese, cream, ice cream, soft rind cheese, double cream in dairy_fats (Fats).
- **Avocado** — nuts_seeds (Fats)
- **Raw salad** — vegetables (Carbs), Zone 3 only

### Zone 1A entries (liquids)

The registry has only 2 Zone 1A entries: `clear broth` and `smooth soup`. Other recovery liquids (water, juice, herbal tea) are not registry entries and do not have stations. They may be tracked in the app's fluid logging but are outside the transit map's station model.

---

## What does NOT exist in code

### Transit map UI — deleted, to be rebuilt in Phase 5

The legacy transit map UI (`TransitMap.tsx`, `StationDetailPanel.tsx`, `TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) was deleted in Phase 2.5. Source files are gone. A stale dist artifact (`dist/assets/TransitMapTest-D4XZXwZk.js`) remains but is non-functional. `Patterns.tsx` has a no-op `handleViewOnMap` placeholder.

The transit map will be rebuilt from scratch in Phase 5 using the registry hierarchy and real Convex data.

### Station status model — design only

No station status tracking exists in code. The intended model:

| Colour             | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Grey               | Never trialled. Station not yet visited.                                      |
| Blue               | Trialling — fewer than the minimum resolved trials. Still gathering evidence. |
| Green              | Safe. Consistently good outcomes across trials.                               |
| Green (teal)       | Safe-loose. Good outcomes but tends toward loose stools.                      |
| Green (amber tint) | Safe-hard. Good outcomes but tends toward firm/hard.                          |
| Amber / Orange     | Watch. One or more concerning outcomes. More trials needed.                   |
| Red                | Avoid. Consistent bad outcomes. Strong evidence against.                      |

Station status will be derived from the evidence pipeline (Phase 3) once it produces real verdicts.

### Reward / milestone system — design only

No celebration or milestone logic exists. The intended triggers:

| Milestone                                              | Celebration reason                           |
| ------------------------------------------------------ | -------------------------------------------- |
| First food logged ever                                 | Starting the journey                         |
| First food trialled (resolved)                         | First completed experiment                   |
| Zone 1 complete on a sub-line                          | Explored the safe core for this food type    |
| 5 stations green                                       | Building a safe menu                         |
| 10 stations any status                                 | Active explorer                              |
| First station turned red / avoid                       | Detective work done. You know what to avoid. |
| First station turned orange / watch                    | Suspicious! More trials needed.              |
| First station cleared (orange -> green)                | Vindicated! It was fine after all.           |
| All sub-lines in a group have Zone 1 stations visited  | Group foundations complete                   |
| Full sub-line complete (all zones visited)             | Sub-line mastered                            |
| First Zone 3 station trialled                          | Adventurous                                  |
| Longest trial streak (N consecutive days with a trial) | Consistent                                   |

---

## Design intent (not yet implemented)

### The transit map metaphor

The transit map is a **historical record of where the user has been**, not a live journey or a progress gate. Each station is a canonical food. Its zone determines position (Zone 1 = safe core, Zone 2 = expanded, Zone 3 = experimental). Its status colour updates as evidence accumulates.

- Not a live journey indicator — no "you are here" pin
- Not a progression lock — Zone 3 is visible from day one
- Not punitive — no warnings, blocks, or shame

### Per-line visual structure (concept)

Each sub-line view would show:

- **Zone 1**: Single track, safest preparations
- **Interchange node**: Zone boundary (structural, not a food)
- **Zone 2**: Track splits into branches, more adventurous preparations
- **Zone 3**: Fewer stations, experimental foods, "and beyond" arrows

Note: with actual station counts ranging from 1 to 23, the UI will need to adapt to variable line lengths rather than assuming uniform 10-15 stations per line.

### Reward design principles

- A red station is not a failure — it is valuable information. Celebrate it.
- Negative discoveries deserve the same celebration as positive ones.
- No punishment for eating anything.
- Small wins matter — frequent, low-threshold rewards for ADHD users.
- Celebrations fire on information gain, not compliance.

---

## Build order

1. **Phase 5**: Transit map UI — rebuilt from scratch using registry hierarchy and real data
2. **Phase 5+**: Reward/milestone system — wired to station status changes
