# Food Pipeline UI Fixes

> **Status as of 2026-03-16:** this plan is functionally complete except for **BUG-AMBER** (the unresolved-item affordance). Food-request persistence shipped; the remaining admin/review UI follow-up is now tracked separately in the feature backlog as `FOOD-REQUEST-ADMIN`.

> **Status as of 2026-03-15:** 10 of 10 original bugs fixed. 2 additional UX issues identified (1 open).

**Goal:** Fix bugs discovered during food pipeline browser testing — display names, expired matching, old log status, patterns table, and review modal UX.

**Architecture:** All fixes are backward-compatible patches to existing code. No new tables or schema changes. One data migration for old logs. The review modal became a queue-based flow that surfaces all unresolved items sequentially.

**Tech Stack:** Convex mutations, React, shared utilities, Sonner toasts

---

## Bug Status Summary

| #   | Bug                                                     | Status               | Notes                                                                                    |
| --- | ------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Inline edit draft uses `userSegment` for name           | FIXED                | Now uses `parsedName`                                                                    |
| 2   | Log display shows bare name with no quantity            | FIXED (this session) | `getFoodItemDisplayName` now builds "2 sl toast" from quantity + unit + name             |
| 3   | Food delete has no confirmation                         | FIXED                | Added "Sure? Yes/No" inline pattern                                                      |
| 4   | Inline edit save corrupts `parsedName`                  | FIXED                | Reconstructs `userSegment` from parsed parts                                             |
| 5   | Inline edit save destroys `rawInput`/`notes`/`mealSlot` | FIXED                | Data loss fixed by spreading `...entry.data`                                             |
| 6   | Food item shape is inconsistent                         | FIXED                | All fields now present                                                                   |
| 7   | Tooltip should be persistent                            | FIXED (this session) | Canonical name now shows inline in brackets instead of hover-only                        |
| 8   | LLM code fence stripping fails                          | FIXED                | `.trim()` called before regex                                                            |
| 9   | LLM segment match-back fails                            | FIXED                | Stronger prompt instructions                                                             |
| 10  | Food registry request is a UI stub                      | FIXED (PR #2 review) | Real `foodRequests` table + Convex mutation. Toast on success/error. ARIA listbox added. |

---

## Additional UX Issues Identified This Session

| #   | Issue                                                          | Severity | Status                                              |
| --- | -------------------------------------------------------------- | -------- | --------------------------------------------------- |
| A   | Amber dot on unresolved items is not an intuitive click target | Medium   | **OPEN**                                            |
| B   | "Matched: X (resolver)" only showed on hover                   | Low      | FIXED (this session) — now shows inline in brackets |

---

## Remaining Work

### Bug 10: Food registry request — FIXED (PR #2 review, Wave 1)

Implemented option 1 (minimal viable). Created `convex/foodRequests.ts` with `submitRequest` mutation and `foodRequests` table in schema. Fields: `userId`, `foodName`, `rawInput`, `note`, `logId`, `itemIndex`, `status` (pending/approved/rejected), `createdAt`. Modal now awaits mutation before showing toast, with error handling. No admin UI yet — follow-up task.

---

### UX Issue A: Amber dot is not an intuitive click target

**File:** `src/components/track/today-log/editors/FoodSubRow.tsx`
**Backlog:** `BUG-AMBER` in `docs/backlog/bugs.md`

**Problem:** The amber resolution dot is the only affordance for opening the matching modal on a specific item. Users may not realize it is clickable. There is no hover state, tooltip, cursor change, or label indicating interactivity.

**Options:**

1. Add `cursor-pointer` and a hover ring/glow to the dot
2. Add a visible label "Match" or "Resolve" next to the dot that appears on row hover
3. Replace dot with a small "Match" button that only appears on unresolved items

**Recommended approach:** Option 2 — show a faint "Match" label on row hover. Low cost, significantly better discoverability, keeps the calm design.

**Acceptance criteria:**

- Unresolved food item rows show a "Match" affordance on hover
- Clicking anywhere in the affordance opens the matching modal for that item
- Resolved items are unaffected

---

## Previously Completed Tasks (archived for reference)

### Task 1: Fix `resolveItem` to allow re-matching expired items — DONE

Guard in `convex/foodParsing.ts` at line ~500 was changed to allow re-matching items with `resolvedBy: "expired"` or `canonicalName: "unknown_food"`.

### Task 2: Migration to backfill `resolvedBy` on old food logs — DONE

`backfillResolvedBy` mutation added to `convex/logs.ts`. Patches items with valid `canonicalName` but no `resolvedBy` to `resolvedBy: "registry"`. Old logs no longer appear as "pending".

### Task 3: Fix display names to use `parsedName` instead of `userSegment` — DONE

`getFoodItemDisplayName` in `src/components/track/today-log/helpers.ts` and `getLoggedFoodIdentity` in `shared/foodProjection.ts` both now prefer `parsedName` over `userSegment`. Additionally, `getFoodItemDisplayName` now builds a formatted display string including quantity and unit (e.g. "2 sl toast") when those fields are present.

### Task 4: Patterns table display names — DONE (via Task 3)

Fix to `getLoggedFoodIdentity` propagated through the analysis pipeline automatically.

### Task 5: Queue-based FoodMatchingModal — DONE

`FoodMatchingModal` now supports a `queue` prop. `useUnresolvedFoodQueue` hook gathers all unresolved items. Modal shows "Item N of M" counter, advances on match, shows success state when queue is empty.

### Task 6: Wire toast "Review" to open queue modal — DONE

`handleReviewUnresolved` in `src/pages/Track.tsx` now opens the queue modal instead of scrolling to a dot. Toast "Review" button triggers the full queue flow.

---

## Execution Order for Remaining Work

Only UX Issue A (dot discoverability) remains from this plan. Bug 10 was fixed during PR #2 review fixes (Wave 1, Agent 4).

```
UX Issue A (amber dot discoverability) — standalone task
```
