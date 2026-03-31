# ADR-0001: Cloud-Only Architecture

## Status

Accepted (2026-03-11)

## Context

The app evolved from local-first to cloud-first organically, but retained
hybrid persistence (Zustand+IDB for settings, Convex for logs). This created
bidirectional sync complexity, race conditions, and unclear source-of-truth
boundaries. The Zustand store was ~1130 lines with 15+ migration functions,
a custom IDB storage adapter, and version-gated data migrations.

## Decision

- Convex is the sole persisted source of truth for all app data.
- Browser storage is used only for the device-local OpenAI API key (via idb-keyval).
- Zustand owns transient UI/session state only (not persisted).
- AI API calls route through Convex actions (key sent transiently, never stored).
- The app requires connectivity. Offline logging is not supported.
- A one-time migration reads the legacy IDB blob and pushes data to Convex.

## Consequences

- Simpler source-of-truth boundaries — no bidirectional sync
- No sync logic, no migrations, no profile reconciliation
- New devices need only an OpenAI key — all other data loads from Convex
- Zustand store shrinks from ~1130 lines to ~277 lines
- 33+ files migrated from useStore() to ProfileContext/useApiKeyContext
- Settings read/write flows through Convex reactive queries and mutations
- Trade-off: API key traverses TLS to Convex actions (encrypted in transit, never stored)
