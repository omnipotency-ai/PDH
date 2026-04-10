# PR Review: `odyssey/layout-phase-1`

Date: 2026-04-10
Base: `main`
Head: `odyssey/layout-phase-1`
Scope: full diff in commits `9297831`, `1206872`, `ccb9697`

## Summary

- Critical: 0
- High: 1
- Moderate: 2
- Low / nice-to-have: moved to `docs/plans/quality-backlog.md`

## Verification

- `bun run typecheck`
- `bun run build`

## Findings

### HIGH

#### H1. Home status row mixes selected-day totals with all-time bowel timing

- File: `src/pages/Home.tsx`
- Lines: 429-441, 488-493
- File: `src/components/track/TodayStatusRow.tsx`
- Lines: 34-41, 91

The desktop status row is presented as day-scoped context for the currently selected date, but `lastBmTimestamp` is computed from every digestion log in `logs`, not from the selected day. At the same time, the new formatter only renders a time-of-day (`Last BM at 8:14 am`) without the date. When the user browses a prior day, the banner can therefore show:

- BM count for the selected day
- Fluid total for the selected day
- Last BM time from some other day, including a later day

In a health tracker, that is misleading and undermines trust in the summary strip.

Recommended fix:

- Either derive `lastBmTimestamp` from `selectedLogs`, or explicitly label it as a global/latest value with a full date.
- If the intent is selected-day context, keep all three metrics sourced from the same date window.

### MODERATE

#### M1. The new shared date state is only wired on Home

- File: `src/store.ts`
- Lines: 11-16, 47-63
- File: `src/pages/Track.tsx`
- Lines: 90-153

This branch adds a store-backed `activeDate` API with `goBack`, `goForward`, and `goToToday`, and Home now uses it. Track still maintains its own local `selectedDate` state. That leaves the "shared date context" implementation half-finished: if the user browses an older day on Home and then opens Track normally, Track resets back to today unless the navigation happened through the special pending-edit flow.

Why it matters:

- The diff introduces a global date concept but does not apply it consistently.
- Users can end up seeing two different active dates across the two primary logging surfaces.
- This is the kind of partial state migration that creates hard-to-explain behavior later.

Recommended fix:

- Move Track onto the same `activeDate` store selectors, or remove the shared-date API until both surfaces use it consistently.

#### M2. The PR includes local and generated artifacts that should not merge

- File: `.claude/settings.local.json`
- Lines: 1-11
- File: `tsconfig.tsbuildinfo`
- Line: 1

Two non-product files are included in the diff:

- `.claude/settings.local.json`: local tool permission config
- `tsconfig.tsbuildinfo`: generated TypeScript incremental cache

These do not belong in a feature PR. They add noise, create avoidable merge conflicts, and in the first case leak workstation-specific agent configuration into the repository.

Recommended fix:

- Remove both from the branch before merge.
- Ignore the generated file if it is not already ignored.
- Keep local AI/tool settings out of the tracked tree unless the team has explicitly decided to version them.

## Lower-Severity Follow-Ups

Lower-severity simplifications and quality items from this review were added to `docs/plans/quality-backlog.md` so they can be swept separately from the merge-blocking fixes above.
