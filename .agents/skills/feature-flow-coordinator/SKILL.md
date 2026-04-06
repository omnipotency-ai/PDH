---
name: feature-flow-coordinator
description: Guide a PDH feature from idea to execution one step at a time. Use when the user asks what to do next, wants a workflow coordinator, wants an exact next prompt, or wants help moving through PRD -> plan -> tracking -> execution across separate sessions.
---

# Feature Flow Coordinator

> **Primary entry point:** `/go` — the session concierge command (`.claude/commands/go.md`). It invokes this same decision logic but stays in coordinator mode for the entire session.

This skill does not implement the feature. It inspects the current artifacts and tells the user the next step to run.

## Goal

Act as a sidecar coordinator for this flow:

1. idea
2. PRD
3. implementation plan
4. tracking docs
5. execution
6. wrap-up

The user may leave, do the step elsewhere, then come back. Each time, re-inspect the repo and tell them the next exact prompt or action.

## What To Read

Read only what is needed:

1. `docs/prd/` for PRDs
2. `docs/plans/` for implementation plans
3. `docs/ROADMAP.md`
4. `docs/WORK-QUEUE.md`
5. `docs/WIP.md`
6. `CLAUDE.md`
7. `AGENTS.md`
8. `docs/ai/cross-tool-collaboration.md`

If the user gives a feature name, slug, PRD path, or plan path, use that to narrow the search.

## Decision Table

### Stage 0: No PRD exists

Tell the user to create a PRD first.

Preferred next prompt:

```text
Use pdh-prd to create a PRD for <feature>.
Ask only the essential clarifying questions first.
Save it to docs/prd/YYYY-MM-DD-<feature-slug>.md.
```

### Stage 1: PRD exists, no plan exists

Tell the user to turn the PRD into a plan.

Claude prompt:

```text
Use superpowers:writing-plans to turn docs/prd/YYYY-MM-DD-<feature-slug>.md into an implementation plan.
Write the result to docs/plans/YYYY-MM-DD-<feature-slug>.md.
Break it into waves and task IDs with dependencies, exact file targets, verification commands, and non-goals.
Make it suitable for sub-agent-development.
```

Codex prompt:

```text
Write an implementation plan from docs/prd/YYYY-MM-DD-<feature-slug>.md into docs/plans/YYYY-MM-DD-<feature-slug>.md.
Break it into waves and task IDs with dependencies, exact file targets, verification commands, and non-goals.
Make it suitable for sub-agent-development.
```

### Stage 2: Plan exists, not yet tracked

Tell the user to register it in tracking docs.

Preferred next prompt:

```text
Use project-ops to start this initiative.
Plan file: docs/plans/YYYY-MM-DD-<feature-slug>.md
Update docs/ROADMAP.md, docs/WORK-QUEUE.md, and docs/WIP.md.
```

### Stage 3: Plan is tracked and has pending tasks

Tell the user to execute it.

Preferred next prompt:

```text
Use sub-agent-development on docs/plans/YYYY-MM-DD-<feature-slug>.md
```

### Stage 4: Execution happened, but tracking is stale

Tell the user to reconcile docs first.

Preferred next prompt:

```text
Use project-ops to reconcile docs/WORK-QUEUE.md and docs/WIP.md with the completed work for <feature>.
```

### Stage 5: All tasks are done

Tell the user to wrap up.

Preferred next prompt:

```text
Use project-ops to complete the initiative for <feature>, archive the plan if appropriate, and trim WIP to a summary block.
Then use superpowers:finishing-a-development-branch to decide merge/PR next steps.
```

## Output Format

Always respond with:

````md
## Feature Flow

**Feature:** <name or best guess>
**Current stage:** <stage>

**Evidence**

- <artifact 1>
- <artifact 2>

**Next step**

- <single best next action>

**Run this prompt next**

```text
<exact prompt>
```

**Come back with**

- <what result or artifact the user should bring back>
````

If there are multiple plausible next steps, pick one and explain why briefly.

## Rules

- Do not start implementation unless the user explicitly switches from coordination to execution
- Prefer one next step, not a menu
- Prefer repo artifacts over memory
- If naming is inconsistent, point it out and recommend the canonical `docs/prd/` and `docs/plans/` paths
