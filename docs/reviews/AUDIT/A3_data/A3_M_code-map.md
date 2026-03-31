# Audit 3: Code Map + Import Trace

**Date:** 2026-03-17
**Output:** Two artifacts — a file index document and an orphan/wiring report

---

## Context

Caca Traca is a digestive recovery tracker. The codebase has ~250 source files across these directories:

- `convex/` — Backend (Convex mutations, queries, actions, schema)
- `shared/` — Pure logic shared between client and server (food registry, canonicalization, evidence, types)
- `src/lib/` — Client-side libraries (AI analysis, food parsing, habits, sync, utils)
- `src/hooks/` — React hooks
- `src/contexts/` — React contexts (Profile, ApiKey, SyncedLogs)
- `src/components/` — React components organized by domain (track, patterns, settings, ui)
- `src/pages/` — Page-level components
- `src/types/` — TypeScript type definitions
- `e2e/` — Playwright end-to-end tests
- `convex/__tests__/` and `src/lib/__tests__/` and `shared/__tests__/` — Unit/integration tests

The project uses TypeScript throughout. Import paths use `@/` alias for `src/`, `@shared/` alias for `shared/`, and relative paths for `convex/`.

---

## Task 1: Build the File Index

For EVERY `.ts` and `.tsx` file in the repo (excluding `node_modules/`, `dist/`, `convex/_generated/`), produce a table entry with:

| File Path | Lines | Purpose (1 sentence for each purpose) | Key Exports | Imported By (count) |
|-----------|-------|--------------------------|-------------|-------------------|

**Guidelines:**

- "Purpose" should be one clear sentence for each purpose so we can see where a file has more than one concern, e.g., "Convex mutation for adding and editing food logs", next line "Convex query for getting food logs", next line "Convex action for processing food logs", etc.
- "Key Exports" should list the main exported functions/types/constants (not every helper)
- "Imported By" is a count of how many other files import from this file

**Group the table by directory** with subtotals:

```
## convex/ (25 files, ~3,200 lines)
| File | Lines | Purpose | Key Exports | Imported By |
...

## shared/ (8 files, ~1,500 lines)
...

## src/lib/ (35 files, ~5,000 lines)
...
```

---

## Task 2: Import Dependency Map

For each directory, build a dependency summary showing the import relationships:

```
## Import Flow

convex/ imports from:
  → shared/ (food registry, canonicalization, types)
  → convex/lib/ (auth, input safety)

shared/ imports from:
  → (nothing — shared is a leaf)

src/lib/ imports from:
  → shared/ (food types, registry)
  → convex/_generated/ (api types)
  → src/types/ (domain types)

src/hooks/ imports from:
  → src/lib/ (sync, analysis, habits)
  → src/contexts/ (profile, API key)
  → src/store (Zustand store)
  → convex/_generated/ (api)

src/contexts/ imports from:
  → src/hooks/ (useApiKey, useProfile)
  → src/lib/ (sync, habit templates, streaks)
  → src/store (defaults, types)
  → convex/_generated/ (api)

src/components/ imports from:
  → src/hooks/
  → src/contexts/
  → src/lib/
  → src/store
  → shared/
  → convex/_generated/

src/pages/ imports from:
  → src/components/
  → src/hooks/
  → src/contexts/
  → src/lib/
  → shared/
```

Flag any **circular dependencies** or **unexpected import directions** (e.g., `shared/` importing from `src/`, `convex/` importing from `src/`, or components importing directly from `convex/` without going through hooks/contexts).

---

## Task 3: Orphan Detection

### 3a. Dead Exports

Find every exported function, type, constant, or component that is NOT imported by any other file.

```
## Dead Exports (exported but never imported)
| File | Export Name | Type (function/type/const/component) | Assessment |
```

**Assessment** should be one of:

- **Dead code — investigate purpose** (clearly unused, but may have a purpose)
- **Test-only export** (exported with `_testing` pattern, used only in tests — this is intentional)
- **Entry point** (page component, Convex endpoint — these are "imported" by the framework, not by other files)
- **Likely unwired** (looks like it was written for a purpose but never connected — investigate)

### 3b. Orphan Files

Files that are not imported by anything AND are not entry points (not pages, not Convex endpoints, not test files, not config files):

```
## Orphan Files (no importers, not entry points)
| File | Lines | Assessment |
```

### 3c. Unused Dependencies

Check `package.json` dependencies against actual import statements across the codebase:

```
## Unused npm Dependencies
| Package | In package.json | Actually Imported? | Assessment |
```

---

## Task 4: Large File Report

List every file over 300 lines, sorted by line count descending:

```
## Files Over 300 Lines
| File | Lines | Functions/Components | Decomposition Suggestion |
```

"Decomposition Suggestion" should say either:

- **Fine as-is** (large but well-organized, single responsibility)
- **Split recommended** (with specific suggestion, e.g., "Extract prompt building into separate module")
- **Needs investigation** (large and complex, can't determine without deeper review)

---

## Task 5: Function Call Trace (Key Paths Only)

Trace the call chain for these 5 critical user flows. For each, show the chain from user action to data storage:

### Flow 1: User logs a food item

```
User types in FoodSection input → [trace every function call through to Convex mutation]
```

### Flow 2: Food item goes through LLM matching

```
Unresolved food item → [trace through LLM matching to resolution or user intervention]
```

### Flow 3: Dr. Poo report generation

```
User triggers insight → [trace through AI analysis to report storage and display]
```

### Flow 4: Food trial evidence processing

```
Food log created → [trace through evidence pipeline to ingredientExposures creation]
```

### Flow 5: User changes a setting

```
User edits health profile → [trace through ProfileContext to Convex mutation]
```

For each flow, list every file and function involved in order, like:

```
1. src/components/track/panels/FoodSection.tsx → handleSubmit()
2. src/hooks/useFoodParsing.ts → parseFood()
3. src/lib/sync.ts → useAddSyncedLog() → calls convex mutation
4. convex/logs.ts → add() → calls processLogImpl()
5. convex/foodParsing.ts → processLogImpl() → deterministic matching
6. shared/foodCanonicalization.ts → canonicalizeKnownFoodName()
...
```

---

## Output Format

Produce TWO documents:

### Document 1: `CODE_INDEX.md`

Contains Task 1 (file index) and Task 2 (import flow map). This will be the new `docs/CODE_INDEX.md` for code files.

### Document 2: `CODE_HEALTH_MAP.md`

Contains Task 3 (orphan detection), Task 4 (large file report), and Task 5 (function call traces). This will be the new `docs/CODE_HEALTH_MAP.md` for code files.

---

## Rules

1. **Be exhaustive on Tasks 1 and 3.** Every file, every export. No sampling.
2. **Be practical on Task 5.** Trace the main happy path and the most common error branch.
3. **Don't modify any files.** This is read-only.
4. **Use actual line counts** (from `wc -l` or equivalent), not estimates.
5. **Flag anything surprising** — files in unexpected locations, imports that cross boundaries they shouldn't, naming that doesn't match content.
