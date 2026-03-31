# ADR-0008: v1 Scope Gate Decisions

**Status:** Accepted
**Date:** 2026-03-17
**Deciders:** Product owner

## Context

Five parallel audits (Claude Code 10-agent codebase health, GPT 5.4 gap analysis, Manus code map, Gemini deep review, NotebookLM cross-ref) produced ~500KB of findings. Several scope and priority questions needed explicit decisions to unblock v1 launch planning.

## Decisions

### 1. Reproductive Health: OUT of v1

**Decision:** Gate all reproductive health features behind a feature flag so they are completely invisible to users in v1.

**Rationale:** The reproductive health module (cycle tracking, pregnancy, menopause, hormone settings) is functional but not validated for v1 launch. It adds surface area for bugs and testing without being core to the anastomosis recovery use case.

**Current state (NOT YET GATED):** The reproductive health toggle is still discoverable in Settings > App & Data. A user can enable it and access the full module. The following gating work is required:

- Hide the `ReproductiveHealthSection` toggle from `AppDataForm` for v1 (use feature flag)
- Add a guard on `handleCycleEntry` to prevent log creation when gated
- Verify all gate points are covered (Settings card/tile, Track page, AI context, CycleHormonalSection, today-log grouping)
- Document all gate points

**Acceptance criteria:** A new user sees zero reproductive health UI anywhere in the app, and cannot enable it through any settings surface.

### 2. Transit Map: IN v1

**Decision:** The transit map (zone-based food visualization) stays in v1 scope. Finish implementation.

**Rationale:** Transit timing and food-to-bowel correlation are core product differentiators. The transit map UI was decomposed from 1311 to 570 LOC, the server pipeline is complete (11/11 tasks), and the feature flag (`transitMapV2`) is permanently true. The dead feature flag file (`src/lib/featureFlags.ts`) should be deleted as part of cleanup.

### 3. Prompt Management (#80): DOWNGRADED from Ship Blocker

**Decision:** Downgrade BT-80 (OpenAI prompt management) from Ship Blocker to High priority.

**Rationale:** Hardcoded versioned prompts are acceptable for v1 launch. The prompt versioning system (v1/v2/v3 strategy docs exist, `promptVersion` field is in schema) works without an external dashboard. OpenAI dashboard integration can follow in a post-launch iteration.

### 4. Food Status Surface: FUSED (already implemented)

**Decision:** The food status determination uses a fused approach — deterministic scoring from the server pipeline combined with AI verdicts from Dr. Poo reports.

**Rationale:** This is already the implemented architecture. The `foodTrialSummary` table stores both `codeScore` and `aiScore` with a `combinedScore`. No further decision needed; this confirms the status quo.

## Consequences

- **Ship Blocker list** reduces to: CI pipeline setup only
- **Reproductive health bugs** (BUG-01, BUG-02) are descoped — won't fix for v1
- **Feature flag required:** `src/lib/featureFlags.ts` needs a `reproductiveHealth: false` flag to gate the module
- **Gating work outstanding:** the toggle in AppDataForm must be hidden, and all entry points must be verified
- **Audit remediation** can proceed with clear scope boundaries
