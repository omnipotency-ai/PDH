Here is the complete research summary.

---

## File Tracking Status

All files in `docs/product/` are **gitignored** via a `product/` pattern in `.gitignore` (line 23). `git check-ignore` confirms this. None of these files are tracked in git. This matches WQ-166 and WQ-167.

**Files found in `docs/product/`:**
- `launch-criteria.md` (WQ-165, WQ-166)
- `scope-control.md` (WQ-167)
- `risk-register.md`
- `README.md`
- `CacaTraca_Roadmap_Q2Q3_2026.xlsx`

---

## Current Actual Values (as of 2026-03-26)

| Metric | Actual |
|---|---|
| Vitest unit tests | **1277 passing** across 49 test files |
| E2E spec files | **12 files** in `e2e/` |
| E2E test/it/describe blocks | ~167 total across those 12 files |
| Active branch | `feat/sprint-2.5+` (not `feature/v1-sprint`) |
| CI pipeline | **Exists** (`.github/workflows/ci.yml` + `.husky/pre-commit`) -- WQ-001 is done |
| `v.any()` in schema | **0 occurrences** |
| `dangerouslyAllowBrowser` in src | **0 occurrences** |

---

## Stale Claims Found

### 1. `docs/product/launch-criteria.md`

| Location | Stale Claim | Correct Value |
|---|---|---|
| Line 64 (T8 notes) | "75 E2E tests passing... 33 shared/ unit tests" | 1277 unit tests, 12 E2E spec files (~167 test blocks) |
| Line 64 (T8 notes) | "1 TDD failure pending implementation, 6 skipped" | Needs verification -- 0 failures currently |
| Line 101 (blockers) | "75 E2E + 33 unit tests passing" | 1277 unit tests, 12 E2E spec files |
| Line 56 (T9) | Status: **Blocker** | CI pipeline exists now (WQ-001 done) -- should be **Done** |
| Line 104 (blockers) | T9 listed as active blocker | CI pipeline is implemented |

### 2. `docs/product/risk-register.md`

| Location | Stale Claim | Correct Value |
|---|---|---|
| Line 20 (R-09 summary) | Status: **Open** (ship blocker) | CI exists -- should be **Mitigated** or **Done** |
| Line 111 (R-05 mitigation) | "names the two remaining blockers (#80 and CI)" | CI is done; #80 was downgraded per ADR-0008 |
| Line 177 (R-09 detail) | Status: Open (ship blocker) | Should be Mitigated/Done |
| Line 181 | "All tests (75 E2E + 33 unit) run manually only" | 1277 unit tests, CI pipeline exists |

### 3. `docs/product/README.md`

| Location | Stale Claim | Correct Value |
|---|---|---|
| Line 55 | "Branch `feature/v1-sprint` is the active development branch" | Active branch is `feat/sprint-2.5+` |
| Line 61 | "E2E test suite: 75 passing... 33 unit tests" | 1277 unit tests, 12 E2E spec files |
| Lines 65-67 | Two remaining blockers: #80 and CI | CI is done, #80 downgraded |

### 4. `docs/product/scope-control.md`

| Location | Stale Claim | Correct Value |
|---|---|---|
| Line 10 | "In Scope for Current Sprint (feature/v1-sprint)" | Active branch is `feat/sprint-2.5+` |
| Line 19 | CI pipeline: "Sole remaining ship blocker; no automated test runs exist yet" | CI exists (WQ-001 done) |

### 5. WQ-165 itself (in `docs/WORK-QUEUE.md`)

| Location | Stale Claim | Correct Value |
|---|---|---|
| Line 451 | "actual is 607 unit tests" | Actual is now **1277 unit tests** (WQ-165's own description is stale) |

---

## Summary

All four documents in `docs/product/` are frozen at 2026-03-15 to 2026-03-17 state and are gitignored (untracked). The stale "75 E2E + 33 unit" test count appears in **4 files across 6 locations**. Additionally, the CI pipeline blocker (T9/R-09) is marked open in 3 files but is actually done. The branch reference `feature/v1-sprint` is stale in 2 files. And WQ-165 itself has a stale count (says 607, actual is 1277).