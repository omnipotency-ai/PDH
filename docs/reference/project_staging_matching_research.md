## Status: IMPLEMENTED (2026-04-04)

Wave 0 research resolved all questions. Wave 1 implemented the schema and pipeline changes.

## Resolved decisions (all implemented)

1. **Option B confirmed and built** — staging "Log Food" sends `rawInput` + `items: []`. The `logs.add` mutation schedules `processLogInternal` when items is empty. Both `type: "food"` and `type: "liquid"` trigger this path via `isFoodPipelineType()`.

2. **mealSlot preserved through pipeline** — `writeProcessedItems` uses `...data` spread.

3. **`isFoodPipelineType()` helper** — centralised in `shared/logTypeUtils.ts`. All 20+ food pipeline consumers updated.

4. **canonicalName is optional AND nullable** — UI must handle missing lookups.

## Implementation commits

- `a8f21d0` — type=liquid to schema and all consumers
- `1cf848c` — fix missed food pipeline consumers (20+ locations)

## Full docs

- `docs/nutrition-card/pipeline-integration.md` — definitive call sequences
- `docs/nutrition-card/data-model-mapping.md` — mock to real mapping

**How to apply:** Pipeline is ready. Wave 2 UI components will call it via Option B pattern.
