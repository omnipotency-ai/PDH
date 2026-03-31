---
name: preflight
description: Completion checklist — run before finishing any work session. Verifies branch safety, code quality, tests, build, commits, memory updates, and WIP doc updates. Invoked automatically by Stop hook or manually via /preflight. MUST pass before session can end.
---

# Preflight Completion Checklist

Run each check in order. Fix failures before proceeding.

> If no code was written or modified this session, skip to step 5 (Memory & Docs).

## 1. Branch Check

`git branch --show-current`
FAIL if `main` or `master` — switch to a feature branch first.

## 2. Quality Gates

Run in sequence — stop on first failure:

1. `bun run typecheck` — must exit clean
2. `bun run lint:fix` — re-read any files Biome reformatted
3. `bun run build` — must succeed

## 3. Tests

- Run tests for changed code (e.g. `npx vitest run`)
- If new code was written, verify tests exist for it
- All tests must pass

## 4. Commit

- `git status` — no uncommitted work should remain
- Stage and commit with a descriptive message if needed
- Never commit `.env`, credentials, or secrets
- Never commit to `main` or `master`

## 5. Memory & Docs

Update memory files at `~/.claude/projects/-Users-peterjamesblizzard-projects-caca-traca/memory/` if:

- Project state changed (sprint progress, decisions, status)
- New feedback was given by user
- New user preferences were discovered
- Update `MEMORY.md` index if new memory files were added

Update `docs/WORK-QUEUE.md` if completing WQ items.
Update plan docs if following a plan.

## 6. Signal Done

After ALL checks pass, run:

```bash
touch /tmp/claude-preflight-passed
```

## 7. Report

```
Preflight: PASS
Branch: <name>
Typecheck: pass/fail
Tests: pass/fail (<count>)
Build: pass/fail
Committed: yes/no
Memory: updated / no changes needed
WIP docs: updated / N/A
```
