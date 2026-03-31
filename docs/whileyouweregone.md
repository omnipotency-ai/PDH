# While You Were Gone

## Context

This note is a handoff for Claude Code to resume from the current working tree.

Primary user intent during this session:

- understand whether Sprint 2.5 / old Phase 5 work is actually ready
- audit readiness against `docs/plans/2026-03-17-sprint-2.6-transit-map-ui.md`
- fix current test failures
- try to bank Wave 4 work cleanly

## High-level findings

### Sprint 2.5 / 2.6 status

- The repo plan file for Sprint 2.5 currently defines **5 waves**:
  - Wave 1 research
  - Wave 2 transit/evidence
  - Wave 3 LLM pipeline
  - Wave 4 registry hardening
  - Wave 5 browser verification
- `docs/WIP.md` was stale and stopped at Wave 3.
- `docs/WORK-QUEUE.md` was stale for Wave 4 and still showed Wave 4 items open.
- The codebase already contains a live registry-driven transit map foundation:
  - `src/hooks/useTransitMapData.ts`
  - `src/components/patterns/transit-map/RegistryTransitMap.tsx`
- Sprint 2.6 is **not done**:
  - old mock-driven `TransitMap.tsx` still exists and is still wired on Patterns as the "Model guide"
  - `src/data/transitData.ts` still exists
  - many transit-map support files still import `@/data/transitData`
  - the dead `transitMapV2` flag still exists in `src/lib/featureFlags.ts`

### Architecture mismatch discovered

We uncovered a significant mismatch between legacy client parsing logic and the intended current system.

User sort of clarified intended model but ended up more confused:

- deterministic registry-first matching is the source of truth
- fuzzy / embeddings / vectors / other deterministic matching happens first
- if unresolved, LLM (from where? the server or the client?) is used only to match raw items to the existing registry
- LLM may web-search unknown terms to improve matching (with google web search)
- if still no match, the item goes to manual user matching
- LLM should **not** create new foods
- LLM should **not** invent zones / recovery stages (am i right?)
- LLM should **not** invent spice level

Current code reality:

- server-side LLM matching in `convex/foodLlmMatching.ts` is relatively close to the intended model
- client-side parsing prompt in `src/lib/foodLlmCanonicalization.ts` still contains legacy assumptions:
  - "If no canonical fits, return the food name as-is and mark isNew: true"
  - previously also told the LLM to choose `recoveryStage`

This means the client parsing path is partially legacy and not fully aligned with the current intended architecture (can you explain to me what we already agreed, i am so confused)

## Files I changed

### Docs / planning

- `docs/WIP.md`
  - added Wave 4 completion notes (rewrite them if different to what you did)
- `docs/WORK-QUEUE.md`
  - marked Wave 4 items done (rewrite them if different to what you did)
  - updated Sprint 2.5 summary row from all-open to 16 done / 4 open (rewrite them if different to what you did)
- `docs/plans/food-registry-audit-checklist.md`
  - added as part of Wave 4 tracking alignment (if this is referenced inside the work queue, do we do that, maybe remove it? we dont want to create a sprawling docs file again, and as soon axs this transit map is completed we can archive the wip the plans and the prompts etc)

### Wave 4 code slice

- `shared/foodRegistry.ts`
  - reclassified `gelatin dessert` from carbs/grains to protein/eggs_dairy
  - removed duplicate `"lactose free spreadable cheese"` example
  - added missing bare `fish` and `chicken` examples
- `shared/foodNormalize.ts`
  - removed reflexive `["pureed potato", "pureed potato"]`
- `shared/foodMatching.ts`
  - kept Wave 4 candidate-merging changes already present in working tree
- `shared/__tests__/foodMatchCandidates.test.ts`
  - new test file covering candidate merge behavior
- `shared/__tests__/foodMatching.test.ts`
- `shared/__tests__/foodRegistry.test.ts`

### Test / lint / quality fixes

- `src/lib/foodParsing.ts`
  - first changed normalization semantics to preserve explicit `recoveryStage`
  - then reverted that semantic change after user clarified zone authority
  - final state now derives `recoveryStage` from canonical zone for normalized known foods
- `src/lib/foodLlmCanonicalization.ts`
  - removed prompt instructions that told the LLM to choose `recoveryStage`
  - removed `recoveryStage` from the JSON schema shown to the LLM
  - prompt still likely needs a fuller architecture cleanup to remove legacy `isNew/new food` assumptions
- `src/lib/__tests__/foodParsing.test.ts`
  - updated the normalization expectation so canonical zone wins over parsed `recoveryStage`
- `convex/logs.test.ts`
  - optimized the 5001-row `listAll` test to seed via direct DB insert inside `t.run(...)` (was this correct?)
  - fixed a suite timeout without changing the behavior under test
- `src/components/patterns/transit-map/TransitMap.tsx`
  - removed non-null assertions on `activeSubLine.zones[...]`
  - added defensive early return if zone cards are missing (is this correct?)
- `src/lib/baselineAverages.ts`
  - removed one non-null assertion
- `src/main.tsx`
  - removed non-null assertion on `document.getElementById("root")`
  - now throws a descriptive error if root is missing (what kind of error? does it match the error handling we implemented? )
- `src/components/settings/tracking-form/DrPooSection.tsx`
  - Biome-safe key cleanup from automatic formatting/linting (is this correct?)

## Key semantic discussion: `recoveryStage`

This was the most important product/domain clarification from the user.

The confusion:

- I initially treated `recoveryStage` like `preparation` and `spiceLevel`, i.e. optional parsed metadata that should be preserved if explicitly present.

User clarified this is wrong for the product model:

- `preparation` is instance-specific and should be preserved
- `spiceLevel` is instance-specific and may be preserved if desired
- `recoveryStage` is effectively the **canonical zone/station truth**
- therefore a known canonical food like boiled chicken must keep its registry zone
- parsed metadata or LLM output must not override that

Final state after correction:

- known-food `recoveryStage` now comes from canonical registry truth again
- the client LLM prompt no longer asks the model to choose `recoveryStage`

## Readiness audit results against Sprint 2.6

### Already present

- `useTransitMapData()` exists and works
- `RegistryTransitMap` exists and is wired on Patterns
- a live registry/evidence map is already visible in-app

### Still missing for 2.6 completion

- replacement of the old mock map as the primary UI
- deletion of mock-driven transit-map support files
- deletion of `src/data/transitData.ts`
- deletion/removal of old `TransitMap.tsx` path
- removal of `transitMapV2`
- proper `TransitMapContainer` / `LineTrack` / `StationNode` / `StationInspector` implementation per plan

### Data contract gaps for 2.6

`shared/foodEvidence.ts` already contains:

- `latestAiVerdict`
- `latestAiReasoning`
- `firstSeenAt`

But those do not currently flow through the live transit-map hook cleanly.

Current issue:

- `src/lib/analysis.ts` does not expose them in `FoodStat`
- `src/hooks/useTransitMapData.ts` currently hardcodes AI fields to `null`
- `firstSeenAt` is faked from `lastTrialAt`

So if Claude Code starts 2.6, one early task should probably be extending the live data contract instead of leaving the station inspector partially blind.

## Quality gate results from this session

### Passed

- formatting:
  - `bun x @biomejs/biome format --write .`
- lint:
  - `bun x @biomejs/biome check .`
- typecheck:
  - `bun run typecheck`
- unit tests:
  - `bun run test:unit`
- build:
  - `bun run build`

### E2E

Playwright was run and the environment was working:

- Clerk auth bootstrap succeeded
- local web server started
- most tests passed

Observed failures during the run:

- `e2e/destructive-habits.spec.ts`
  - `tapping cigarettes increments count and updates status`
  - failed once, then on retry another test in same file failed
- `e2e/destructive-habits.spec.ts`
  - `rec drugs tile shows cap status if present`
  - failed on initial run and retry
- one fluid-tracking failure self-healed on retry

Important: the full E2E suite was **not green** at the time of handoff.

## Commit status

Attempted commit:

- `feat: complete sprint 2.5 wave 4 registry hardening`

Result:

- commit did **not** land initially because Husky caught failing tests
- after fixes, quality gates were rerun, but the full E2E suite still had failures
- therefore no final commit was made during this session

## Current likely next steps for Claude Code

1. Decide whether to keep or further revise the client parsing prompt architecture:
   - remove remaining legacy "new food / isNew" assumptions if they are no longer valid
2. Investigate and fix the remaining failing E2E destructive-habits specs
3. Re-run full gate sequence:
   - format
   - lint
   - typecheck
   - unit tests
   - build
   - E2E
4. If all green, commit with messaging that accurately reflects:
   - Wave 4 registry hardening
   - parsing prompt alignment / zone-authority correction
   - quality-gate fixes

## Important caution

The user explicitly signaled that consistency matters more than theoretical correctness at this point, and that picking up another agent's half-completed work is fragile. Please prefer:

- making the code internally consistent with the current intended architecture
- not introducing another mental model
- not preserving legacy "new registry entry from LLM" behavior unless intentionally desired
