---
name: subagent-driven-development
description: Coordinate plan execution through sub-agents working in parallel. Use when the user provides an implementation plan (typically from docs/plans/) and wants it executed by dispatching sub-agents that work independently on tasks with dependency-aware phasing. Triggers on "sub-agent development", "subagent driven development", "execute plan with sub-agents", or when asked to run a plan through agents. Overrides the superpowers version with PDH-specific doc integration, per-task spec+quality review cycle, and project-ops flow.
---

# Subagent-Driven Development — PDH

Execute plans by dispatching subagents in dependency-aware phases. Each task gets a full cycle: implement -> spec audit -> fix -> quality audit -> triage. One subagent per job. Orchestrator triages findings and maintains docs.

## Coordinator Protocol

You are the **coordinator**. You read the plan, dispatch agents, triage findings, and maintain docs. You are NOT an implementer.

### Hard Rules

1. **One subagent = one job.** Implement, review, or fix. Never reuse a subagent across tasks.
2. **Do NOT read codebase files.** Read only plan + agent results. Subagents orient themselves.
3. **Do NOT poll running agents.** Wait for completion notifications.
4. **Spec review before quality review.** Always. Never skip, never reorder.
5. **Fix critical, high, and moderate findings.** Nice-to-haves get saved to backlog.
6. **Update docs after every task.** WQ task status + verify WIP was updated by implementer.

## Workflow

### Step 1: Read Plan, Build Execution Graph

Read the plan file. Extract every task with full text. Identify dependencies.

Group into **phases**. Within a phase, all tasks are independent and run in parallel. Phases execute sequentially.

```
Phase 1: [Task A, Task B]     <- independent, parallel
Phase 2: [Task C]             <- depends on A
Phase 3: [Task D, Task E]     <- depend on C, parallel
```

Announce the execution graph to the user before dispatching.

### Step 2: Dispatch Implementers (parallel within phase)

For each task in the current phase, dispatch in parallel:

```
Agent tool:
  subagent_type: "vite-react-implementer"
  model: "opus"
  mode: "bypassPermissions"
  run_in_background: true
  description: "Implement [task ID]: [short name]"
  prompt: |
    ## Context
    You are implementing a task from an execution plan for PDH.
    Plan goal: [1-sentence summary]
    Branch: [branch name]

    ## Your Task
    [FULL TEXT of task from plan — paste verbatim, do not make agent read a file]

    ## Instructions
    1. Orient: read the files mentioned in the task + imports/dependencies
    2. Implement exactly what the task describes
    3. Write/update tests where appropriate
    4. Run `bun run typecheck` to verify
    5. Commit your work with a descriptive message
    6. Update WIP.md (per your skill's mandatory WIP protocol)
    7. Do NOT modify files outside your task scope

    ## Report Format
    - What you implemented (be specific)
    - Files changed (full paths)
    - Test results
    - Commit hash
    - Decisions made (anything non-obvious)
    - Concerns or open questions
```

Wait for all implementers in the phase. As each returns, start its review cycle immediately — don't wait for the whole phase.

### Step 3: Spec Compliance Review

After each implementer returns, dispatch a spec reviewer. **Never skip this.**

```
Agent tool:
  subagent_type: "general-purpose"
  model: "sonnet"
  mode: "auto"
  run_in_background: true
  description: "Spec review [task ID]"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## Specification (what was requested)
    [FULL TEXT of task from plan]

    ## Implementer Report (do not trust — verify by reading code)
    [Paste implementer's full report]

    ## Your Job
    Read the actual code. Compare to spec line by line.

    Check for:
    - **Missing requirements:** anything in spec not in code
    - **Extra work:** anything in code not in spec (over-engineering)
    - **Misunderstandings:** right feature, wrong interpretation

    Report:
    - PASS: spec compliant (verified by code inspection)
    - FAIL: list each divergence with file:line references
```

**If FAIL:** dispatch a NEW implementer (opus, vite-react-implementer) with the divergence list as the task. Then re-run spec review with a NEW reviewer. If it fails 3 times, flag to user — the spec may be ambiguous.

### Step 4: Code Quality Review

Only after spec review passes.

```
Agent tool:
  subagent_type: "general-purpose"
  model: "sonnet"
  mode: "auto"
  run_in_background: true
  description: "Quality review [task ID]"
  prompt: |
    You are reviewing code quality for a completed task in PDH.
    Stack: React 19, Vite, Convex, Tailwind v4, Zustand, TypeScript strict.

    ## What was implemented
    [From implementer's report — files changed, what was done]

    ## Review Focus
    Read the changed files and assess:

    1. **Security** — injection, XSS, auth bypass, data exposure
    2. **Performance** — unnecessary re-renders, unbounded queries, missing memo
    3. **Simplification** — over-engineered? Can be simpler? Dead code introduced?
    4. **Architecture** — fits existing patterns? Convex patterns correct? State in right place?
    5. **Code quality** — naming, readability, error handling, type safety, test coverage

    ## Report Format
    For each finding:
    - **Severity:** Critical | High | Moderate | Nice-to-have
    - **Category:** Security | Performance | Simplification | Architecture | Quality
    - **File:line:** exact location
    - **Issue:** what's wrong
    - **Fix:** specific suggestion

    If no findings: "APPROVED — no issues found"
```

### Step 5: Triage Findings

The orchestrator (you) triages quality review findings:

**Critical + High + Moderate:** dispatch a NEW implementer (opus, vite-react-implementer) to fix them all in one pass. Provide the full findings list. No re-review after fix (avoids infinite loops — trust implementer self-review for fix-only work).

**Nice-to-have:** append to `docs/plans/quality-backlog.md`:

```markdown
## [Task ID] — [YYYY-MM-DD]

- **[Category]** `file:line` — [issue]. Fix: [suggestion]
```

This file accumulates across sessions. When starting a new initiative plan, sweep it for items that fit.

### Step 6: Update Docs

After each task's full cycle:

1. Update `docs/WORK-QUEUE.md` — set task status to "done", add commit hash
2. Verify `docs/WIP.md` was updated by implementer (check top of active section)

### Step 7: Phase Complete

When all tasks in a phase are done (all review cycles finished):

1. Report phase results to user
2. If more phases, start next phase
3. If all phases done, go to Step 8

### Step 8: Initiative Complete

After all phases:

1. Run `bun run typecheck && bun run build && bun run test` to verify
2. Report: what was accomplished, issues, test results
3. **Invoke `project-ops` skill** — update ROADMAP, archive plan if done, trim WIP
4. Invoke `superpowers:finishing-a-development-branch` for merge/PR decision

## When to Skip Reviews

**Skip** for trivial tasks: renaming, config changes, doc updates, single-line fixes.
**Always run full cycle** for: new components, schema changes, pipeline work, >5 files changed, anything security-adjacent.

Use judgement. If in doubt, review.

## Handling Failures

- **Implementer fails:** dispatch a NEW implementer with error context. Never reuse.
- **Spec fails 3+ times:** flag to user — spec is likely ambiguous or wrong.
- **Agents edit same file:** flag conflict to user. Don't auto-merge.
- **Dependency chain breaks:** stop and report. Don't guess.

## Integration

| Skill                                        | When                                                              |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `vite-react-implementer`                     | All implementer subagents use this (PDH conventions + WIP update) |
| `project-ops`                                | After all tasks — ROADMAP/WQ/WIP maintenance                      |
| `superpowers:finishing-a-development-branch` | After all tasks — merge/PR decision                               |
| `superpowers:writing-plans`                  | Creates the plans this skill executes                             |
