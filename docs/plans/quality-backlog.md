# Quality Backlog

Items collected during code review that are nice-to-have fixes, not blocking.
Sweep this file when planning new initiatives for items that fit.

---

## W3-04 — 2026-04-06

- **Quality** `src/components/dr-poo/MealIdeaCard.tsx:147-154` — `meal.items` rendered with `key={item}` (item text). If AI returns duplicate strings, React emits key-collision warning and drops duplicates. Fix: `key={`${item}-${i}`}` with index.
- **Quality** `src/components/dr-poo/DrPooReport.tsx:109-133` — `insights.suspectedCulprits` iterated with `key={item.food}`. Same duplicate-key risk. Fix: `key={`${item.food}-${i}`}`.
- **Quality** `src/components/dr-poo/AnalysisProgressOverlay.tsx:38-43` — Component name `AnalysisProgressOverlay` no longer matches JSDoc ("inline, non-blocking") from when it was a true overlay. Rename to `AnalysisProgressInline` or update JSDoc.

## W3-03 — 2026-04-06

- **Architecture** `src/components/patterns/database/smartViewUtils.ts:8` — `FILTERABLE_COLUMN_IDS` is module-private but defines a structural constraint (which column IDs are valid in persisted filters). Export it (and a `FilterableColumnId` derived type) to make the constraint discoverable if a second consumer appears.
- **Quality** `smartViewUtils.ts:54-55` — `const raw = filter` alias inside `normalizeColumnFilters` adds no clarity; use `filter.id`/`filter.value` directly.

## W3-05 — 2026-04-06

- **Nice-to-have** `src/components/track/quick-capture/WeightEntryDrawer.tsx:46` — inline type predicate `(entry): entry is ... => entry.type === "weight"` should be replaced with `isWeightLog` from `@/lib/logTypeGuards`. One-line change.
- **Quality** `src/lib/logTypeGuards.ts:3` — `NarrowableLog` accepts `{ type: string; data: unknown }` fallback that is never exercised in practice. Consider narrowing to only `LogEntry | SyncedLog` once unified (follow-on from the Moderate fix).
- **Architecture** `src/lib/defaults.ts:6` — `DEFAULT_HEALTH_PROFILE.surgeryType` is hardcoded to `"Ileostomy reversal"` (primary user's specific type). Per CLAUDE.md "No Hard-Coding Personalization", default should be neutral (e.g. `""` or first/least-specific option). Value is always overwritten after onboarding, but worth fixing for public product readiness.

## W3-06 — 2026-04-06

- **Simplification** `src/components/track/today-log/editors/DigestiveSubRow.tsx:41-57` — 9 separate `useState` declarations for draft fields. Pattern is readable and correct for now, but `seedDrafts` must stay in sync with all draft fields if the type expands. Add a comment to flag this.
- **Simplification** `src/components/track/today-log/rows/LogEntry.tsx:26-28` — `DigestiveEntry` is a one-liner wrapper (`return <DigestiveSubRow entry={log} />`) that only exists for a type assertion. Could be inlined: `if (log.type === "digestion") return <DigestiveSubRow entry={log as DigestiveLog} />;`

## W3-01 — 2026-04-06

- **Quality** `convex/profileMutations.ts:160-244` — `normalizeStoredProfileHabit` returns `null`, callers filter nulls. The `.filter((habit) => habit !== null)` may not narrow type in older TS without a type guard. Fix: `.filter((habit): habit is NonNullable<typeof habit> => habit !== null)`.
- **Simplification** `convex/backup.ts:279-292` — `backupRowTimestamp` chains 9 `??` fallbacks across field names. Add a comment listing which tables use which timestamp field, so the chain can be verified against schema.
- **Architecture** `convex/backup.ts:39-53` — `USER_DATA_TABLES` and `deleteAllUserData` mix "data portability" and "account deletion" concerns. Consider moving both to `convex/lib/userData.ts` to make account deletion discoverable independently of backup/export logic.

## W3-07 — 2026-04-06

- **Simplification** `src/lib/aiPrompts.ts` (whole file) — At 1585 lines, has 4 distinct responsibilities: (1) sanitization helpers, (2) log context builders, (3) system prompt builder, (4) user message builder. Items 2 and 3 have zero coupling. Viable split targets if the file continues to grow.
