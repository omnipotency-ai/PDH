# Audit 1: Codebase Health Review — Claude Code Prompt

**Tool:** Claude Code (parallel agent mode)
**Repo:** Caca Traca (local filesystem)
**Time estimate:** 60–90 minutes
**Output:** Single consolidated markdown report

---

## Instructions for Claude Code

You are auditing the entire Caca Traca codebase. This is an anastomosis food reintegration tracker built with React 19 + Vite + Convex + Clerk + Zustand + Tailwind v4.

**You MUST use subagents to parallelize this work.** Spawn the agent groups below in parallel. Do NOT attempt to do this sequentially yourself — the codebase is ~250 files across `convex/`, `shared/`, `src/lib/`, `src/components/`, `src/hooks/`, `src/contexts/`, `src/pages/`, and test directories.

### Rubric for Each Agent

Every file reviewed should be assessed on:

1. **Security** — Auth, sanitization, secrets, injection vectors
2. **Correctness** — Logic bugs, edge cases, type safety (no `any`, no unsafe casts)
3. **Performance** — Algorithmic complexity, unnecessary work, bundle impact
4. **Maintainability** — File size, function length, naming, comments quality (are comments explaining WHY not WHAT?)
5. **Duplication** — Same logic in multiple places
6. **Dead Code** — Unused exports, unreachable branches, commented-out code
7. **Error Handling** — Missing try/catch, swallowed errors, unhelpful error messages
8. **Accessibility** — ARIA labels, keyboard navigation, screen reader support (components only)

### Critical Rules

- **Be specific.** Every finding must reference a file path and ideally a line number or function name.
- **Comments that explain "what" instead of "why" are a finding.** The CLAUDE.md says "write boring code" — if code needs a comment explaining what it does, the code should be clearer instead.
- **Comments written BY AI agents that say things like "// Fixed as part of WP-12" or "// TODO: implement" are findings.** Flag all placeholder comments and audit trail comments and where possible report what done looks like for that part of the code..
- **`v.any()` in the Convex schema is a critical finding.** The project explicitly tracks these.
- **`as` type casts are a high finding even with a justified with a comment.**
- **Do NOT suggest adding features or changing architecture.** This audit is about the health of what exists.

### Phase 1: Spawn 6 parallel agents (domain review)

Each agent reads every file in their scope and produces findings in a file called /docs/reviews/AUDIT/A1_CC_codebase-health/(agent-name) as in A1 Convex Backend etc (-report).md  using the rubric below.

**Agent A1 — Convex Backend**
Scope: All files in `convex/` (excluding `_generated/` and `__tests__/`)
Focus: Mutations, queries, actions, schema validation, auth enforcement, input sanitization, error handling.

**Agent A2 — Shared Pure Logic**
Scope: All files in `shared/` and `shared/__tests__/`
Focus: Food registry completeness, canonicalization correctness, type safety, test coverage, dead exports.

**Agent A3 — Client Lib (AI + Food)**
Scope: `src/lib/aiAnalysis.ts`, `src/lib/aiModels.ts`, `src/lib/aiRateLimiter.ts`, `src/lib/convexAiClient.ts`, `src/lib/foodParsing.ts`, `src/lib/foodLlmCanonicalization.ts`, `src/lib/foodDigestionMetadata.ts`, `src/lib/foodStatusThresholds.ts`, `src/lib/customFoodPresets.ts`
Focus: File size / decomposition needs, prompt quality, error handling, hardcoded values, separation of concerns.

**Agent A4 — Client Lib (Everything Else)**
Scope: All other `src/lib/` files (analysis, habits, health, celebrations, sync, utils, etc.)
Focus: Correctness, duplication, performance, dead code, test coverage.

**Agent A5 — Components (Track + Quick Capture + Today Log)**
Scope: `src/components/track/` (all subdirectories)
Focus: Component size, prop drilling, accessibility, error states, loading states, responsive behavior.

**Agent A6 — Components (Patterns + Settings + UI)**
Scope: `src/components/patterns/`, `src/components/settings/`, `src/components/ui/`
Focus: Same as A5, plus design system consistency, reusable component quality.

### Phase 2: Spawn 4 parallel agents (cross-cutting concerns)

**Agent A7 — Pages, Routing, Contexts, Hooks, Store**
Scope: `src/pages/`, `src/routeTree.tsx`, `src/contexts/`, `src/hooks/`, `src/store.ts`, `src/types/`
Focus: Route configuration, context nesting, hook correctness, store shape, type completeness.

**Agent A8 — Security Pass**
Scope: Cross-cutting — check ALL files for:

- Auth enforcement on every Convex endpoint (every query/mutation/action must call `requireAuth` or equivalent)
- Input sanitization on all user-provided strings before they reach Convex or OpenAI
- API key handling (must never be logged, stored server-side, or exposed in client bundle)
- XSS vectors (dangerouslySetInnerHTML, unsanitized rendering of user content, markdown rendering without sanitization)
- CSRF/CORS configuration
- Any secrets, tokens, or credentials in source code
- `eval()`, `Function()`, or other code injection vectors

**Agent A9 — Test Quality**
Scope: All `__tests__/` directories, all `*.test.ts` files, `e2e/` directory
Focus: Coverage gaps (which functions/components have no tests), test quality (do tests actually assert meaningful behavior or just check that things don't crash), mocking correctness, E2E test reliability.

**Agent A10 — Performance + Bundle**
Scope: Cross-cutting analysis
Focus:

- Large files that should be code-split (anything over 500 lines)
- Heavy imports pulled into main bundle (check that large libs like foodRegistry are lazy-loaded)
- O(n²) or worse algorithms
- Unnecessary re-renders (components that don't memoize expensive computations)
- Convex query patterns (N+1 queries, over-fetching)

### Phase 3: Synthesis (you do this yourself, not a subagent)

Collect all findings from A1–A10. Produce a single consolidated report in the same folder as the saved reports from the agents with this structure:

```markdown
# Caca Traca — Codebase Health Audit
**Date:** [today]
**Auditor:** Claude Code (parallel agent review)
**Files reviewed:** [count]

## Executive Summary
[3-5 sentences: overall health, biggest risks, top 3 actions]

## Critical Issues (fix before any release)
| # | Category | File(s) | Description | Suggested Fix |
[Only genuine security vulnerabilities, data corruption risks, or crash-causing bugs]

## High Priority
| # | Category | File(s) | Description | Suggested Fix |
[Performance problems at scale, missing auth, significant code quality issues]

## Medium Priority
| # | Category | File(s) | Description | Suggested Fix |
[Maintainability, duplication, moderate complexity, missing error handling]

## Low Priority / Suggestions
| # | Category | File(s) | Description | Suggested Fix |
[Polish, naming, minor cleanup, nice-to-haves]

## Dead Code Report
| File | Export/Function | Status | Notes |
[Everything exported but never imported, functions defined but never called]

## Large File Decomposition Recommendations
| File | Lines | Recommendation |
[Files over 500 lines with specific split suggestions]

## Test Coverage Gaps
| File/Function | Has Tests? | Priority |
[Untested code ranked by risk]

## Security Findings
[Dedicated section from A8's output — every finding with severity and remediation]
```
