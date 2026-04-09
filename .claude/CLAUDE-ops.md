---
description: Operational procedures for dashboard work, destructive operations, and cross-tool collaboration. Only relevant when doing Convex/Clerk/Vercel dashboard work, deleting data, or coordinating with Codex.
alwaysApply: false
---

# Operational Procedures

## Dashboard Operations (Convex, Clerk, Vercel)

**Use Claude-in-Chrome, not workaround scripts.** When you need to perform operations on Convex dashboard, Clerk dashboard, or Vercel — use the Claude-in-Chrome MCP tools (`mcp__claude-in-chrome__*`) to open the tab. The user already has these dashboards logged in and saved in their browser. Do NOT build clever internal mutations, scripts, or CLI workarounds for tasks the dashboard handles natively (e.g. running migrations, checking data, managing users, viewing logs). The dashboard is always simpler and safer.

**playwright-cli is for testing only.** `playwright-cli` runs a headless browser with no saved sessions — it cannot access dashboards. Use it for E2E testing and localhost browser verification. Use Claude-in-Chrome for anything requiring the user's credentials.

## Destructive Operations

Primary destructive-operation policy lives in `CLAUDE.md`.

When dashboard work includes a destructive step, follow the `CLAUDE.md` safety rules first, then use the dashboard procedure that best narrows the scope.

## Cross-Tool Collaboration

When Claude Code and Codex are both used on the same task, follow `docs/ai/cross-tool-collaboration.md`.

- Claude should bias toward orchestration, memory-aware planning, dashboard work, and visual verification.
- Codex should bias toward precise implementation, verification, and code review in the current workspace.
- Durable decisions belong in repo docs. User-level Claude memory is secondary and must not become the only source of truth.
