# Wave 5 Prompt: Browser Verification

> Copy-paste this prompt to start Wave 5 in a new conversation.

---

Execute Sprint 2.5 Wave 5: Browser Verification.

You are an orchestrator AND executor. You will use `playwright-cli` for interactive browser verification and `bunx playwright test` for automated E2E specs. Dispatch sub-agents (Opus for complex, Sonnet for simple) for writing E2E specs and fixing issues.

## Files to read BEFORE starting

- CLAUDE.md — engineering principles
- docs/plans/2026-03-17-sprint-2.5-transit-and-llm-pipeline.md — Wave 5 section
- docs/WIP.md — execution log (append Wave 5 progress)
- docs/WORK-QUEUE.md — update WQ item statuses
- e2e/food-pipeline.spec.ts — existing food pipeline E2E patterns
- playwright.config.ts — Playwright configuration

## Memory context (do NOT read these files, just know the decisions)

- Waves 1-4 complete: 1181 unit tests passing, typecheck clean, build clean
- Branch: chore/consolodated-review
- Playwright 1.58.2, headless Chromium, baseURL localhost:3005
- Auth via Clerk (e2e/auth.setup.ts handles login)
- E2E tests may have pre-existing failures in destructive-habits.spec.ts (flaky selectors, not pipeline bugs)
- recoveryStage = canonical zone truth, never from LLM
- LLM matching is BYOK — requires user API key in IndexedDB, which E2E tests won't have. Verify LLM UI hooks exist but skip live LLM call tests.
- Never bypass Husky pre-commit hooks
- Use bun (not npm/yarn)

## Tools

### playwright-cli (primary — interactive exploratory verification)

`playwright-cli` gives you direct interactive browser control via the terminal. It outputs structured accessibility tree snapshots so you can "see" pages without vision. Use this for exploratory verification of each WQ item.

**Prerequisites:** The dev server (`bun run dev` on port 3005) and Convex backend (`npx convex dev`) must be running before using playwright-cli. These are NOT auto-started.

**Session workflow:**

```bash
# Open browser and navigate to the app
npx playwright-cli open http://localhost:3005

# Take a snapshot to see the page structure (accessibility tree)
npx playwright-cli snapshot

# Navigate to a different page
npx playwright-cli goto http://localhost:3005/patterns

# Click an element by its ref (from snapshot)
npx playwright-cli click e42

# Fill a text field by ref
npx playwright-cli fill e15 "boiled chicken"

# Type text into the focused element
npx playwright-cli type "some text"

# Read console errors
npx playwright-cli console error

# List network requests
npx playwright-cli network

# Evaluate JS on the page (check state, read data)
npx playwright-cli eval "document.title"
npx playwright-cli eval "document.querySelectorAll('[data-testid]').length"

# Close the browser session when done
npx playwright-cli close
```

**Key commands reference:**

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `open [url]`         | Open browser, optionally navigate                     |
| `goto <url>`         | Navigate to URL                                       |
| `snapshot`           | Capture accessibility tree (use to find element refs) |
| `click <ref>`        | Click element by ref from snapshot                    |
| `fill <ref> <text>`  | Fill text input                                       |
| `type <text>`        | Type into focused element                             |
| `select <ref> <val>` | Select dropdown option                                |
| `eval <js>`          | Run JavaScript on page                                |
| `console [level]`    | Read console messages                                 |
| `network`            | List network requests                                 |
| `reload`             | Reload page                                           |
| `close`              | Close browser                                         |

**Workflow pattern for each verification:**

1. `snapshot` — see the page structure
2. Find the element refs you need
3. Interact (click, fill, type)
4. `snapshot` again — verify the result
5. `console error` — check for runtime errors
6. Document findings

### Playwright E2E tests (secondary — automated, repeatable)

Use `bunx playwright test` for automated specs. Write new specs in `e2e/` for verification items that should be repeatable regression tests.

```bash
# Run all E2E tests
bunx playwright test

# Run a specific spec
bunx playwright test e2e/food-pipeline.spec.ts

# Run a single test by name
bunx playwright test -g "test name pattern"
```

## Wave 5 Tasks

### Task 5.0: Prerequisites + Fix Existing E2E Failures

1. Ensure dev server and Convex backend are running:
   - Check if `http://localhost:3005` responds
   - If not, start with `bun run dev` in one terminal and `npx convex dev` in another
   - Or ask the user to start them
2. Run `bunx playwright test` and collect failures
3. Fix any broken selectors, flaky tests, or setup issues
4. The destructive-habits specs had failures in the last session — investigate root cause
5. Do NOT skip tests — fix them or document why they can't run

### Task 5.1: Interactive Verification with playwright-cli

For each WQ item, use `playwright-cli` to interactively verify behavior:

**WQ-045: Food safety grid correct status**

1. `npx playwright-cli open http://localhost:3005`
2. Navigate to Patterns page
3. `snapshot` — find the food safety grid
4. Verify known foods show their correct status (safe/watch/avoid/building evidence)
5. Check status labels and colors make sense

**WQ-046: DB status logic thresholds**

1. Navigate to Patterns food database
2. `snapshot` — check food entries
3. Verify foods with sufficient trials show "assessed" not "building evidence"
4. Check threshold behavior at boundaries

**WQ-047: DB trend lines**

1. Navigate to a food's detail view in Patterns
2. `snapshot` — check for chart/trend elements
3. Verify trend lines render OR show "insufficient data" gracefully
4. Should not show blank/broken containers

**WQ-048: Food trial count merging**

1. Navigate to Track page
2. Log the same food with different capitalizations (e.g., "Chicken", "chicken", "CHICKEN")
3. Navigate to Patterns
4. `snapshot` — verify trial counts merge under same canonical name

**WQ-049: Evidence threshold transition (already fixed Wave 2)**

1. Check Patterns page for foods with varying trial counts
2. Verify INITIAL_GRADUATION_TRIALS=5 boundary is reflected in UI

**WQ-012: Bristol classification (already fixed Wave 2)**

1. Navigate to Track page
2. Log digestion events with specific Bristol scores
3. Navigate to food detail view
4. `snapshot` — verify classification label

**LLM matching (smoke test only)**

1. Navigate to Settings
2. `snapshot` — verify API key input section exists
3. Navigate to Track, log an unknown food
4. `console error` — verify no LLM errors when no API key is set (should be silent)

**Transit time display**

1. Log a food on Track page
2. Log a digestion event (would need 8h gap for real transit, so check existing data)
3. Navigate to food evidence view
4. `snapshot` — check for transit time display elements

### Task 5.2: Write Verification E2E Specs

Based on findings from Task 5.1, write `e2e/sprint-2.5-verification.spec.ts` with automated tests for the most important verifications. Focus on tests that:

- Can run without real data (or set up their own)
- Don't require an API key
- Test actual rendered UI, not just data logic

### Task 5.3: Document Findings

Create `docs/reviews/2026-03-17-sprint-2.5-browser-verification.md` with:

- Test results table (WQ item, status, notes)
- Any bugs found during verification
- Accessibility tree excerpts showing key UI states
- Console errors found
- Recommendations for follow-up

### Task 5.4: Final Verification + Commit

1. Run full quality gate:
   ```bash
   bun run typecheck
   bun run build
   bun run test:unit
   bunx playwright test
   ```
2. All gates must pass
3. Update docs/WIP.md with Wave 5 completion
4. Update docs/WORK-QUEUE.md — mark WQ-045 through WQ-049 as done or document findings
5. Commit with descriptive message
6. Do NOT bypass Husky pre-commit hooks
7. This is the final wave of Sprint 2.5 — update work queue summary

## Constraints

- 1181 unit tests currently passing, typecheck clean, build clean
- Branch: chore/consolodated-review
- Use bun (not npm/yarn)
- Never use `!` non-null assertions — narrow types properly
- playwright-cli sessions are stateful — `open` persists until `close`
- Snapshots output YAML accessibility trees with element refs (e1, e2, etc.)
- After interacting, always `snapshot` again to see the updated state
- If Convex backend isn't available, document which tests need it and skip gracefully
- Sub-agent reports should be saved to docs/WIP.md as tasks complete
