# Cross-Tool Collaboration

This repo is actively worked on with both Claude Code and Codex. The goal is not to make both tools do the same job. The goal is to give each tool a clear lane and a clean handoff format.

## Default Roles

**Claude Code**

- Best for orchestration, phased plans, long-running multi-agent work, dashboard operations, and visual verification with the user's logged-in browser.
- Owns high-context coordination: deciding phases, dispatching worktrees, consolidating findings, and keeping project memory coherent.
- Prefer Claude for tasks that depend on the user-level memory in `~/.claude/projects/.../memory/` or on Claude-in-Chrome access.

**Codex**

- Best for precise implementation, repo-grounded refactors, test-driven edits, code review, and tight patch loops in the current workspace.
- Owns low-noise execution: reading the relevant files, making targeted edits, running verification, and reporting concrete risks.
- Prefer Codex for tasks that need disciplined shell work, precise diffs, or strong repo-local reasoning.

## Shared Source Of Truth

Use this precedence order when both tools are involved:

1. The current user request
2. Repo instructions: `AGENTS.md`, `CLAUDE.md`, and any path-local instruction files
3. Convex rules in `convex/_generated/ai/guidelines.md` when Convex code is touched
4. Current task docs in `docs/` such as plans, specs, WIP, and work queue files
5. User-level Claude memory files only when explicitly relevant and referenced

If a decision matters in future sessions, write it into the repo. Do not leave critical task state only in `~/.claude` memory.

## Handoff Contract

Every Claude -> Codex or Codex -> Claude handoff should include:

- Goal: the user-visible outcome
- Scope: exact files or directories that matter
- References: plan docs, screenshots, memory files, commits, or PRs
- Constraints: exclusions, architecture rules, and non-goals
- Verification: the commands or checks that must pass
- Deliverable: code change, review, dashboard check, screenshots, or docs update

Bad handoff:

- "Fix the nutrition card"

Good handoff:

- "Implement Task W4-02 from `docs/plans/2026-04-05-nutrition-card-fix.md` in `src/components/track/nutrition/`, using screenshots `15.png` and `17.png`, without changing Convex schema. Run `bun run typecheck` and report any test gaps."

## Recommended Split

### Claude plans, Codex executes

Use this when the task needs heavy orchestration but a precise implementation pass.

1. Claude reads the plan, memory, screenshots, and references.
2. Claude produces a narrow execution prompt with exact file paths and acceptance criteria.
3. Codex implements and verifies in the main workspace or a designated worktree.
4. Claude performs browser or dashboard verification if needed.

### Claude researches, Codex reviews

Use this when Claude has the context and Codex should act as an adversarial reviewer.

1. Claude gathers the relevant context and narrows the review scope.
2. Codex reviews the diff or files for correctness, regressions, and missing tests.
3. Claude decides whether to dispatch fixes or close the loop.

### Codex implements, Claude verifies visually

Use this for UI tasks.

1. Codex builds the component or refactor.
2. Claude verifies against annotated references in the logged-in browser.
3. Any visual corrections are handed back with screenshots and exact mismatches.

## Worktree Rules

- One active implementation task per worktree.
- Do not have Claude and Codex edit the same files at the same time.
- Claude worktrees live under `.claude/worktrees/` and are intentionally ignored by git.
- Before dispatching a worktree agent, make sure all referenced repo files already exist on the branch it will use.
- If a task depends on ports, record the actual port from server output rather than assuming the requested port was honored.
- Keep long-lived shared docs in the main repo, not inside ephemeral worktree-only paths.

## Tracking Rules

- If a task changes project state, update the repo tracking docs that apply:
  - `docs/WIP.md`
  - `docs/WORK-QUEUE.md`
  - relevant plan JSON or plan markdown files
- Keep Claude memory append-only. Do not replace history with summaries.
- If Codex creates or updates repo skills under `.agents/skills/`, commit them. They are first-class project assets.

## Anti-Patterns

- Letting user-level Claude memory become the only place where decisions live
- Dispatching agents with dead paths or generic prompts
- Having both tools patch the same file concurrently
- Burning the orchestrator context on file reading that could have been delegated
- Treating visual specs as optional for UI tasks

## Copyable Handoff Template

```md
Goal:
- <user-visible outcome>

Scope:
- <exact files or directories>

Read first:
- <repo docs>
- <screenshots or memory files>

Constraints:
- <rules, exclusions, architecture constraints>

Verification:
- <commands to run>
- <manual checks to perform>

Deliverable:
- <implementation, review, screenshots, docs update, etc.>
```
