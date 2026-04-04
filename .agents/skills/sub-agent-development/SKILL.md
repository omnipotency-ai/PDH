---
name: sub-agent-development
description: Coordinate plan execution through sub-agents working in parallel. Use when the user provides an implementation plan (typically from docs/plans/) and wants it executed by dispatching sub-agents that work independently on tasks with dependency-aware phasing. Triggers on "sub-agent development", "execute plan with sub-agents", or when asked to run a plan through agents.
---

# Sub-Agent Development

Execute implementation plans by dispatching sub-agents in dependency-aware phases. The coordinator stays low-context. Sub-agents do their own codebase orientation.

## Coordinator Protocol

You are the **coordinator**. Your job is to read the plan, devise phases, dispatch agents, and wait. You are NOT an implementer.

### Hard Rules

1. **Do NOT read codebase files.** Read only the plan document. Sub-agents orient themselves.
2. **Do NOT check on running agents.** No polling, no reading partial output, no `TaskOutput` calls.
3. **Do NOT read agent results prematurely.** Wait for completion notifications. Be patient — expect 20+ minutes per phase.
4. **Keep your context minimal.** The plan + dispatch instructions + agent results. That's it.
5. **All work happens in one coordinator context window.** Do not spawn coordinators.

### What You DO

1. Read the plan
2. Identify tasks and their dependencies
3. Group tasks into sequential phases where independent tasks run in parallel
4. Dispatch sub-agents (vite-react-implementer)with focused instructions
5. Wait for each phase to complete before starting the next
6. Review results and report to the user

## Workflow

### Step 1: Read the Plan

Read the plan file the user provides. Identify:

- Every discrete task (usually marked as "Task 1", "Task 2", etc., or "Part A", "Part B")
- Dependencies between tasks (explicit "depends on" or implicit from context)
- Which tasks are independent and can run in parallel

### Step 2: Build the Execution Graph

Group tasks into **phases**. Within a phase, all tasks are independent and run in parallel. Phases execute sequentially.

```
Phase 1: [Task A, Task B]     ← independent, run in parallel
Phase 2: [Task C]             ← depends on A
Phase 3: [Task D, Task E, Task F] ← depend on C, independent of each other
Phase 4: [Task G]             ← depends on D, E, F
```

Announce the execution graph to the user before dispatching.

### Step 3: Dispatch Sub-Agents

For each task in the current phase, dispatch a sub-agent using the Task tool with:

```
subagent_type: "vite-react-implementer"
run_in_background: true
mode: "bypassPermissions"
```

Each agent prompt MUST include:

1. **The task section** — Copy the relevant section from the plan verbatim
2. **Plan context** — The plan's goal, tech stack, and any relevant cross-task context (keep it brief)
3. **Orientation instruction** — Tell the agent to read the codebase files it needs before making changes
4. **Scope constraint** — Only modify files relevant to this task
5. **Output instruction** — Return a summary of what was done, files changed, and any issues

#### Agent Prompt Template

```markdown
## Context

You are implementing a task from an execution plan for [project name].
Tech stack: [from plan header]
Plan goal: [1-sentence summary]

## Your Task

[Paste the full task section from the plan here — including file paths, steps, code examples]

## Instructions

1. Orient yourself first — read the files mentioned in the task and any imports/dependencies you need to understand
2. Implement exactly what the task describes
3. Run `bun run typecheck` after your changes to verify no type errors
4. Do NOT modify files outside your task scope
5. Return a summary: what you changed, what you verified, any issues encountered
```

### Step 4: Wait

After dispatching all agents for a phase:

- Say "Phase N dispatched. Waiting for agents to complete."
- **Do nothing.** Do not read files. Do not check on agents. Do not start the next phase.
- You will be notified when each agent completes. Wait for ALL agents in the phase.

### Step 5: Review Phase Results

When all agents in a phase return:

1. Read each agent's summary
2. Note any issues or conflicts
3. If a task failed, decide whether to retry or flag to user
4. Report phase results to user
5. Proceed to next phase

### Step 6: Complete

After all phases are done:

1. Summarize what was accomplished across all phases
2. List any issues or incomplete items
3. Suggest verification steps (e.g., `bun run typecheck`, `bun run build`)

## Handling Failures

- If an agent reports failure: assess whether the task can be retried or needs user input
- If agents edited the same file: flag the conflict to the user
- If a dependency chain breaks: stop and report — do not guess at fixes

## Example Execution

Given a plan with:

- Part A: Task 1 (no deps), Task 2 (no deps), Task 3 (depends on Task 1)
- Part B: Task 4 (depends on Part A), Task 5 (depends on Part A)

Execution graph:

```
Phase 1: [Task 1, Task 2]  — parallel
Phase 2: [Task 3]          — depends on Task 1
Phase 3: [Task 4, Task 5]  — depend on Part A, parallel
```

Dispatch 2 agents for Phase 1 → wait → dispatch 1 agent for Phase 2 → wait → dispatch 2 agents for Phase 3 → wait → report.
