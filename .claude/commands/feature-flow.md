---
description: Tell me the exact next step in the PDH feature workflow
allowed-tools: Read, Grep, Glob
argument-hint: <feature-name-or-path>
---

# Feature Flow

Guide the user through the PDH feature workflow for "$ARGUMENTS".

## Goal

Inspect the current repo artifacts and tell the user the single best next step in the flow:

1. PRD
2. Plan
3. Tracking docs
4. Execution
5. Wrap-up

Do not implement the work. Do not produce a broad menu. Pick the next step.

## What To Inspect

- `docs/prd/`
- `docs/plans/`
- `docs/ROADMAP.md`
- `docs/WORK-QUEUE.md`
- `docs/WIP.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/ai/cross-tool-collaboration.md`

Use "$ARGUMENTS" to narrow the search by feature name, slug, PRD path, or plan path.

## Decision Rules

- If no PRD exists, direct the user to `pdh-prd`
- If PRD exists but no plan exists, direct the user to a plan-writing prompt
- If plan exists but tracking docs are not updated, direct the user to `project-ops`
- If plan is tracked and tasks are pending, direct the user to `sub-agent-development`
- If implementation is done but docs are stale, direct the user to `project-ops`
- If everything is done, direct the user to wrap-up and branch-finishing

## Required Output

````md
## Feature Flow

**Feature:** <name>
**Current stage:** <stage>

**Evidence**
- <artifact>
- <artifact>

**Next step**
- <single best next action>

**Run this prompt next**
```text
<exact prompt>
```

**Come back with**
- <what to bring back next session>
````
