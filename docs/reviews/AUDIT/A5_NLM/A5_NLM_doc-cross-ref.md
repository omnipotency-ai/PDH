# Audit 5: Documentation Cross-Reference — NotebookLM Guide

**Tool:** NotebookLM
**Time estimate:** 30–45 minutes of setup + querying
**Output:** Contradiction report and documentation health assessment

---

## Purpose

NotebookLM is ideal for finding contradictions, stale information, and duplicate tracking across your documentation. You'll load the key docs, then run targeted queries to surface problems.

---

## Step 1: Load These Documents into NotebookLM

### Batch 1 — Canonical State Documents (load these first)

1. `docs/product/launch-criteria.md`
2. `docs/current-state-architecture.md`
3. `docs/VISION.md`
4. `docs/v1_sprint_tasks.md`
5. `docs/consolidated-report.md`

### Batch 2 — Backlogs (load next)

1. `docs/backlog/bugs.md`
2. `docs/backlog/features.md`
3. `docs/backlog/tech-debt.md`
4. `docs/product/backlog/bugs.md`

### Batch 3 — Active Plans and Working Docs

1. `docs/working/2026-03-15-food-matching-refactor-session-handover.md`
2. `docs/working/2026-03-15-food-registry-refactor.md`
3. `docs/working/2026-03-16-pr3-review-findings-and-fixes.md`
4. `docs/dr-poo-architecture-ideas-and prompt-versioning/v3-strategy.md`

### Batch 4 — Reference

1. `docs/adrs/0001-cloud-only-architecture.md`
2. `docs/adrs/0002-food-registry-and-canonicalization.md`
3. `CLAUDE.md`

---

## Step 2: Run These Queries

Copy-paste each query. Record the answers. Flag contradictions.

### Query Set A: Status Contradictions

**A1:** "Which documents say the E2E tests are passing, and which say they're not passing? List every claim about E2E test status with the source document."

**A2:** "What is the current status of Clerk Billing integration? List every mention across all documents."

**A3:** "What is the status of the food LLM matching pipeline? Is it client-side, server-side, or stubbed out? List every claim."

**A4:** "What is the status of the transit map? List every document that mentions it and what each says about its current state."

**A5:** "What is offline-first / offline capability status? List every mention."

**A6:** "How many unit tests are passing? List every different number mentioned across documents."

**A7:** "What does each document say about the Zustand store? Does any document still describe persist middleware or local sync?"

### Query Set B: Duplicate Tracking

**B1:** "Is BUG-03 (bowel movement visit count) tracked in multiple documents? List every occurrence and its status in each."

**B2:** "Is the 'prompt management' task (#80 / F16) described consistently across all documents? List every mention with status."

**B3:** "Are there features or bugs tracked in BOTH `docs/backlog/bugs.md` and `docs/product/backlog/bugs.md`? List the overlaps and any status discrepancies."

**B4:** "List every item that appears in more than one document with a different status (e.g., 'Done' in one, 'Open' in another)."

### Query Set C: Stale Information

**C1:** "Which documents reference files or components that may have been deleted? Look for mentions of: TransitMap, TransitMapTest, pointsEngine, foodCategoryMapping, LineCategory, TransitLine, game layer, stationDefinitions, gameState."

**C2:** "Which documents still reference 'sync key', 'syncKey', or the old authentication system? These were removed in Feb 2026."

**C3:** "Which documents reference 'Lemon Squeezy' or direct Stripe integration? These may be outdated if Clerk Billing is the current plan."

**C4:** "Which documents reference 'offline-first' or 'IndexedDB sync' as current functionality? ADR-0001 (cloud-only) means this is no longer true."

**C5:** "What is the oldest 'Last updated' date across all loaded documents? List every document with its last-updated date, sorted oldest first."

### Query Set D: Architecture Consistency

**D1:** "Do all documents agree on where the OpenAI API key is stored? List every description of API key storage."

**D2:** "Do all documents agree on the data flow for food logging? Trace every description of what happens when a user logs a food item."

**D3:** "Do all documents agree on what Zustand is responsible for? List every description of Zustand's role."

**D4:** "Is there any document that describes features or architecture that contradicts ADR-0001 (cloud-only) or ADR-0002 (food registry and canonicalization)?"

---

## Step 3: Compile Results

After running all queries, compile a report:

```markdown
# Documentation Health Assessment
**Date:** [today]
**Tool:** NotebookLM
**Documents reviewed:** [count]

## Status Contradictions Found
| Topic | Doc 1 Says | Doc 2 Says | Which Is Correct? |
[One row per contradiction found in Query Set A]

## Duplicate Tracking Issues
| Item | Locations | Status Discrepancy |
[From Query Set B]

## Stale Information
| Document | Stale Reference | What Changed |
[From Query Set C]

## Architecture Inconsistencies
| Topic | Inconsistency | Which Doc Is Authoritative? |
[From Query Set D]

## Documents Recommended for Update
| Document | Last Updated | Issues Found | Action (update/archive/delete) |

## Documents Recommended for Deletion/Archival
| Document | Reason |
```

---

## Tips for Efficient NotebookLM Usage

1. **Start with Batch 1.** These are the "canonical" docs. Establish ground truth first.
2. **Add Batch 2–4 incrementally.** After loading each batch, re-run the queries that are most likely to surface contradictions with the new docs.
3. **Use "cite sources" aggressively.** NotebookLM shows which document supports each claim — that's exactly what you need for contradiction detection.
4. **If you find a contradiction, ask a follow-up:** "Which document was updated more recently — [Doc A] or [Doc B]?" The more recent one is usually (but not always) correct.
5. **Copy the contradiction findings directly** — these become the input for the documentation cleanup phase.
