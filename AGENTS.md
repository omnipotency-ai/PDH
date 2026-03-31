## Skills
A skill is a set of local instructions to follow that is stored in a `SKILL.md` file.

### Available skills
- vite-react-implementer: Feature implementation specialist for this project (Vite React + Convex + Zustand). Use for implementing tasks from PRDs, bugfix follow-ups from reviews, and scoped code changes that should follow project conventions. (file: /Users/peterjamesblizzard/projects/caca_traca/.claude/skills/vite-react-implementer/SKILL.md)

### How to use skills
- Trigger rules: If the user names `$vite-react-implementer` (or plain text `vite-react-implementer`), or the task is clearly feature implementation in this repo, use this skill.
- Loading: Open the listed `SKILL.md` and follow it. Load only additional referenced files when needed.
- Path resolution: Resolve any relative paths from the skill directory first.
- Fallback: If the skill file is missing/unreadable, state that briefly and continue with best-effort implementation.
