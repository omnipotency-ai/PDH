# Quality Backlog

Items collected during code review that are nice-to-have fixes, not blocking.
Sweep this file when planning new initiatives for items that fit.

---

## Layout Phase 1 PR Review — 2026-04-10

- **Simplification** `src/hooks/useTodayLogCrud.ts:26-45` and `src/hooks/useDayStats.ts:50-64` — both files now own near-identical "activity type -> matching habits" and fluid normalization logic. Extract shared helpers to avoid the two paths drifting.
- **Quality** `src/components/track/TodayStatusRow.tsx:10,19-41` — `nowMs` still drives severity colouring, but the rendered copy no longer explains elapsed time. Either restore elapsed wording or drop the prop so the component has one consistent concept of "last BM".
- **Simplification** `src/pages/Home.tsx:157-159` — `useEffect(() => setDismissedCard(false), [])` only re-states the initial `useState(false)` value and can be removed.
- **Nice-to-have** `src/components/track/quick-capture/QuickCapture.tsx:59` — the grid no longer expands past three columns on larger breakpoints. If the tighter layout was intentional, add a comment or design note; otherwise restore the wider desktop breakpoints.

## Settings Simplification Follow-up — 2026-04-10

- **Nice-to-have** Build a dedicated medications log with schedule/reminder support instead of keeping medication details inside the generic health profile. Scope should include active meds, dose timing, reminder nudges, and adherence logging.

## W0 Schema Widening — 2026-04-08

- **Quality** `convex/validators.ts:382` — `customPortionValidator.weightG` allows zero/negative. Fix: enforce positive value in mutation layer (W6 when custom portions UI ships).
- **Architecture** `convex/schema.ts:91` — `clinicalRegistry.by_canonicalName` index doesn't enforce uniqueness (Convex limitation). Fix: check-before-insert in seed script (W2-T01).
- **Architecture** `convex/schema.ts:417` — `profiles.foodFavouriteSlotTags` v.record keys are `v.string()` (broad). Fix: validate canonical food name format in mutation layer (W2-T04).

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

## W3-06 — 2026-04-06

- **Simplification** `src/components/track/today-log/editors/DigestiveSubRow.tsx:41-57` — 9 separate `useState` declarations for draft fields. Pattern is readable and correct for now, but `seedDrafts` must stay in sync with all draft fields if the type expands. Add a comment to flag this.
- **Simplification** `src/components/track/today-log/rows/LogEntry.tsx:26-28` — `DigestiveEntry` is a one-liner wrapper (`return <DigestiveSubRow entry={log} />`) that only exists for a type assertion. Could be inlined: `if (log.type === "digestion") return <DigestiveSubRow entry={log as DigestiveLog} />;`

## W3-01 — 2026-04-06

- **Quality** `convex/profileMutations.ts:160-244` — `normalizeStoredProfileHabit` returns `null`, callers filter nulls. The `.filter((habit) => habit !== null)` may not narrow type in older TS without a type guard. Fix: `.filter((habit): habit is NonNullable<typeof habit> => habit !== null)`.
- **Simplification** `convex/backup.ts:279-292` — `backupRowTimestamp` chains 9 `??` fallbacks across field names. Add a comment listing which tables use which timestamp field, so the chain can be verified against schema.
- **Architecture** `convex/backup.ts:39-53` — `USER_DATA_TABLES` and `deleteAllUserData` mix "data portability" and "account deletion" concerns. Consider moving both to `convex/lib/userData.ts` to make account deletion discoverable independently of backup/export logic.

## W4-09 — 2026-04-06

- **Simplification** `convex/foodParsing.ts:449-454` — Conditional spread for `embeddingSourceHash` in `listFoodEmbeddingVersions` is unnecessary since the type already declares it optional. Simplify to direct mapping: `embeddingSourceHash: row.embeddingSourceHash`.
- **Quality** `convex/foodParsing.ts:412-427` — `listFoodEmbeddings` comment says "only use when callers need full vector data" but doesn't name those callers. Add `// Called by: <actual callers>` to prevent accidental dead-code deletion.

## W4-11 — 2026-04-06

- **Quality** `src/contexts/ProfileContext.tsx:155–171` — Comment says "shallow field-by-field check" but uses per-field `JSON.stringify` (which is deep comparison). Update comment to "deep field-by-field check via per-field JSON.stringify".
- **Quality** `src/contexts/ProfileContext.tsx:184–186` — `Object.fromEntries` filter cast to `PatchProfileArgs` is wider than necessary. If mutation arg type is importable, tighten the cast. Keep existing comment so assumption is visible.
- **Quality** `src/contexts/ProfileContext.tsx:101–103` — `resolveProfile` parameter typed via `ReturnType<typeof useQuery<...>>` (hook reflection). Fragile if query is renamed/split. Replace with explicit `Doc<"userProfiles"> | null | undefined`.

## W3-07 — 2026-04-06

- **Simplification** `src/lib/aiPrompts.ts` (whole file) — At 1585 lines, has 4 distinct responsibilities: (1) sanitization helpers, (2) log context builders, (3) system prompt builder, (4) user message builder. Items 2 and 3 have zero coupling. Viable split targets if the file continues to grow.
