# Audit 4: Deep File Review — Gemini 3.1 Pro Prompt

**Output:** One detailed review per file, then combine into a single report

---

## How to Use This

Paste the ENTIRE file contents into the prompt along with the instructions below. Do one file per session for best results.

---

## Files to Audit (in priority order)

| # | File | Lines | Why it's critical |
| - | ---- | ----- | ----------------- |
| 1 | `src/lib/aiAnalysis.ts` | ~1,800 | Largest file. Contains all 7 LLM prompt types. Ship blocker #80 lives here. |
| 2 | `shared/foodRegistry.ts` | ~2,800 | Static food data. Correctness here affects every food-related feature. |
| 3 | `convex/logs.ts` | ~1,200 | Core data mutations. Every log entry flows through here. |
| 4 | `convex/migrations.ts` | ~900 | Data migrations. Getting these wrong corrupts the database. |
| 5 | `shared/foodEvidence.ts` | ~600 | Evidence scoring pipeline. Determines food safety verdicts. |
| 6 | `src/lib/habitCoaching.ts` | ~500 | Habit coaching logic. Less critical but complex. |

---

## Prompt Template (paste this BEFORE the file contents)

You are performing a thorough code review of a single file from a TypeScript/React application called Caca Traca — a digestive recovery tracker for post-surgery patients.

Stack context: React 19, Vite, Convex (serverless backend), Clerk auth, Zustand (ephemeral state only), Tailwind v4, OpenAI API (user-provided keys).

Review this file against ALL of the following dimensions. Be exhaustive. Reference specific line numbers.

### 1. Security

- Any user input that reaches this file — is it sanitized?
- Any API keys, secrets, or sensitive data handling?
- Any injection vectors (prompt injection for AI files, XSS for rendering files)?
- Auth checks — does every endpoint verify the user?

### 2. Correctness

- Logic errors, off-by-one errors, race conditions
- Edge cases not handled (null, undefined, empty arrays, zero values)
- Type safety — any `as` casts, `any` types, or unsafe assumptions?
- Date/time handling — timezone issues, midnight boundary bugs?

### 3. Performance

- O(n²) or worse algorithms
- Unnecessary iterations over large datasets
- Functions that could be memoized but aren't
- Heavy computation that should be cached or debounced

### 4. Maintainability

- Functions over 50 lines — should they be split?
- Deeply nested logic (3+ levels of nesting)
- Magic numbers or hardcoded strings that should be constants
- Unclear naming — variables or functions whose purpose isn't obvious from the name

### 5. Duplication

- Repeated patterns within this file that could be extracted
- Logic that likely duplicates code in other files (note: you may not have the other files, but flag anything that feels like it should be shared utility code)

### 6. Error Handling

- try/catch blocks — do they handle errors meaningfully or swallow them?
- Thrown errors — are error messages descriptive?
- Async operations — is every await wrapped appropriately?
- Convex-specific: do mutations/actions handle partial failure?

### 7. Comments & Documentation

- Comments that explain "what" instead of "why" — flag these
- Comments that are stale (describe code that no longer matches) — flag these
- Comments that look like AI agent audit trails ("// Fixed in WP-12", "// TODO: implement") — flag these for removal
- JSDoc on public functions — present and accurate?

### 8. Dead Code

- Unreachable branches
- Functions defined but never called within this file
- Commented-out code blocks
- Imports that are unused

### 9. Specific to File Type

#### If this is an AI/prompt file

- Prompt quality: clear instructions, structured output format, injection resistance
- Token efficiency: is the prompt unnecessarily long?
- Are there conflicting instructions in the prompt?
- Is the prompt version tracked?

#### If this is a data file (registry, constants)

- Completeness: obvious missing entries?
- Consistency: do all entries follow the same structure?
- Ordering: is there a logical order, or is it random?

#### If this is a Convex mutation/action

- Auth on every endpoint?
- Input validation before processing?
- Idempotency where appropriate?
- Error messages that help debugging?

#### If this is a React component

- Accessibility (ARIA, keyboard, focus management)
- Loading and error states
- Memoization of expensive computations
- Prop types — are they well-defined?

### Output Format

#### Deep Review: [filename]

**Lines:** [count]
**Overall assessment:** [1-2 sentences]
**Risk level:** Critical / High / Medium / Low

#### Critical Issues

[Things that could cause data loss, security breaches, or crashes]

#### High Priority

[Significant bugs, performance problems, missing error handling]

#### Medium Priority

[Maintainability, complexity, moderate issues]

#### Low Priority

[Polish, naming, minor improvements]

#### Specific Recommendations

[Top 3-5 concrete actions to improve this file, in priority order]

#### Dead Code Found

[List with line numbers]

#### Stale/Bad Comments Found

[List with line numbers and what's wrong with each]

---

**HERE IS THE FILE TO REVIEW**
[PASTE ENTIRE FILE CONTENTS HERE]

**After All Files Are Reviewed**
Combine the 6 individual reviews into a single summary document:

## Caca Traca — Deep File Audit Summary

**Date:** [today]
**Reviewer:** Gemini 3.1 Pro
**Files reviewed:** 6 (largest/most critical files)

### Cross-File Findings

[Patterns that appear across multiple files]

### Priority Matrix

| File | Critical | High | Medium | Low | Risk Level |
[One row per file]

### Top 10 Actions (across all files)

[The 10 most important fixes, ranked]

### Detailed Reviews

[Include each individual review below]
