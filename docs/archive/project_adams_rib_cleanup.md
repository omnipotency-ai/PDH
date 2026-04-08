## Branch: adams-rib (2 commits as of 2026-04-01)

### What was removed

**AI insight fields stripped from entire pipeline:**

- `lifestyleExperiment` (and `LifestyleExperimentStatus` type) — autonomy/trade-off engine output
- `likelySafe` — AI-determined safe foods list
- `nextFoodToTry` — AI food trial suggestion
- `miniChallenge` — gamified habit challenges

Removed from: `domain.ts` type, `validators.ts`, `testFixtures.ts`, `migrations.ts` normalization, `extractInsightData.ts` mapping, `DrPooReport.tsx` UI sections, `foodSafetyUtils.ts` AiFlags, `aiAnalysis.test.ts`, `extractInsightData.test.ts`. The AI prompt in `aiAnalysis.ts` was already updated by the user to remove these from the JSON output schema.

**ParsedItem removed:**

- Was a client-side DTO in `FoodSection.tsx` that constructed food items (name/quantity/unit) then immediately threw them away — the server re-parses everything from raw text via `processLogInternal`.
- Removed from `FoodSection.tsx`, `index.ts` export, aligned `onLogFood` signature to `(notes, rawText, timestampMs?)` across FoodSection, Track.tsx, and `useFoodParsing.ts`.

**Legacy migration deleted:**

- `src/lib/migrateLegacyStorage.ts` — one-time IDB→Convex migration that was already complete
- `LegacyMigration` component removed from `routeTree.tsx`

**Other cleanup:**

- `docs/README.md` deleted (stale navigation index)
- `docs/chores.html` deleted (personal chore roulette game, not app code)
- `docs/WIP.md` — cleared completed sprint items
- `.gitignore` — added `.vite/` (Vite dep pre-bundle cache was showing in staging)
- `gpt-5.2` model fully sunset — removed from `AllowedAiModel`, `validators.ts`, `aiModels.ts` labels/aliases, added to `LEGACY_AI_MODEL_MAP` in `logs.ts` for backup import normalization

**Tailwind v4 syntax modernisation (user-initiated):**

- `routeTree.tsx` and `UiMigrationLab.tsx` — `bg-[var(--x)]` → `bg-(--x)`, `bg-gradient-to-r` → `bg-linear-to-r`, `border-white/[0.06]` → `border-white/6`, `max-w-[1760px]` → `max-w-440`

### What was NOT removed (confirmed useful)

- All 4 ingredient subsystems (exposures, profiles, overrides, nutritionApi) — confirmed as pre-built infrastructure for the filter prompt design
- Food decomposition pipeline (composite handling) — active and feeds into meal logging plans
- `"Cycle"` removed from UiMigrationLab demo list (per v1 scope gate — reproductive health deferred)
