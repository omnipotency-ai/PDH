# 2026-03-28 Parallel Audit — Executive Summary

> 20 agents ran simultaneously across research, code quality, docs, and verification.

## Health Check

- **Typecheck:** Clean
- **Build:** Clean
- **Unit tests:** 1277 passing (0 failures)
- **E2E tests:** 80 passed, 6 failed (all in `drpoo-cooldown.spec.ts` — likely needs Convex backend running), 6 skipped
- **Circular deps:** None
- **Patterns page runtime error:** Could NOT reproduce — page loads cleanly

## Critical Findings

### 1. Work Queue ID Collisions (report: 13-workqueue-audit.md)

WQ-320 through WQ-329 are used TWICE — once in Sprint 2.7 (transit map canvas) and again in Sprint 7 (security/backend audit). Plus WQ-080-086 appear as "done" in Transit Map Wave 0 but "open" in Sprint 3. **17 total inconsistencies found.** Must fix before any further WQ work.

### 2. Sparkline Gradient ID Bug (report: 18-sparkline-fix.md)

`Sparkline.tsx` line 81: `color.replace("#", "")` breaks when CSS variables are passed. Both callers pass `var(--section-summary)`, producing invalid SVG IDs with parentheses. **Quick fix — sanitize to `[a-zA-Z0-9-]`.**

### 3. 73 Confirmed Dead Exports (report: 08-dead-exports-scan.md)

Across `src/lib/`, `shared/`, `src/hooks/`. Largest clusters: `aiAnalysis.ts` (8), `foodEvidence.ts` (6), `foodMatching.ts` (5), `analysis.ts` (4). Safe to remove with verification.

### 4. Unbounded `.collect()` in SyncedLogsContext (report: 05-unbounded-listall.md)

`convex/logs.ts` line 741: `listAll` query collects ALL user logs with no date window. Power users will hit Convex's 8MB/query limit. **Recommended fix: 90-day rolling window with `.take(5000)` safety cap.**

### 5. Architecture Doc Critically Stale (report: 16-architecture-doc.md)

`docs/current-state-architecture.md` still says API keys are "IDB only, never stored in Convex." Reality: dual-stored with AES-GCM encryption server-side. Multiple sections describe the old client-initiated LLM flow instead of the current server-first architecture.

## High-Value Fixes Ready to Execute

| Priority | Item                        | Effort  | Report                  |
| -------- | --------------------------- | ------- | ----------------------- |
| 1        | Sparkline gradient ID fix   | 15 min  | 18-sparkline-fix.md     |
| 2        | Work queue ID collision fix | 30 min  | 13-workqueue-audit.md   |
| 3        | TrackPage lazy import       | 5 min   | 06b-trackpage-lazy.md   |
| 4        | Dead exports cleanup (73)   | 1-2 hrs | 08-dead-exports-scan.md |
| 5        | Architecture doc rewrite    | 1 hr    | 16-architecture-doc.md  |

## Research Plans Ready for Implementation

| Plan                                  | LOC Impact                      | Report                  |
| ------------------------------------- | ------------------------------- | ----------------------- |
| aiAnalysis.ts split (4 modules)       | 2657 → 4 files                  | 02-aianalysis-split.md  |
| LogEntry.tsx refactor                 | 832 → ~400 + delegates          | 03-logentry-split.md    |
| analyzeLogs dedup (shared context)    | Eliminates duplicate compute    | 04-analyzelogs-dedup.md |
| Unbounded listAll fix (90-day window) | Prevents data growth crash      | 05-unbounded-listall.md |
| Error code system (94+ errors)        | Structured ConvexError adoption | 12-error-codes.md       |
| Empty state components                | New EmptyState + Skeleton       | 10-empty-states.md      |

## Audits Completed

| Audit                      | Key Finding                                                                        | Report                  |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| Terminology drift          | 8 term groups with variants; "transit map", "food trial", "Dr. Poo" are canonical  | 09-terminology-audit.md |
| Hardcoded strings          | 11 locations with surgery/medical/drug keywords needing parameterization           | 11-hardcoded-strings.md |
| Legacy sleep readers       | All migrated — NO legacy readers remain                                            | 14-legacy-sleep.md      |
| Dead code (WQ-150/151/153) | WQ-150 NOT dead (3 consumers), WQ-151 NOT dead, WQ-153 partially dead              | 07-dead-code-verify.md  |
| Pixel font sizes           | 317 instances of `text-[10px]`/`text-[11px]` across 81 files                       | 19-pixel-fonts.md       |
| Launch criteria            | Files are gitignored; claims "75 E2E + 33 unit" vs actual 1277 unit + 12 E2E files | 17-launch-criteria.md   |

## No Action Needed

- **WQ-198 (legacy sleep):** Fully migrated, no legacy readers found. Can close.
- **WQ-150 (toLegacyFoodStatus):** NOT dead — 3 active consumers. Keep.
- **WQ-151 (columns export):** NOT dead — used by DatabaseTable. Keep.
