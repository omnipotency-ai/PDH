# Skill A/B Test Plan

**Date:** 2026-04-08
**Model:** sonnet (all agents)
**Method:** Each task run twice — once WITH the skill/agent definition loaded, once WITHOUT (raw prompt + minimal stack context). Agents write output to markdown files for comparison.

## Test 1: Implementer Skill

**Task:** Add a "last eaten" relative timestamp (e.g., "2h ago", "3 days ago") to each food item in the FoodFilterView's "Recent" tab. Use the existing `recentFoods` data source.

- **Agent A (with skill):** Reads `.claude/skills/vite-react-implementer/SKILL.md` first, follows all patterns
- **Agent B (without skill):** Gets basic stack info (React, Convex, Tailwind, TypeScript) but no project-specific guidance

**Evaluation criteria:**

- Correct use of existing data hooks (useSyncedLogs vs custom)
- TypeScript strictness compliance (exactOptionalPropertyTypes, no any)
- Tailwind v4 patterns (CSS custom properties, not hardcoded colors)
- Component patterns (data-slot, cn(), CVA where appropriate)
- Code quality (boring, readable, error handling)

## Test 2: Code Reviewer Agent

**Task:** Review `src/components/track/nutrition/NutritionCard.tsx` for issues.

- **Agent A (with agent def):** Uses the full code-reviewer agent definition (Convex checks, Clerk auth, severity levels)
- **Agent B (without agent def):** "Review this React component for bugs, security issues, performance problems, and code quality"

**Evaluation criteria:**

- Number of real issues found
- False positive rate
- Stack-specific findings (Convex patterns, auth, reactivity)
- Actionability of suggestions
- Severity accuracy

## Test 3: Test Writer Agent

**Task:** Write unit tests for `shared/foodNormalize.ts` — test the normalization functions with edge cases.

- **Agent A (with agent def):** Uses full test-writer definition (no mocks, convex-test, meaningful assertions)
- **Agent B (without agent def):** "Write comprehensive unit tests for this module using vitest"

**Evaluation criteria:**

- Test quality (do they verify behavior or just structure?)
- Mock usage (less is better)
- Edge case coverage
- Will tests actually run? (correct imports, test patterns)
- Follows existing test patterns in the codebase
