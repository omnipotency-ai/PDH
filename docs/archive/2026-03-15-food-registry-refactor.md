# Food Registry Refactor

**Date:** 2026-03-15  
**Branch:** `codex/chore/food-registry`

---

## Purpose

This is the focused continuation document for the food registry side of the refactor.

It is narrower than the full session handover. The goal here is to capture:

- what the registry refactor now looks like
- what was actually implemented
- what still needs deliberate follow-up

> **Status as of 2026-03-16:** the registry follow-up is still active, but the underlying food-matching migration is complete and archived. This document now tracks the remaining taxonomy/detail cleanup rather than the core pipeline rollout.

---

## Current Registry Direction

The current refactor keeps the existing registry architecture intact:

- 4 top-level groups
- 11 existing `FoodLine` values
- canonical foods stored in `shared/foodRegistry.ts`
- deterministic matching derived from registry canonicals + `examples`
- report prompt canonical naming derived from food-log canonicals plus `foodTrialDatabase` canonical names rather than a full registry dump

The registry is still the single source of truth.

---

## Constraints That Are Now Established

These should be treated as active working constraints unless the user changes direction:

1. Do not add new `FoodLine` values.
2. Keep `examples` as the alias system.
3. Add richer digestion metadata directly to registry entries.
4. Layer any future fuzzy/embedding/alias-table work on top of canonical + examples rather than replacing registry structure.
5. Keep the transit map reading from registry/evidence rather than inventing a parallel taxonomy.

---

## Implemented Registry Changes

### New metadata model

The registry now supports:

- `osmoticEffect`
- `totalResidue`
- `fiberTotalApproxG`
- `fiberInsolubleLevel`
- `fiberSolubleLevel`
- `gasProducing`
- `dryTexture`
- `irritantLoad`
- `highFatRisk`
- `lactoseRisk`

### New canonicals added

- `protein drink`
- `soft couscous`
- `soft polenta`
- `lean minced meat`
- `mild veggie burger`
- `crispy cracker`
- `low-fiber cereal`
- `basic savoury snack`
- `low-fiber sweet snack`
- `simple chocolate snack`
- `mild cheese snack`

### Key alias reallocations

- `plain cracker` is now the soaked / softened Zone 1 form
- `Quelitas`, `TUC`, `Ritz`, `water biscuits`, `cream crackers`, `saltines`, `breadsticks`, and `grissini` now resolve to `crispy cracker`
- minced meat phrases now resolve to `lean minced meat` instead of `red meat`

### Existing canonicals enriched

Metadata and/or schema-driven example additions were applied to a broad set of existing canonicals, including:

- broths and soups
- rice / pasta / porridge / pudding
- soft roots and low-fiber vegetables
- lean proteins and dairy
- fruit stations
- fat and dairy-fat stations
- selected Zone 3 fermentable / sweet / fried items

---

## What This Achieved

### 1. Matching quality improved without changing the registry architecture

The registry can now express:

- stool-loosening risks
- residue level
- fibre character
- gas potential
- dryness
- irritant load

### 2. Snack handling is cleaner

`Quelitas`-style foods now resolve to a shared station with shared metadata instead of being mixed into the old soaked-cracker behavior.

### 3. Registry data is now visible in the UI

The metadata does not just exist in the registry. It is now surfaced in:

- the evidence/database sub-row
- the new live transit-map detail panel

---

## Known Gaps

### 1. Not all grouped research items are perfectly modeled yet

The user wanted the registry to absorb the grouped foods from `schema-food-zones.md`. A lot of that has been covered, but some grouped items still need a better canonical-vs-alias decision.

Likely follow-up candidates:

- additional soft cooked vegetable groupings
- finer fresh-cheese distinctions
- more explicit fruit-purée grouping decisions

### 2. Snack/confectionery cleanup is only partly finished

The earlier deferred items have now moved forward:

- `dark chocolate` exists
- `plain biscuit` exists
- `concentrated sweet food` has been replaced by `high-sugar refined snack`

What is still open is the broader snack regrouping question:

- whether `sweet biscuit`, `high-sugar refined snack`, and the remaining candy/chocolate/cookie aliases should be split further
- whether the current names should be final or tightened again after more live-data review

### 3. Metadata breadth is still selective

The infrastructure is in place, but the metadata population is not yet exhaustive across every canonical in the registry.

### 4. Remaining grouped-food cleanup is now the main follow-up

Open areas still worth deliberate review:

- additional soft cooked vegetable groupings
- finer fresh-cheese distinctions
- more explicit fruit-puree grouping decisions
- any remaining legacy aliases in stored data that should be pushed into the newer canonicals

---

## Recommended Next Steps

### Option A: Complete the schema-food-zones mapping

Best if the next goal is clinical/detail completeness.

Focus:

- review remaining grouped foods from `docs/research/schema-food-zones.md`
- decide canonical vs alias handling case-by-case
- extend metadata coverage where it is still missing

### Option B: Formalize approval workflow

Best if the next goal is user control over taxonomy decisions.

Focus:

- create a documented decision list for:
  - new canonical
  - alias enrichment
  - deferred

- possibly add a lightweight review document or UI flow for canonical approvals

### Option C: Revisit chocolate/biscuit/candy regrouping

Best if the next goal is consumer-snack taxonomy cleanup.

Focus:

- decide whether `dark chocolate`, `plain biscuit`, and broader candy regroupings should become first-class stations
- resolve collisions with existing `sweet biscuit` and `concentrated sweet food`

---

## Suggested Files to Open First Next Time

- `shared/foodRegistry.ts`
- `shared/foodCanonicalization.ts`
- `docs/research/schema-food-zones.md`
- `docs/scratchpadprompts/snacks-metadata.md`
- `src/components/patterns/transit-map/RegistryTransitMap.tsx`
- `src/components/patterns/database/TrialHistorySubRow.tsx`

---

## One-Line Status

The food registry refactor is no longer just a static alias table: it now carries typed digestion metadata, supports the grouped canonicals the user prioritized, feeds deterministic matching and Dr. Poo canonical hints, and powers both the live transit-map and evidence UI. The remaining work is mostly taxonomy cleanup and coverage expansion, not core architecture.
