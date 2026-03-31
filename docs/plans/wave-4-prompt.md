# Wave 4 Prompt: Food Registry Hardening

> Copy-paste this prompt to start Wave 4 in a new conversation.

---

Execute Sprint 2.5 Wave 4: Food Registry Hardening.

You are an orchestrator. Dispatch sub-agents (Opus for complex tasks, Sonnet for well-defined tasks) for all implementation work.
Do NOT read implementation files yourself — sub-agents read what they need.
Your job is to coordinate, verify, and commit. Aggressively manage your context window.

## Files to read BEFORE dispatching (orchestrator reads these, short files)

- CLAUDE.md — engineering principles
- docs/plans/2026-03-17-sprint-2.5-transit-and-llm-pipeline.md — the implementation plan (Wave 4 section)
- docs/WIP.md — execution log (append Wave 4 progress as tasks complete)
- docs/WORK-QUEUE.md — update WQ item statuses as they're addressed

## Memory context (do NOT read these files, just know the decisions)

- Wave 3 (LLM pipeline) is complete: 1145 tests passing, typecheck clean, build clean
- Branch: chore/consolodated-review
- Never bypass Husky pre-commit hooks. Fix problems to commit.
- Never use `!` non-null assertions — narrow types properly
- Write boring code, don't be clever
- Use bun (not npm/yarn)
- Re-read files after formatter runs (Biome may change them)
- The 5-Second TS Rule: wait 5 seconds before investigating TypeScript errors after edits

## Wave 4 Tasks (in order)

### Task 4.1: Registry Data Fixes

**Files:** `shared/foodRegistry.ts`, `shared/foodNormalize.ts`

Fix known issues:

- WQ-139: Reclassify `gelatin dessert` from `carbs/grains` to `protein`
- WQ-140: Remove duplicate `"lactose free spreadable cheese"` from `cream_cheese` examples
- WQ-141: Remove reflexive self-mapping `["pureed potato", "pureed potato"]` from SYNONYM_MAP
- Add common standalone words that are currently missing (chicken, bread, fish, rice, pasta — verify which are missing)

### Task 4.2: Food Match Candidate Merging

**Files:** `shared/foodMatching.ts` — `mergeFoodMatchCandidates`, `shared/__tests__/foodMatchCandidates.test.ts`

Write tests for `mergeFoodMatchCandidates` (WQ-062) and fix any issues found:

- How are candidates from different sources (alias, fuzzy, embedding, LLM) merged?
- What happens with conflicting canonical names from different sources?
- Confidence score aggregation

### Task 4.3: Preparation for Per-Food Registry Audit

**Files:** `docs/plans/food-registry-audit-checklist.md`

Create a checklist template for auditing each food registry item:

- Is the canonical name correct and unambiguous?
- Is the group/line classification correct?
- Is the zone assignment clinically appropriate?
- Are the examples comprehensive?
- Are the aliases complete?
- Is the `lineOrder` sensible for progression?

### Task 4.4: Tests + Commit

- Run `bun run test:unit` + `bun run typecheck` + `bun run build`
- All 1145 existing tests must still pass
- Commit with descriptive message
- Do NOT bypass Husky pre-commit hooks

## Constraints

- 1145 unit tests currently passing, typecheck clean, build clean
- Branch: chore/consolodated-review
- Use bun (not npm/yarn)
- Never use `!` non-null assertions — narrow types properly
- Re-read files after formatter runs (Biome may change them)
- The 5-Second TS Rule: wait 5 seconds before investigating TypeScript errors after edits
- Write boring code, don't be clever
- Sub-agents reports should be saved to docs/WIP.md as each agent completes a task
- Update Work-queue on completion of the wave and prepare the prompt for the next wave (Wave 5)
