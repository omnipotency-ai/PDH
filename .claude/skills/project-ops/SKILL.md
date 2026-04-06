---
name: project-ops
description: Maintain PDH project tracking docs (ROADMAP.md, WORK-QUEUE.md, WIP.md). Use when completing a wave or initiative, archiving a plan, starting a new initiative, ending a session, or when the user says "/project-ops", "update the docs", "tidy up tracking", "wrap up", or "end of session". Also invoke proactively when you notice planned work is complete but docs haven't been updated.
---

# Project Ops — PDH Doc Maintenance

Automates the ROADMAP -> WORK-QUEUE -> WIP -> Archive flow.

## The Three Files

| File                 | Role                                                           | Discipline                                                                                        |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/ROADMAP.md`    | Everything — initiatives + standalone items                    | Append-only. Never delete rows. Status updates in-place.                                          |
| `docs/WORK-QUEUE.md` | Planned work only — initiatives with plan links + inline tasks | Lean. Tasks listed with dependencies. Done tasks removed, initiative row stays with final status. |
| `docs/WIP.md`        | Execution log — what happened, when, what commit               | Newest-first. Timestamped entries. Summarise completed initiatives.                               |

## Operations

Read `docs/ROADMAP.md`, `docs/WORK-QUEUE.md`, and `docs/WIP.md` before any operation.

### 1. Start Initiative

Trigger: User says to start a new feature/initiative, or a plan has been created for a roadmap item.

1. Read `docs/ROADMAP.md` — find the initiative, update status to "In Work Queue — plan active"
2. Sweep standalone items in ROADMAP that fit this initiative's scope — list them for user confirmation
3. Read/create the plan file — ensure folded standalone items are included as tasks
4. Add initiative to `docs/WORK-QUEUE.md` with:
   - Plan link, PRD link, branch name
   - Inline task table with columns: Task ID, Title, Depends On, Status
   - Tasks that can run in parallel should have no dependency on each other
5. Remove folded standalone items from ROADMAP (but note them in the WQ entry under "Roadmap items folded in")
6. Add "Active: [Initiative Name]" section header to `docs/WIP.md`

### 2. Complete Task (for orchestrator use)

Trigger: A sub-agent or implementer reports task completion.

Note: The `vite-react-implementer` skill handles WIP append automatically. This operation is for when the orchestrator needs to update WQ task status.

1. Update the task row in `docs/WORK-QUEUE.md` — set status to "done", add commit hash
2. Check if all tasks in the current wave/phase are done — if so, note it

### 3. Complete Wave

Trigger: All tasks in a wave are done.

1. Update `docs/WORK-QUEUE.md` — mark wave as complete
2. Check if the next wave can start or if user input is needed
3. Report wave completion to user

### 4. Complete Initiative

Trigger: All waves done, or user says "done enough".

1. Check for outstanding tasks in `docs/WORK-QUEUE.md`:
   - If any tasks are still open, ask the user: complete them, defer them, or push back to roadmap?
   - Push deferred tasks back to `docs/ROADMAP.md` as standalone items (append, don't edit existing rows)
2. Update initiative row in `docs/WORK-QUEUE.md` — set final status, keep the row
3. Remove completed task rows from WQ (the initiative row stays)
4. Move the plan file to `docs/plans/archive/` — add archive header
5. Update `docs/ROADMAP.md` — set initiative status to "Done" or "Partial — [remaining items returned to roadmap]"
6. Trim `docs/WIP.md` — replace detailed entries with a compact summary block:
   ```
   ### [Initiative Name] — COMPLETE (YYYY-MM-DD)
   Key commits: `abc1234`, `def5678`, ...
   [1-2 sentence summary of what was delivered]
   ```

### 5. End of Session

Trigger: User says "wrap up", "end of session", or conversation is ending.

1. Read all three files
2. Ensure WIP reflects the latest work (check git log for uncommitted WIP entries)
3. Ensure WORK-QUEUE task statuses match reality
4. Update `docs/ROADMAP.md` if any initiative statuses changed
5. Update Claude memory if any non-obvious decisions were made this session
6. Report: what was done, what's next, any blockers

### 6. New Standalone Item

Trigger: User reports a bug, identifies debt, or notes a new item.

1. Append to the appropriate section in `docs/ROADMAP.md`
2. Assign next available WQ-### ID (scan for highest existing ID + 1)
3. If the item clearly belongs to an active initiative's plan, suggest folding it in

## Format Rules

### ROADMAP.md

- **Initiatives** have a status line: `> **Status:** [Not planned | Planned | In Work Queue | Done | Partial]`
- **Standalone items** are in tables grouped by area, with columns: ID, Title, Sev, Description
- **Never delete rows.** Mark done items in a "Completed" section at the bottom. If scope changes, add a new version row (RI-001-v2).
- **Removed section** at the bottom tracks items verified as invalid, with removal reason.

### WORK-QUEUE.md

- Each initiative has an inline task table:
  ```
  | Task | Title | Depends On | Status | Commit |
  |------|-------|-----------|--------|--------|
  | W4-01 | Migrate drinks to food | — | pending | |
  | W4-03 | Wire TodayLog | W4-01 | pending | |
  ```
- "Depends On" column enables parallel dispatch — tasks with no dependency can run simultaneously
- Done tasks are removed when the initiative completes (git history is the record)
- Initiative row stays with final status

### WIP.md

- **Newest first** — prepend, don't append
- **Timestamped** — every entry has `(YYYY-MM-DD HH:MM)`
- **Per-task entries** written by implementer agents (see vite-react-implementer skill)
- **Summary blocks** replace detail when an initiative completes
- Active initiative section at the top, completed summaries below
