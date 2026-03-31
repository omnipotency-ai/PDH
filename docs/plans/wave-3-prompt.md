# Wave 3 Prompt: LLM Pipeline

> Copy-paste this prompt to start Wave 3 in a new conversation.

---

Execute Sprint 2.5 Wave 3: LLM Food Matching Pipeline.

You are an orchestrator. Dispatch sub-agents (Opus only) for all implementation work.
Do NOT read implementation files yourself — sub-agents read what they need.
Your job is to coordinate, verify, and commit. Aggressively manage your context window.

## Files to read BEFORE dispatching (orchestrator reads these, short files):

- CLAUDE.md — engineering principles
- docs/plans/2026-03-17-sprint-2.5-transit-and-llm-pipeline.md — the implementation plan (Wave 3 section + Wave 1 research results with file pointers)
- docs/research/2026-03-17-LLM-Cost-Analysis-Food-Matching.md — LLM cost research (sub-agents read sections as needed)
- docs/WIP.md — execution log (append Wave 3 progress as tasks complete)
- docs/WORK-QUEUE.md — update WQ item statuses as they're addressed

## Memory context (do NOT read these files, just know the decisions):

- BYOK keys currently in IndexedDB (client-side). Memory says preferred architecture is server-side Convex, but plan says client-initiated BYOK for now.
- Binary LLM matching confirmed (no confidence scores in v1)
- Model candidates: gpt-4.1-nano, gpt-5-nano, gpt-4.1-mini, gpt-5-mini, Gemini 2.5 Flash Lite
- Tavily (1,000/mo free) + Google Custom Search (100/day free) for web search
- Total cost ~$0.11/month per user with BYOK, $0 with free Gemini fallback
- The `matchUnresolvedItems` action in `convex/foodLlmMatching.ts` is currently stubbed (handler is no-op) BUT supporting code IS implemented: `buildRegistryVocabularyForPrompt()`, `buildMatchingPrompt()`, `parseLlmResponse()`, `processLlmResults()`
- `useFoodLlmMatching.ts` hook exists but is dead code (zero importers)
- The server pipeline's `tryLlmFallback()` in `convex/foodParsing.ts` uses `process.env.OPENAI_API_KEY` (not set → silently skips)
- Never bypass Husky pre-commit hooks. Fix problems to commit.
- ALL sub-agents must use Opus model

## Wave 3 Tasks (in order):

### Task 3.1: Architecture Decision — Client-Initiated BYOK

**No code changes — just confirm approach.**
The pipeline should be client-initiated BYOK:

- User's API key is stored in IndexedDB (already implemented)
- Client detects unresolved foods after server pipeline runs
- Client calls a Convex action passing the API key transiently
- Action calls OpenAI/compatible API, returns results
- Client applies results via Convex mutation
- Key never stored server-side at rest

### Task 3.2: Un-stub `matchUnresolvedItems` Action

**Files:** `convex/foodLlmMatching.ts`

- The handler is a no-op (line ~383-399) returning `{ matched: 0, unresolved: 0 }`
- Supporting code already exists: `buildRegistryVocabularyForPrompt()`, `buildMatchingPrompt()`, `parseLlmResponse()`, `processLlmResults()`
- Un-stub: wire the handler to call the existing supporting functions
- Add `requireAuth(ctx)` for auth guard
- Accept: `apiKey`, `logId`, `unresolvedItems[]`
- Call OpenAI (model-agnostic — let the user configure which model)
- Parse structured response via existing `parseLlmResponse()`
- Return matched items

### Task 3.3: Implement `applyLlmResults` Mutation

**Files:** `convex/foodLlmMatching.ts` or `convex/foodParsing.ts`

- Take the LLM results and apply them:
  - Update food log items with canonical names and `resolvedBy: "llm"`
  - Create/update `ingredientExposures` for newly resolved items
  - Schedule evidence reprocessing
- This may already be partially implemented in `processLlmResults()` — check before writing new code

### Task 3.4: Review/Update the LLM Prompt

**Files:** `convex/foodLlmMatching.ts` (existing `buildMatchingPrompt()`)

- Review the existing prompt for correctness
- Ensure it handles multi-ingredient inputs ("chicken pasta with cheese sauce")
- Returns structured JSON with: canonicalName, reasoning, suggestedZone
- Binary matching (match/no-match), NOT confidence scores
- Token-efficient (user is paying per token)
- If the existing prompt is good, no changes needed

### Task 3.5: Wire the Client Hook

**Files:** `src/hooks/useFoodLlmMatching.ts`, `src/components/track/FoodMatchingModal.tsx` or `Track.tsx`

- The hook exists but has zero importers — re-activate it
- Mount it in the appropriate component
- After food log is processed by server pipeline, check for unresolved items
- If unresolved items exist AND user has an API key configured → auto-trigger LLM matching
- Show progress in UI (matching indicator on unresolved items)
- On completion, update the food log items

### Task 3.6: Tests + Commit

- Write tests for:
  - LLM prompt construction (unit test — no API call)
  - `applyLlmResults` mutation (Convex test)
  - Result parsing (structured JSON → ProcessedFoodItem mapping)
  - Error handling: invalid API key, malformed response
- Run `bun run test:unit` + `bun run typecheck` + `bun run build`
- All 1126 existing tests must still pass
- Commit with descriptive message
- Do NOT bypass Husky pre-commit hooks

## Constraints:

- 1126 unit tests currently passing, typecheck clean, build clean
- Branch: chore/consolodated-review
- Use bun (not npm/yarn)
- Never use `!` non-null assertions — narrow types properly
- Re-read files after formatter runs (Biome may change them)
- The 5-Second TS Rule: wait 5 seconds before investigating TypeScript errors after edits
- Write boring code, don't be clever
- Sub-agents reports should be saved to docs/WIP.md as each agent completes a task
- Update Work-queue on completion of the wave and prepare the prompt for the next wave (Wave 4)
