Here is the full quality gate report for the `feat/sprint-2.5+` branch.

---

**Typecheck: CLEAN**
- `tsc --noEmit` and `convex typecheck` both passed with no errors.

---

**Tests: MIXED**

*Unit tests (vitest):* **1277 passed**, 0 failed, across 49 test files. All clean.

*E2E tests (Playwright):* **80 passed, 6 failed, 2 flaky, 6 skipped** (total run time ~2.3m).

Failures:
| File | Test |
|---|---|
| `e2e/drpoo-cooldown.spec.ts:55` | Auto/Manual toggle > Auto button is pressed by default |
| `e2e/drpoo-cooldown.spec.ts:167` | Auto mode - Bristol score filtering > logging a Bristol 4 BM in Auto mode does NOT show analysis progress |
| `e2e/drpoo-cooldown.spec.ts:224` | Manual mode > user can type a question and see Send now button after submitting |
| `e2e/drpoo-cooldown.spec.ts:346` | Cooldown behavior > after generating a report, Send now triggers lightweight mode during cooldown |
| `e2e/food-pipeline.spec.ts:299` | Unresolved items > toast notification fires for unresolved items |
| `e2e/sleep-tracking.spec.ts:51` | Sleep tracking > can select hours and minutes and log sleep |

Flaky (passed on retry):
- `e2e/drpoo-cooldown.spec.ts:133` -- No API key state > Dr. Poo section shows API key prompt
- `e2e/food-pipeline.spec.ts:909` -- whitespace-only input is treated as empty

---

**Build: SUCCESS**
- Vite production build completed in 3.57s, 4765 modules transformed, PWA service worker generated. One chunk size warning (`Patterns` at 558 KB, `index` at 1390 KB) but no errors.

---

**Lint: 3 ERRORS, 6 WARNINGS**

Errors (3):
1. `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useHabitLog.ts` -- **5 instances** of `useExhaustiveDependencies`: `captureNow` missing from dependency arrays in `handleLogSleepQuickCapture` (line 211), `handleLogActivityQuickCapture` (line 376), `handleLogWeightKg` (line 466), `handleCheckboxToggle` (line 530), and `handleQuickCaptureTap` (line 587).
2. `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/LineTrack.tsx:75` -- `noUnusedFunctionParameters`: unused parameter `corridorGroup`.

Warnings (3 unique, from transit map canvas):
- `TransitMapCanvas.tsx:226` and `:450` -- `useSemanticElements`: SVG `role="button"` elements should use `<button>`.
- `TransitMapCanvas.tsx:551` -- `noStaticElementInteractions`: `<rect>` has click handler without a role.

---

**Summary:** Typecheck and build are clean. Unit tests are fully passing (1277). Six E2E tests are failing (4 in drpoo-cooldown, 1 in food-pipeline, 1 in sleep-tracking). Lint has 3 errors concentrated in `useHabitLog.ts` (missing `captureNow` dependency) and `LineTrack.tsx` (unused param), plus 3 a11y warnings in `TransitMapCanvas.tsx`.