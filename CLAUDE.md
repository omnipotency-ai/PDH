---
description:
alwaysApply: true
---

# Project Overview

PDH is an anastomosis food reintegration tracker for post reconnective surgery. It logs food, fluid, habits, activities, and digestion events, then correlates them with digestive outcomes using Bristol Stool Scale ratings.

## Product Context & Goals

The app helps users understand food-to-bowel-movement transit timing and emerging patterns. It must feel more trustworthy and coherent than existing tools. Key focus areas:

- Transit timing and digestion summaries.
- Evidence-based insights (what is known vs. inferred).
- High-quality, clinical-yet-warm UI.

## Safety Rules

**Never perform destructive data operations (delete, clear, reset) without explicitly confirming the target user ID and scope with the user first.** Always scope destructive operations to test data only.

### Destructive Operations

- **Always confirm** the target userId and environment (dev/prod) before running any delete, clear, reset, or seed-overwrite operation.
- **Never wipe production data** without an explicit, unambiguous instruction that names the table, user, and scope.
- **Seed scripts are idempotent by design** — re-running them must be safe. If a seed script is not idempotent, fix it before running it.
- **`clinicalRegistry` is permanent medical truth** — never wipe it during AI/embedding maintenance. If accidentally deleted, rebuild by re-running `seedClinicalData` (see `convex/seedClinicalData.ts`).

See `.claude/CLAUDE-ops.md` for full dashboard procedures and cross-tool coordination details.

---

## Core Engineering Requirements

### Core Engineering Principles

**Write "Boring" Code:** Don't be clever. Write simple, readable code and never swallow or hide errors.
**The 5-Second TS Rule:** After editing, wait 5 seconds before investigating TypeScript errors to allow the language server to clear stale diagnostics.
**Code as Evidence, Not Truth:** Do not assume surrounding code is correct just because it exists. Treat it as evidence of what was tried, but prioritize the "target architecture" over local inconsistency.
**Refactor Over Patching:** Do not optimize for the "smallest diff" if it preserves poor architecture. Refactor when a local fix would deepen existing contradictions.

### Data & Architecture (Source of Truth)

**Convex is the Boss:** Treat Convex as the single, canonical source of truth for all domain data.
**No "Fake" Offline:** The app is online-only. Do not build offline queues or local sync engines. If the network is down, the UI must fail clearly and truthfully.
**Distinguish Reality from Aspiration:** Clearly separate what is currently implemented from the intended product direction. Never describe aspirational architecture as if it already exists.
**AI Transparency:** Do not allow AI output to silently override canonical facts, and never present inferred logic as certainty. If confidence is low, show it in the UI.

### Product & Design

**Design System Discipline:** Use tokenized colors only. Check for existing components before creating new ones; if an existing one is weak, improve it rather than duplicating it.
**Calm & Scannable UX:** Assume the user is stressed or symptomatic. The UI should be calm, lightweight, and easy to scan, leading with the most important signal (progressive disclosure).
**Accessibility is Mandatory:** Treat accessibility, responsive behavior, and loading/error states as core requirements, not optional "polish."

## Operational Workflow

**ADHD-Aware Communication:** Always start with a concise summary and the big picture. Use headers, bullets, and short sections to avoid "walls of text."
**Document Decisions:** Record plans, architecture decisions, and refactor rationale in Markdown files within the codebase.
**Identify Debt:** Before implementing, identify whether the local pattern you are following is healthy or technical debt.
**Data Correctness First:** When making decisions, prioritize data correctness and trust above performance or local consistency with legacy code.
**Failure States:** If connectivity or Convex is unavailable, prefer explicit failure states over misleading "saved" behavior.
**The "Leave it Better" Rule:** Always leave the codebase in a more coherent and trustworthy state than you found it.

## Development Environment

This project uses TypeScript as the primary language with Biome for formatting/linting. Always run typecheck and tests after changes. Be aware that Biome auto-fix can aggressively reformat newly-scoped files — review its changes before committing.

## Sub-Agent Coordination

When dispatching multiple sub-agents that produce findings, ALWAYS deduplicate results across agents before presenting or adding to any work queue or tracking document.

## Workflow

After completing sprint tasks or work items, always update WIP tracking docs and work queue status before moving to the next task.

## Efficiency

When gathering file contents for reference or concatenation, prefer a single shell command (e.g., `cat` or `find | xargs cat`) over reading files individually into context then re-reading them via agents.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
