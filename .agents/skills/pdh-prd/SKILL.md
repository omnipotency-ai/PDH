---
name: pdh-prd
description: Create a repo-native Product Requirements Document for a PDH feature. Use when the user asks to create a PRD, define requirements, scope a feature, or turn an idea into a buildable spec. Save PRDs under docs/prd/, not tasks/.
---

# PDH PRD

Write implementation-ready PRDs for this repo. The output is a product and execution input, not code.

## Use This Skill When

- The user has a feature idea but no written requirements
- A roadmap item needs to be scoped before planning
- A messy discussion needs to become a clear spec

Do not implement the feature while using this skill.

## Inputs To Read First

Read only what is needed:

1. `CLAUDE.md`
2. `AGENTS.md`
3. `docs/ROADMAP.md` when the feature may already exist there
4. Relevant existing plan or research docs if the user references them

## Workflow

### 1. Clarify only what matters

Ask 3-5 essential questions max when the request is ambiguous.

Focus on:

- problem / goal
- who the user is
- scope boundaries
- success criteria
- whether this is UI-only, backend-only, or end-to-end

Prefer lettered options so the user can answer quickly.

### 2. Write the PRD

Save to:

`docs/prd/YYYY-MM-DD-<feature-slug>.md`

Use this structure:

1. Overview
2. Goals
3. Non-goals
4. User stories
5. Functional requirements
6. Design considerations
7. Technical considerations
8. Success metrics
9. Open questions

## PRD Rules

- Write for a junior developer or implementation agent
- Acceptance criteria must be concrete and testable
- Separate current reality from aspiration
- For UI stories, include browser verification in acceptance criteria
- Name exact existing components or files to reuse when known
- Do not quietly expand scope

## User Story Format

```md
### US-001: <title>

**Description:** As a <user>, I want <capability> so that <benefit>.

**Acceptance Criteria:**

- [ ] <specific verifiable criterion>
- [ ] <specific verifiable criterion>
- [ ] Typecheck passes
- [ ] Browser verification completed
```

## Output

When finished:

1. save the PRD
2. give the file path
3. propose the exact next prompt to turn it into a plan

Use this next-step prompt shape:

```text
Turn docs/prd/YYYY-MM-DD-<feature-slug>.md into an implementation plan in docs/plans/YYYY-MM-DD-<feature-slug>.md.
Break it into waves and task IDs, include dependencies, exact file targets, verification commands, and non-goals.
Make it suitable for sub-agent-development.
```
