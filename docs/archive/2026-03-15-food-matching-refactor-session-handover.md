# Food Matching Refactor

**Date:** 2026-03-15  
**Branch:** `codex/chore/food-registry`

---

## Purpose

This document captures the full arc of the work completed in this session so a new session can start with fresh context.

The session started as a food-registry detail request and ended as a combined food matching + food registry + transit map refactor handoff.

## Status Update — 2026-03-16

The core migration described here is now complete and has already been merged through `main`. Active follow-up moved onto `codex/chore/food-registry`.

Since this handover was first written, the branch has also shipped:

- stored-data recanonicalization and aggregate backfills on dev
- additional registry cleanup for `stewed apple`, `plain biscuit`, `dark chocolate`, `high-sugar refined snack`, `roast ham`, and `white bread`
- zone-aware evidence weighting updates
- AI assessment extraction repair and historical backfill
- a Dr. Poo prompt/extraction contract so patient-facing food verdicts are mirrored into structured `foodAssessments`

The original migration checklist has been completed and archived to `docs/archive/plans/2026-03-15-food-matching-refactor-migration.md`.

---

## Original User Goal

The user wanted the food registry to be more like the research examples in:

- `docs/scratchpadprompts/snacks-metadata.md`
- `docs/research/schema-food-zones.md`

The explicit goals that emerged were:

1. Keep the existing 11 `FoodLine` values.
2. Keep `examples` as the alias mechanism.
3. Add richer digestion metadata directly to registry entries.
4. Make specific foods such as `Quelitas`, `TUC`, `Ritz`, and `water biscuits` resolve to a shared canonical on the existing `carbs -> grains` line.
5. Cover the broader grouped foods from `schema-food-zones.md`, not just crispy snacks.
6. Build a new transit-map display from app data while preserving the current hardcoded transit map as a visual/model guide.
7. Make it possible to continue canonical-vs-alias decisions cleanly in a later session.

---

## Decision History

### 1. Initial recommendation

The first pass identified two possible implementation paths:

- a minimal path: keep the existing lines and registry structure, add metadata and canonicals selectively
- a fuller path: add new `FoodLine` values and rework the transit-map taxonomy

### 2. User-selected constraints

The user explicitly chose the minimal path and tightened the constraints:

- no new `FoodLine` values
- no replacement of `examples` as the alias system
- metadata added on top of the existing registry structure
- alias handling layered on top of canonical + examples rather than replacing registry structure

### 3. Scope expansion

The user then clarified that the work was not only about crispy snacks. The target scope became all the grouped foods in `docs/research/schema-food-zones.md`, mapped onto the existing taxonomy as new canonicals or alias enrichments.

### 4. Transit map requirement

The user then added a second major requirement:

- the current transit map should remain as a model/guide
- a new display should be built from our own registry/evidence data

### 5. Canonical approval workflow

The user said they wanted approval/rejection control over which items become new canonicals versus alias enrichments. A proposed split was surfaced, then the user later pasted a GPT-generated patch that effectively approved the main direction.

### 6. Grounded implementation choice

The pasted GPT patch was not repository-valid as-is because it:

- used invalid `.push` mutations on readonly arrays
- proposed invalid or mismatched subcategory values
- introduced some speculative extras outside the grounded `schema-food-zones.md` scope

So the implementation followed the approved substance, but translated it into repository-valid code and kept the scope grounded.

---

## Final Scope Implemented

### Registry/model changes

- Added typed digestion metadata to the registry model:
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

- Added new canonicals on existing lines:
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

- Kept the existing 11 `FoodLine` values unchanged.
- Kept `examples` as the deterministic alias source.
- Added an enrichment layer so existing canonicals can absorb metadata and extra schema-driven examples without duplicating large literal blocks.

### Alias/canonical changes

The most important alias split implemented:

- `plain cracker` is now the soaked, Zone 1 version only
- dry refined cracker/snack aliases moved to `crispy cracker`

Examples now resolving to `crispy cracker` include:

- `Quelitas`
- `TUC`
- `Ritz`
- `water biscuits`
- `cream crackers`
- `saltines`
- `breadsticks`
- `grissini`

The red-meat line was also split so minced items are no longer absorbed by `red meat`:

- `lean mince` and related phrases now resolve to `lean minced meat`
- chunkier or whole-cut meat remains under `red meat`

### Data consumer changes

- Added digestion metadata to `TransitStation`.
- Updated the registry-driven transit network builder to carry digestion metadata into map stations.
- Extended database/evidence rows to carry:
  - registry digestion metadata
  - registry notes

- Updated the expanded evidence sub-row to show a `Registry Profile` block with digestion badges.

### Transit-map changes

- Built a new data-driven transit-map UI from:
  - `shared/foodRegistry.ts`
  - evidence data from `analyzeLogs()`

- Preserved the old hardcoded transit map as the `Model guide`.
- Added nested tabs inside the Patterns transit-map panel:
  - `Live network`
  - `Model guide`

---

## Files Changed

### Core registry / matching

- `shared/foodRegistry.ts`
- `shared/foodCanonicalization.ts`
- `shared/__tests__/foodCanonicalization.test.ts`

### Transit data model

- `src/types/transitMap.ts`
- `src/hooks/useTransitMapData.ts`
- `src/hooks/__tests__/useTransitMapData.test.ts`

### Evidence/database UI

- `src/components/patterns/database/columns.tsx`
- `src/components/patterns/database/TrialHistorySubRow.tsx`
- `src/lib/foodDigestionMetadata.ts`

### Patterns / map UI

- `src/components/patterns/transit-map/RegistryTransitMap.tsx`
- `src/pages/Patterns.tsx`

---

## Important Implementation Notes

### Registry invariants were preserved

The registry still enforces:

- unique canonicals
- unique `lineOrder` within each `FoodLine`
- valid group/line pairings
- unique normalized aliases across canonicals

This mattered because the new aliases initially created collisions:

- `boiled pumpkin` collided between `mashed root vegetable` and `cooked pumpkin`
- `ricotta` collided between `cottage cheese` and `cream cheese`

Those collisions were fixed rather than weakening the invariant.

### Existing taxonomy was kept

No new `FoodLine` values were introduced.

Line-order changes were done by reordering numeric `lineOrder` values on affected lines so the new canonicals fit cleanly into the progression without breaking uniqueness.

### Transit-map design choice

The new transit-map UI is intentionally not a clone of the old hardcoded artwork. It is a fresh live-network display built from real registry + evidence data, while the original visual map remains available as the guide/model tab.

---

## What Was Verified

### Targeted verification

Ran:

- `bun x vitest run shared/__tests__/foodCanonicalization.test.ts src/hooks/__tests__/useTransitMapData.test.ts`
- `bun x tsc --noEmit`

### Full unit verification

Ran:

- `bun run test:unit`

Result:

- 37 test files passed
- 575 tests passed

### What was not run

- Playwright / E2E was not run in this session.

---

## Current State of the Repo

There were unrelated pre-existing working-tree changes in the repository before this work. They were left untouched.

The files added by this session are:

- `src/lib/foodDigestionMetadata.ts`
- `src/components/patterns/transit-map/RegistryTransitMap.tsx`

---

## Open Questions / Not Yet Done

### 1. `schema-food-zones.md` coverage is broader than the currently shipped additions

The grouped-schema approach is now substantially implemented, and the earlier deferred snack work has partly landed (`plain biscuit`, `dark chocolate`, and `high-sugar refined snack` now exist). What still needs review is the remaining grouped coverage, especially:

- some of the “other soft cooked low-fiber vegetables” group
- finer distinctions between soft fresh cheeses
- whether additional grouped canonicals should be introduced for non-colliding research clusters

### 2. Canonical approval workflow is still human/document-driven

The user explicitly wants approval/rejection control over canonical-vs-alias choices. In this session that happened conversationally. There is still no first-class in-app workflow for approving those decisions.

### 3. Dr. Poo still uses canonical hints, not the full registry

The report system now receives canonical names from food logs and the food-trial database, and the prompt now requires canonical naming plus structured mirroring. That is enough for current report generation, but the model still does not receive a full registry dump. If future report quality needs more coverage for never-before-assessed foods, a compact canonical guide is the next likely step.

---

## Suggested Next Session Starting Point

If starting fresh, begin with:

1. Read this file.
2. Read `docs/working/2026-03-15-food-registry-refactor.md`.
3. Open `shared/foodRegistry.ts`.
4. Review the new live transit map in `src/components/patterns/transit-map/RegistryTransitMap.tsx`.
5. Decide whether the next step is:
   - more schema-food-zones coverage
   - deeper registry metadata coverage
   - explicit canonical approval tooling
   - regrouping chocolate/biscuit/candy items

---

## Short Summary

This session shipped and then stabilized a registry-first food matching expansion:

- richer digestion metadata
- new snack and gentle-food canonicals on existing lines
- deterministic alias resolution for `Quelitas`-style foods
- registry metadata surfaced in evidence views
- a new live transit map built from registry + evidence data
- repaired AI-food assessment extraction and backfills
- canonical-name contract alignment between Dr. Poo's visible report text and backend structured rows
- preservation of the old hardcoded transit map as a guide

That leaves the project in a good state to continue the food registry refactor cleanly in a new session.
