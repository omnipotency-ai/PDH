# Post-Audit Triage, Scope Gating & Documentation Consolidation

## Context

Five parallel audits (Claude Code 10-agent, GPT 5.4 gap analysis, Manus code map, Gemini deep review, NotebookLM cross-ref) produced ~500KB of findings across the Caca Traca codebase. The documentation has grown to 120+ files with significant duplication, staleness, and overlap. The user needs to blast through issues efficiently and can't maintain the current doc surface area.

**User decisions:**

1. Reproductive health: **OUT** of v1 (gate it properly in code)
2. Transit map: **IN** v1 (finish it)
3. Prompt management (#80): **DOWNGRADE** from ship blocker
4. Food status surface: **FUSED** (deterministic + AI, already implemented)

**Goal:** One clean work queue, lean docs, proper v1 scope gating, updated memory.

---

## Phase 1: Record Decisions (ADR + Backlog Updates)

**Purpose:** Lock in the four decisions so they're findable and authoritative.

### 1A. Create ADR-0008: v1 Scope Gate Decisions

- **File:** `docs/adrs/0008-v1-scope-gate-decisions.md`
- **Content:** The four decisions above with rationale. This is the canonical reference for "why is repro hidden" / "why is prompt management not a blocker" etc.

### 1B. Update `docs/backlog/features.md`

- Change BT-80 (OpenAI prompt management) from **Ship Blocker** to **Medium** with note: "Downgraded per ADR-0008. Hardcoded versioned prompts acceptable for v1."
- Move WIP-BI1 (Pregnancy/reproduction support) from Future to explicit "Descoped for v1 per ADR-0008"
- Add CI-PIPELINE to Ship Blockers (this is the real remaining blocker per audit)

### 1C. Update `docs/backlog/DASHBOARD.md`

- Ship Blockers: Replace BT-80 with CI-PIPELINE
- Add new "Audit Remediation" active project row pointing to the unified work queue (Phase 3)
- Update bug/feature/debt counts after triage

---

## Phase 2: Gate Reproductive Health in Code

**Purpose:** Ensure repro health is invisible by default for v1, without deleting the code.

### What to change:

1. **Default `trackingEnabled` to `false`** in the health profile defaults/initialization
   - File: `convex/schema.ts` or wherever profile defaults are set
   - Currently the CycleHormonalSection returns null when disabled, but we need to verify the default

2. **Hide repro from Settings unless enabled**
   - File: `src/components/settings/app-data-form/ReproductiveHealthSection.tsx` (41 lines)
   - The master toggle should still exist but the section should be collapsed/hidden when `trackingEnabled` is false
   - Verify: Does a new user see reproductive health settings? If yes, gate it.

3. **Exclude from AI context when disabled**
   - File: `src/lib/aiAnalysis.ts` (line ~622, `buildSystemPrompt`)
   - Verify the conditional already skips reproductive context when `trackingEnabled` is false
   - If not, add the guard

4. **Hide from Track page log grouping**
   - File: `src/components/track/today-log/grouping.ts`
   - Verify reproductive group is excluded when tracking is disabled

5. **Gate the CycleHormonalSection panel**
   - Already gated at line 154 — verify it works correctly

### What NOT to change:

- Don't delete schema fields, validators, or types (they're stable and gating is sufficient)
- Don't remove the components (they work, just need to be invisible)

### Acceptance: A new user with default profile settings sees zero reproductive health UI anywhere in the app.

---

## Phase 3: Create Unified Audit Work Queue

**Purpose:** Consolidate all audit findings into one prioritized, actionable file that replaces the scattered sources.

### Create `docs/backlog/audit-remediation.md`

Merge findings from:

- A1 Consolidated Report (33 Critical, ~85 High, ~95 Medium, ~55 Low)
- A2 Gap Analysis (12 gaps, 7 stale docs, 8 actions)
- A3 Code Health Map (91 dead exports, dead code)
- Existing PR #2 review (Waves 3-4 remaining: 43 Medium, 32 Low)
- Existing bugs.md items that overlap with audit findings

### Structure:

```
# Audit Remediation Queue
**Created:** 2026-03-16
**Sources:** A1 (codebase health), A2 (gap analysis), A3 (code map), PR #2 review

## Immediate (before any release)
[5 items from A1 Consolidated: C1 rotate creds, C2 auth on matchUnresolvedItems,
C7 dailyCap zero-tolerance, C8/C9/H25 health data in errors, C11 queue index bug]

## Sprint 1: Security + Type Safety
[C3, C4, C5, C6, C10, C12, C13, C14, C15 + H11-H17 security]
~20 items

## Sprint 2: Test Coverage
[C16-C22 + test gap table items]
~12 items

## Sprint 3: Error Handling + Accessibility + Base UI
[H18-H38 + Base UI migration table]
~25 items

## Sprint 4: Performance + Dead Code + Duplication
[H39-H43 + Medium performance items + dead code cleanup + duplication fixes]
~30 items

## Sprint 5: Polish + Hardcoded Personalization + Comments
[Medium personalization, work-ticket markers, data correctness, Low items]
~40 items

## Deferred / Won't Fix
[Items superseded by decisions, e.g. repro health bugs become N/A]
```

### Deduplication rules:

- Items already fixed in PR #2 Waves 1-2: mark as Done
- BUG-01 (repro health inconsistent state): mark as "Descoped per ADR-0008"
- BUG-02 (repro health can't be cleared): mark as "Descoped per ADR-0008"
- TD-11 (transit map feature flag orphaned): absorb into Sprint 4 dead code cleanup
- BT-80 (prompt management): mark as "Downgraded per ADR-0008"
- Items from PR #2 Waves 3-4 that overlap A1 findings: merge, keep A1 ID + PR2 reference

### Update `docs/backlog/bugs.md`:

- Cross-reference audit items (add "See also: audit-remediation.md #C7" etc.)
- Mark repro bugs as descoped
- Remove PR2-WAVE3-4 as a single item — the detail is now in audit-remediation.md

---

## Phase 4: Documentation Cleanup

**Purpose:** Reduce 120+ docs to a maintainable core. Archive aggressively.

### 4A. Archive (move to `docs/archive/`)

| Current Location                                                     | Why Archive                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/scratchpadprompts/` (entire dir, 330KB)                        | Implementation logs, not reference. The decisions are captured in ADRs and backlog.               |
| `docs/SESSION-2026-03-10.md`                                         | Self-documented as superseded                                                                     |
| `docs/STRATEGIC_OVERVIEW.md`                                         | Self-documented as partially stale; superseded by `current-state-architecture.md` + audit reports |
| `docs/consolidated-report.md`                                        | Superseded by `docs/backlog/DASHBOARD.md` + audit findings                                        |
| `docs/v1_sprint_tasks.md`                                            | Superseded by `docs/backlog/` system                                                              |
| `docs/CacaTraca_Roadmap_Q2Q3_2026.xlsx` (root copy)                  | Duplicate of `docs/product/` copy                                                                 |
| `docs/plans/v1-release-lock-migration-checklist.md`                  | Completed                                                                                         |
| `docs/plans/2026-03-15-food-matching-refactor-migration.md`          | All 6 steps complete                                                                              |
| `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`                    | Functionally complete                                                                             |
| `docs/working/2026-03-15-food-registry-refactor.md`                  | Registry refactor complete                                                                        |
| `docs/working/2026-03-15-food-matching-refactor-session-handover.md` | Session complete                                                                                  |
| `docs/product/backlog/` (entire subdir)                              | Stale duplicates of `docs/backlog/`                                                               |
| `docs/reviews/ai_prompt/2026-02-25-dr-poo-prompt-and-data-review.md` | Historical, superseded                                                                            |

### 4B. Update stale docs (keep but fix)

| File                                                   | Fix                                                                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/README.md`                                       | Rewrite as simple nav index pointing only to files that exist                                                                                   |
| `docs/current-state-architecture.md`                   | Update food pipeline section (server-first, not client LLM). Update transit map status (exists, IN for v1). Update repro health (gated for v1). |
| `docs/product/launch-criteria.md`                      | Update test counts, mark transit map as "in progress", mark repro as "descoped", downgrade prompt management, add CI as blocker                 |
| `docs/product/scope-control.md`                        | Align with ADR-0008 decisions                                                                                                                   |
| `docs/VISION.md`                                       | Minor: update Feature-Gated section to reflect transit map is IN and repro is gated                                                             |
| `docs/backlog/tech-debt.md`                            | Update TD-11 status, add new items from audit                                                                                                   |
| `docs/adrs/0002-food-registry-and-canonicalization.md` | Trim implementation log addenda — move to archive, keep the ADR itself under 150 lines                                                          |

### 4C. Rename

- `docs/dr-poo-architecture-ideas-and prompt-versioning/` -> `docs/dr-poo-prompts/` (remove space, shorten)

### 4D. Delete (not archive — truly empty/useless)

- `src/lib/featureFlags.ts` — dead file, `transitMapV2: true` always. Remove and inline the one consumer.

### Post-cleanup doc tree (what remains active):

```
docs/
  README.md                          (nav index)
  VISION.md                          (product vision)
  current-state-architecture.md      (architecture reference)
  MD_INDEX.md                        (file catalogue — update after cleanup)
  adrs/
    0001-cloud-only-architecture.md
    0002-food-registry-and-canonicalization.md  (trimmed)
    0007-ai-model-configuration.md
    0008-v1-scope-gate-decisions.md  (NEW)
  backlog/
    DASHBOARD.md                     (summary dashboard)
    bugs.md                          (bug register)
    features.md                      (feature backlog)
    tech-debt.md                     (tech debt register)
    audit-remediation.md             (NEW — unified audit work queue)
  plans/
    2026-03-15-pr2-review-fixes.md   (retained as detail catalogue, cross-ref to audit-remediation)
  working/
    2026-03-16-pr3-review-findings-and-fixes.md  (recent, keep)
    templates/                       (keep)
  browser-testing/
    2026-03-09-v1-test-run.md        (live bug tracker)
  policies/
    input-safety-and-xss.md
  research/                          (stable reference, keep as-is)
  reviews/
    AUDIT/                           (keep as-is — read-only reference for audit-remediation)
    ai_prompt/
      AI_SYSTEM_REVIEW.md
      PROMPT_ANALYSIS.md
      data-model/
  product/
    README.md
    launch-criteria.md               (updated)
    scope-control.md                 (updated)
    risk-register.md
  dr-poo-prompts/                    (renamed)
    architecture-rethink.md
    v1-system-prompt.md
    v2-system-prompt.md
    v3-strategy.md
  archive/                           (everything archived goes here)
```

---

## Phase 5: Update Memory & Maintenance Docs

### 5A. Update `MEMORY.md`

- Update Quick Status to reflect post-audit state
- Update Next priorities
- Add memory file for ADR-0008 decisions
- Remove stale memory files (wave3/wave4 tasks are now in audit-remediation)
- Keep memory lean — point to docs for detail

### 5B. Simplify maintenance checklist

Update `docs/backlog/DASHBOARD.md` session checklist to:

```
After every working session, update:
- [ ] docs/backlog/DASHBOARD.md (counts)
- [ ] docs/backlog/audit-remediation.md (if working audit items)
- [ ] docs/backlog/bugs.md or features.md or tech-debt.md (if items changed)
```

Remove the scratchpad and memory update requirements from the checklist (scratchpad is archived, memory updates happen organically).

### 5C. Update `docs/MD_INDEX.md`

Regenerate after archival to reflect the new smaller doc tree.

---

## Phase 6: Verify

1. `bun run typecheck` — clean after feature flag removal
2. `bun run test:unit` — all passing
3. `bun run build` — succeeds
4. Manual check: new user profile has `trackingEnabled: false` by default
5. Spot check: no reproductive health UI visible with default profile
6. Doc check: `docs/README.md` links all resolve, no broken references

---

## Execution Strategy

Phases 1-2 can be done by parallel sub-agents (ADR + backlog updates are independent of code gating).
Phase 3 requires reading all audit reports carefully — single agent with opus.
Phase 4 is mostly file moves and edits — can be parallelized by sub-area.
Phase 5 depends on Phases 1-4 completing.
Phase 6 is verification after everything.

**Estimated agents:** 6-8 parallel in Phase 1-2, 1 for Phase 3, 4-6 for Phase 4, 1-2 for Phase 5, 1 for Phase 6.
