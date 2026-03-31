# ADR-007: AI Model Configuration Strategy

**Status:** Accepted
**Date:** 2026-02-28
**Decider:** Peter
**Source:** WP-14 #6 · Maintainability

## Context

The app uses OpenAI models for two distinct purposes: lightweight background tasks (coaching snippets, food parsing) and user-facing insight generation (daily reports, pattern analysis). Model names were previously hardcoded across multiple files, making it difficult to upgrade models or let users choose their preferred insight quality level.

## Options Considered

### Option A: Single model for everything

One model constant used across all AI calls.

- Simple, one thing to configure
- Cannot optimise cost (cheap model for background) vs quality (better model for insights)
- User has no control over quality/cost trade-off

### Option B: Two-tier configuration (selected)

Separate background and insight models in a single config file:

- **Background model:** Cheapest available, not user-configurable. Used for coaching snippets, food parsing, and other high-frequency low-stakes tasks. One constant.
- **Insight model:** User-selectable from a curated list. Used for daily reports, pattern analysis, and other user-facing outputs. Selection stored in app settings.

### Option C: Full model registry

User can select any model for any task via a detailed configuration UI.

- Maximum flexibility
- Overwhelming UX for a personal health app
- Risk of misconfiguration (e.g. using an expensive model for background parsing)

## Decision

**Option B: Two-tier configuration.** A single config file (`src/lib/aiModels.ts`) defines both tiers. No model names appear in business logic — only imports from the config file. The background model is a constant; the insight model is a user preference stored in the user's profile (Convex).

## Consequences

### Positive

- Model upgrades require changing one file
- Users can balance cost vs quality for insight generation
- Background tasks stay cheap without user intervention

### Negative

- Adding a third tier (e.g. a "creative" model for meal plans) requires updating the config structure
- Users need to understand what "insight model" means — mitigated by clear labels in the settings UI

## Addendum (2026-03-15): Food LLM Matching Exception

The food matching pipeline (`convex/foodLlmMatching.ts`) uses a **hardcoded third model** that sits outside the two-tier system: `gpt-4o-mini-search-preview`. This model is hardcoded because it is the only OpenAI model with native web search capability, which is required to identify brand names and regional foods not in the registry. It is not a background model (it is not high-frequency) and not an insight model (it is not user-facing analysis). It is a specialised tool call with a unique capability requirement.

**Current model assignments (as of 2026-03-15):**

| Task                                             | Model                                                                   | Configurable       |
| ------------------------------------------------ | ----------------------------------------------------------------------- | ------------------ |
| Background (coaching, suggestions, food parsing) | `gpt-5-mini` (`BACKGROUND_MODEL` in `src/lib/aiModels.ts`)              | No                 |
| Insight (Dr. Poo reports, pattern analysis)      | `gpt-5.4` default, `gpt-5-mini` option (`INSIGHT_MODEL_OPTIONS`)        | Yes (user setting) |
| Food LLM matching (unresolved food items)        | `gpt-4o-mini-search-preview` (hardcoded in `convex/foodLlmMatching.ts`) | No                 |

The food matching model is intentionally hardcoded: web search capability is a binary requirement, not a quality preference. If OpenAI releases a successor search model, update `convex/foodLlmMatching.ts` directly. The two-tier config file (`src/lib/aiModels.ts`) does not govern this use case.
