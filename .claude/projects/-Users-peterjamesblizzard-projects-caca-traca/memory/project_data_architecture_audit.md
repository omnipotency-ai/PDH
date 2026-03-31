---
name: data-architecture-audit
description: Sprint 2.5+ data architecture overhaul — audit findings, canonical name migration, bandwidth fixes, LLM context pipeline redesign
type: project
---

**Sprint 2.5+ Data Architecture Overhaul** created 2026-03-18.

**Why:** Audit revealed brute-force data patterns: 11 queries doing full-table .collect(), quadratic growth in doc reads per AI report (~3,155 reads/report, growing linearly), 2.85 MB of unmigrated fat payloads, dead embedding infrastructure (0 docs in foodEmbeddings table), 9.6 writes per food log via ingredientExposures denormalization.

**How to apply:**
- Sprint plan: `docs/plans/2026-03-18-sprint-2.5+-data-architecture-overhaul.md`
- Audit report: `docs/research/2026-03-18-data-architecture-audit.md`
- Runs BEFORE Sprint 2.6 (transit map UI)
- 5 phases, 13 waves, many parallelizable
- Phase 1 (emergency fixes) has no dependencies and can start immediately
- Key insight: canonical name staleness is a migration problem, not a runtime problem — registry updates only happen at planned release times

**Key decisions needed from user:**
- ingredientExposures: eliminate, collapse to summary doc, or keep+fix? (Wave 3A)
- foodEmbeddings: populate or delete? (Wave 3B — recommended: delete)
- reportSuggestions: eliminate? (Wave 3C — recommended: yes)
