Goal:

- Eliminate all `Date.now()` calls inside Convex mutation and internalMutation handlers to ensure deterministic replay. Actions and queries are out of scope.

Scope:

- `convex/foodParsing.ts` — make `now` required in processEvidence args, remove `?? Date.now()` fallbacks
- `convex/migrations.ts` — replace `Date.now()` in mutation handlers with required `now` arg
- `convex/foodRequests.ts` — make `now` required in submitRequest, remove fallback
- `convex/foodLibrary.ts` — replace `Date.now()` in mutation handlers with `args.now` (required)
- `convex/ingredientProfiles.ts` — replace `Date.now()` in mutation with required arg
- `convex/ingredientOverrides.ts` — replace `Date.now()` in mutation with required arg
- `convex/conversations.ts` — replace `Date.now()` in mutations with server-side `Date.now()` at action level or required arg
- `convex/aiAnalyses.ts` — same pattern
- `convex/logs.ts` — replace `Date.now()` in mutation at ~L1144
- `convex/computeAggregates.ts` — make `now` required, remove `?? Date.now()` fallbacks
- `convex/seedTestData.ts` — replace `Date.now()` in mutation with required arg
- `shared/foodEvidence.ts` — make `args.now` required in buildFoodEvidenceResult
- Update all callers (scheduler calls, action->mutation calls) to pass `now: Date.now()` from the action layer
- Update test fixtures to pass required `now` arg

Read first:

- `convex/_generated/ai/guidelines.md` — Convex patterns and rules
- `docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-0-1.json` — task W0-01 full description
- Current `Date.now()` locations (run: `grep -rn 'Date.now()' convex/ --include='*.ts' | grep -v test | grep -v node_modules | grep -v _generated`)

Constraints:

- Only eliminate `Date.now()` inside `mutation()` and `internalMutation()` handler bodies
- `Date.now()` inside `action()`, `internalAction()`, `query()`, and `internalQuery()` handlers is FINE — leave those alone
- For scheduler calls (`ctx.scheduler.runAfter`), the caller (action) should pass `now: Date.now()` as an arg to the scheduled mutation
- Do NOT change client-side code — the task description mentions removing `now` from client mutation args, but that's optional/risky. Focus on server-side determinism.
- Do NOT modify `convex/_generated/` files
- Branch: `pans-labyrinth` (current working branch)

Verification:

- `bun run typecheck` must pass
- `bunx vitest run --reporter=verbose` — all tests must pass (update test fixtures as needed to pass required `now` args)
- `grep -rn 'Date.now()' convex/ --include='*.ts' | grep -v test | grep -v node_modules | grep -v _generated` — zero matches inside mutation/internalMutation handler functions (matches inside action handlers are acceptable)

Deliverable:

- Committed code change on `pans-labyrinth` branch with message: `fix(W0-01): eliminate Date.now() inside Convex mutations for deterministic replay`
- List of files changed and any decisions made
