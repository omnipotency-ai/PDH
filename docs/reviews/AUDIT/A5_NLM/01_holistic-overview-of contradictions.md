# Caca Traca NotebookLM chat on documentation

**Date:** 2026-03-17
**Reviewer:** Peter James Blizzard

## Holistic Overview of Contradictions

As a senior technical auditor, I have completed a cross-reference analysis of the Caca Traca documentation corpus. The following issues emerge only when evaluating the entire set of architectural records, audits, and implementation logs collectively.

### 1. Contradictions

**Finding ID: PERSIST-01 | Severity: Critical**

* **Source A (`Habit_App_React_IndexedDB.md`):** Describes an "offline-first model with IndexedDB mutation queue" where "Track loads instantly offline".
* **Source B (`ADR-0001: Cloud-Only Architecture`):** Explicitly states: "The app requires connectivity. Offline logging is not supported. Zustand holds ephemeral UI state only (no persist middleware)".
* **Conflict:** Older research documentation describes a robust offline-first architecture that is fundamentally rejected by the current Architectural Decision Record.

**Finding ID: BRISTOL-MAP | Severity: Critical**

* **Source A (`Track.tsx` / `Audit 08`):** "Track.tsx maps Bristol 5 as 'loose'".
* **Source B (`Bristol_Classification_Evidence.md`):** "Bristol 3-4-5... [is] Safe... Rome III includes Type 5 as normal".
* **Conflict:** The implementation in `Track.tsx` was penalizing clinically safe outcomes. While fixed in Phase 5 planning, the `Audit 08` and `bugs.md` still list this as a discrepancy between files.

**Finding ID: TRANSIT-WINDOW | Severity: High**

* **Source A (`analysis.ts`):** Defines transit windows with a "55min start".
* **Source B (`Phase B Execution`):** Implements a "CLINICAL_TRANSIT_RESOLVER_POLICY" that enforces a "hard 6-hour minimum floor regardless of learned center/spread".
* **Conflict:** The core analysis engine and the newer resolver policy use different biological assumptions for the minimum time food takes to pass.

---

### 2. Stale Claims

**Finding ID: STALE-MAP | Severity: High**

* **The Claim:** `STRATEGIC_OVERVIEW.md` (Updated Mar 15) lists the Patterns page / Transit Map as "Working".
* **The Reality:** `ADR-0002` and the `Phase 2.5 summary` confirm the "legacy transit map component (1,033 lines) was deleted on March 12" and is being rebuilt from scratch.
* **Status:** Stale. The documentation claims a feature is functional that has actually been deleted from the `src/` tree.

**Finding ID: STALE-TESTS | Severity: Medium**

* **The Claim:** `STRATEGIC_OVERVIEW.md` asserts there are "No E2E tests".
* **The Reality:** `VISION.md` and the `Consolidated Report` (dated Mar 15) confirm an E2E suite of "75+ tests across 11 Playwright spec files" exists and is passing.
* **Status:** Stale. Documentation has not caught up to the rapid expansion of the test suite.

---

### 3. Terminology Drift

**Severity: Medium (Cleanup Needed)**
The corpus shows significant "synonym clustering" for core concepts:

* **Cluster 1 (The Visual):** "Transit map" vs. "Transit chart" vs. "Metro map" vs. "Live network".
* **Cluster 2 (The Event):** "Trials" (legacy) vs. "Transits" (user-requested to reflect "completed pass-throughs").
* **Cluster 3 (The Unit):** "Canonical food" vs. "Station".
* **Cluster 4 (Gamification):** "Side Quest" (AI prompt output) vs. "Mini Challenge" (Internal type and UI label).

---

### 4. Architecture Drift

**Finding ID: DRIFT-GAME | Severity: High**

* **Old Architecture:** `ingredientTemplatesSeed.ts` uses a "6-line/10-stage taxonomy".
* **New Architecture:** `shared/foodRegistry.ts` (established in `ADR-0002`) implements a "two-level hierarchy: 4 macronutrient groups containing 11 sub-lines".
* **Replacement:** The legacy game layer was deleted in Phase 4 and replaced by the `FoodGroup/FoodLine` hierarchy.

---

### 5. Orphaned References

**Finding ID: ORPHAN-FILES | Severity: Low**

* **Document:** `STRATEGIC_OVERVIEW.md` (updated March 12) references `pointsEngine.ts` and `transitMapLayout.ts` as critical understanding files.
* **Context:** Both files were confirmed deleted during the Phase 2.5 hierarchy revision on March 12.

---

### 6. Scope Creep Evidence

**Finding ID: SCOPE-HEALTH | Severity: High**

* **Original PRD (`VISION.md`):** Prioritizes "ADHD-friendly" simplicity and "minimal steps to log" for users who are "fatigued".
* **Current State (`Audit: simplicity.md`):** Flags that the "HealthProfile interface has grown from ~14 fields to ~45+ fields," including "clinical-grade reproductive tracking" and "12 fields across 3 substance categories".
* **Audit Verdict:** Explicitly labeled a "YAGNI violation," noting that "This is a clinical intake form, not a personal recovery tracker".

---

### 7. Decision Reversals Without Rationale

**Finding ID: REV-AI-MODEL | Severity: High**

* **Original Plan (`ADR-0003`):** Specified a "client-initiated BYOK (bring your own key)" model for AI calls to keep keys local.
* **Current Implementation (`Phase 4.6`):** LLM matching moved to "server-initiated with API key in environment".
* **Missing Rationale:** While the change notes it "simplifies the security model," there is no formal ADR explaining why the original decentralized security posture in `ADR-0003` was abandoned.
*

## Caca Traca development timeline - cross-referencing the "Master Codebase Review", "Progress Logs", "Sprints", and "ADRs"

The project exhibits a "Scorched Earth" development pattern: a rapid prototyping phase (Feb 20–March 10) followed by a massive architectural pivot (March 11–15) that deleted nearly 6,000 lines of "broken" legacy code to build a cloud-only, registry-first foundation.

### 1. Historical Development Timeline (Feb 20 – March 17)

| Phase | Dates | Key Milestones | Source Docs |
| :--- | :--- | :--- | :--- |
| **I: Conception & Prototype** | Feb 20 – Feb 23 | Rapid build of "Local-First" prototype using IndexedDB and Zustand. | |
| **II: First Audit & Baseline** | Feb 24 – Feb 28 | Master Codebase Review identifying Security/Testing gaps. Decision to move to Convex. | |
| **III: System Maturation** | March 1 – March 10 | Implementation of Bayesian Engine. Dr. Poo Prompt v2. First 63-bug browser test. | |
| **IV: The Great Pivot** | March 11 – March 13 | ADR-0001: Move to **Cloud-Only**. Deletion of 4,000 lines of legacy "Game Layer" code. | |
| **V: The Pipeline Rebuild** | March 14 – March 16 | Implementation of Server-Side Food Pipeline (Tasks 1-11). E2E suite (75 passing). | |
| **VI: Current State** | March 17 (Today) | Post-fix verification of registry follow-up and data repair. | |

---

### 2. Critical Path to Launch (March 18 – March 26)

Based on current blockers identified in the `Launch-Criteria.md` and `Backlog Dashboard`, the following work remains.

#### **W1: Infrastructure & Hardening (Est. 3 Days)**

* **OpenAI Prompt Management (#80):** [Critical/Blocker] Move hardcoded prompts to OpenAI Dashboard IDs.
  * *Duration:* 1.5 Days.
  * *Spec:* Migration of `v3-system-prompt` to remote management to allow versioning without code deploys.
* **CI Pipeline Setup:** [Critical/Blocker] Setup GitHub Actions to gate master.
  * *Duration:* 1 Day.
  * *Spec:* Automated runs for `bun run typecheck`, `bun run build`, and 352+ unit tests on every PR.
* **Registry Standalone Word Audit:** [High]
  * *Duration:* 0.5 Days.
  * *Spec:* Add examples for common single-word entries (chicken, bread, fish) missing from `foodRegistry.ts`.

#### **W2: UX & Feature Completion (Est. 4 Days)**

* **Pill/Tag Food Entry Component:** [High]
  * *Duration:* 2 Days.
  * *Spec:* Replace plain text input with visual chips to prevent multi-ingredient blobs in the pipeline.
* **Browser Testing Pass 2 (Settings/AI/Menu):** [High]
  * *Duration:* 1 Day.
  * *Spec:* Verify 21 remaining bugs across non-Track pages (BT-46, BT-35, BT-22).
* **Food Request Persistence (#10):** [Medium]
  * *Duration:* 0.5 Days.
  * *Spec:* Convert UI stub into a real Convex mutation for `foodRequests` table.
* **Quantity Threading Fix:** [Medium]
  * *Duration:* 0.5 Days.
  * *Spec:* Thread quantity/unit from `ingredientExposures` to `TrialHistorySubRow`.

#### **W3: Launch Stabilization (Est. 2 Days)**

* **Bristol Classification Majority-Rules (#92):** [High]
  * *Duration:* 1 Day.
  * *Spec:* Refactor `classifyConsistency()` to use 30% threshold instead of simple averages.
* **Final Smoke Test & v1.0 Tagging:** [Low]
  * *Duration:* 1 Day.
  * *Spec:* Final E2E run and master merge.

---

### 3. Final Completion Prediction

**Estimated v1.0 Ship Date: March 27, 2026**
*This assumes a single-developer velocity ("Peter") focusing on the Critical/High priority blockers. It explicitly defers the Transit Map UI Rebuild (Phase 5) and Gamification to v1.1.*

### 4. Visual Timeline Summary for Charting

* **Feb 20 – Feb 23:** Phase I: Rapid Prototyping
* **Feb 24:** Milestone: Master Codebase Audit
* **Feb 25 – March 10:** Phase II/III: Functional Expansion
* **March 11:** **KEY PIVOT:** ADR-0001 (Cloud-Only Architecture)
* **March 12 – March 14:** Milestone: Food Registry & Server-Side Pipeline Landing
* **March 15 – March 17:** Phase VI: E2E Testing & Stabilization
* **March 18 – March 20:** **STAGING:** AI Management & CI Setup
* **March 21 – March 24:** **STAGING:** UX Refinement (Pill Input/Browser Test)
* **March 25 – March 26:** **STAGING:** Final Hardening (Bristol Rules)
* **March 27:** **LAUNCH: v1.0 Public Release**

## Transit Map

The **Transit Map** is the central visual and metaphorical pillar of the Caca Traca application, designed to transform the "tedious" process of post-surgical food reintegration into a manageable, data-driven journey. As a senior technical auditor, I have analyzed its purported value and the current state of its implementation across the documentation.

### 1. Purported Value: The "Metro Cartography" Metaphor

The map purports to bring several layers of value to a user recovering from anastomosis surgery:

* **Clinical Geography, Not Permissions:** A core design principle is that the map represents "geography, not gates". While it suggests a safe progression through three Zones (1: Liquids/Soft Solids, 2: Expanded/Defensive, 3: Experimental), it never blocks a user from logging any food. This supports user autonomy while providing a clinical "roadmap" for recovery.
* **ADHD-Friendly Reward Model:** The map is designed to combat the "3-month abandonment pattern" typical of habit trackers. It uses a "detective framing" where information gain—even a negative discovery like identifying a "culprit" food—is celebrated as a "case closed" rather than a failure.
* **Nutritional Balanced View:** Beyond individual food tolerance, the hierarchy (splitting foods into "Corridors" like Protein, Carbs, Fats, and Seasoning) allows users to see at a glance if they are maintaining a balanced diet even while regressed to basic foods.
* **Situational Awareness:** By showing foods "in transit," the map provides real-time feedback on what is currently being tested by the body, which is described as a "novel UX innovation" for the digestive health domain.

### 2. Structural Hierarchy

The data foundation for the map has evolved from a flat list to a strictly typed hierarchy:

* **Corridors (Groups):** The top-level macronutrient categories.
* **Lines (Sub-lines):** 11 specific paths (e.g., Grains Line, Meat & Fish Line) that users travel independently.
* **Stations (Canonical Foods):** Individual food entries from the registry, each with a `lineOrder` determining its suggested position on the track.
* **Interchanges:** Visual structural nodes representing zone boundaries (e.g., Zone 1→2), though these are not food items and do not appear in the data model.

### 3. Technical Audit: Evolution and Implementation Drift

My cross-reference analysis reveals a significant "Architecture Drift" regarding the map's implementation status:

* **Critical Contradiction (Stale Claims):** Older strategic documents (updated as late as March 12, 2026) incorrectly list the Transit Map as "Working" on the Patterns page. However, the Phase 2.5 summary and **ADR-0002** confirm that the legacy Transit Map component (1,311 lines of code) was **deleted** on that same day.
* **The "Vaporware" Gap:** While the documentation details a rich "Reward Model" with 12 specific milestone celebrations (e.g., "First station turned red," "Zone 1 complete"), a verification audit found that **no celebration or milestone logic actually exists** in the current codebase. These remain "design intent" only.
* **Data Foundation vs. UI:** The project has successfully implemented a `useTransitMapData()` hook and a robust `TransitNetwork` type hierarchy. This new "Live Network" data foundation is built directly from the food registry and Bayesian evidence engine, replacing the old hardcoded mock data.
* **UI Rebuild Status:** The app currently contains a "Model Guide" tab, which is a hardcoded visual artifact, while the "Live Network" UI—intended to feature three zoom levels and a "Station Inspector" for progressive disclosure—is still being built on top of the new data foundations.

### 4. Summary of Functional Benefits

| Feature | Purported Value | Technical Status |
| :--- | :--- | :--- |
| **Next Stop Logic** | Directs ADHD users to the next clinical "best trial". | **Hook Implemented**; UI pending. |
| **Service Records** | Shows food history as "6 transits — 4 on time, 1 delayed". | **Logic Implemented**; UI pending. |
| **Zone Geography** | Maps risk levels to map areas (Zone 1 = safe core). | **Registry-Wired**. |
| **Deep Linking** | Allows Dr. Poo reports to link directly to food stations. | **Foundation Ready**. |
