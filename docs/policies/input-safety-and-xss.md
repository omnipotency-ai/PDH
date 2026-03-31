# Input Safety and XSS Policy

Date: 2026-02-25

## Goal

Prevent repeat mistakes by enforcing input safety in shared write paths and keeping UI rendering text-only by default.

## Current Policy

1. Treat all user-entered and model-generated text as untrusted.
2. Sanitize text on write (client wrappers and Convex mutations).
3. Enforce backend length limits for high-risk free-text channels.
4. Render text as plain text in React (no raw HTML APIs).
5. If rich text is ever introduced, add a dedicated sanitization pipeline first (allowlist-based), then review all render sites.

## What Is Implemented

### Shared client-side sanitization (central write wrappers)

- `src/lib/inputSafety.ts`
- `src/lib/sync.ts`

`src/lib/sync.ts` now sanitizes string content recursively before sending payloads for:

- logs add/update
- profile saves
- conversations (Dr. Poo thread)
- AI analysis payload persistence
- food library batch inserts
- weekly summaries

### Shared Convex write-path sanitization and limits

- `convex/lib/inputSafety.ts`
- applied in:
  - `convex/logs.ts`
  - `convex/conversations.ts`

This currently enforces:

- `syncKey` sanitization and max length
- user conversation message max length (`2500`)
- assistant conversation message max length (`12000`)
- search keyword max length (`120`)
- recursive plain-text sanitization for stored log/profile string fields
- generic backend ceiling for individual stored string fields (`5000`) in sanitized recursive payloads

## XSS / HTML Rendering Guard

Run:

```bash
bun run audit:ui-safety
```

This fails if `src/` contains raw HTML rendering APIs:

- `dangerouslySetInnerHTML`
- `innerHTML =`
- `contentEditable`

## Notes

- We are **not** adding an HTML sanitization dependency right now because the app does not render user HTML.
- React text rendering already escapes text nodes, which is the correct default for this app.
- If a future feature needs rich text/HTML, use a dedicated sanitizer (allowlist-based) at the render boundary and document the allowed tags/attributes.

## Follow-up Audit (Later)

- Backend field-specific max lengths (beyond the current shared safety ceilings)
- Full Convex write-path coverage outside Track/Conversations
- Tests for sanitization helpers and rejection paths

