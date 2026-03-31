# Backlog Dashboard

**Last updated:** 2026-03-17

---

## Ship Blockers

- **CI-PIPELINE** — CI pipeline setup (no CI currently; all tests run locally only)

## Active Projects

| Project                    | Status                           | Next step                                     | Key doc                                          |
| -------------------------- | -------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| Audit Remediation          | Queue consolidated               | Work Sprint 0 (immediate security items)      | `docs/backlog/audit-remediation.md`              |
| Transit Map / Food System  | Phases 1-4 + Tasks 1-11 complete | Phase 5 UI (transit map + game layer rebuild) | `docs/archive/scratchpadprompts/transitmap.md`   |
| AI Prompting (v3 strategy) | ~30% designed                    | Finish strategy doc                           | `docs/dr-poo-prompts/v3-strategy.md`             |
| E2E Testing                | 75 passing, 1 TDD failure        | Fix selectors/timing                          | `memory/project_e2e_testing_session.md`          |
| Browser Testing Pass 2     | Incomplete                       | Settings, AI, Menu                            | `docs/browser-testing/2026-03-09-v1-test-run.md` |

## Bug Summary

| Severity | Open | Fixed/Resolved |
| -------- | ---- | -------------- |
| Critical | 2    | 0              |
| High     | 5    | 0              |
| Medium   | 24   | 3              |
| Low      | 18   | 3              |
| Deferred | 2    | 0              |
| Descoped | 2    | 0              |

> Food system pipeline bugs #1-9 (FP-01 through FP-09) all **fixed** as of 2026-03-14.
> Bug #10 (registry request UI stub) is open — tracked as BUG-10.
> BUG-01, BUG-02 (reproductive health) descoped per ADR-0008.
> Audit findings consolidated in [`audit-remediation.md`](./audit-remediation.md).

## Tech Debt Summary

| Priority      | Open                       |
| ------------- | -------------------------- |
| High          | 3 (TD-01, PERF-001, TD-12) |
| Medium        | 6                          |
| Low / Cleanup | 2 (INV-01, CONVEX-ORPHANS) |

## Feature Summary

| Priority      | Count |
| ------------- | ----- |
| Ship Blockers | 1     |
| High          | 12    |
| Medium        | 20    |
| Low           | 6     |
| Future        | 14    |
| Descoped      | 1     |

## Pages Needing Browser Testing

- **Settings** — BT-46, BT-47, BT-51, BT-52, BT-53, BT-54, BT-55
- **AI system** — BT-35, BT-36, BT-37, BT-38, BT-42, BT-43, BT-61
- **Menu** — BT-22, BT-23, BT-24

## Session Checklist

After every working session, update:

- [ ] `docs/backlog/DASHBOARD.md` (this file — counts)
- [ ] `docs/backlog/audit-remediation.md` (if working audit items)
- [ ] `docs/backlog/bugs.md` or `features.md` or `tech-debt.md` (if items changed)

## Detail Files

- [bugs.md](./bugs.md) — All bugs by severity
- [features.md](./features.md) — All features by priority
- [tech-debt.md](./tech-debt.md) — Architectural and technical debt
- [audit-remediation.md](./audit-remediation.md) — Unified audit work queue
