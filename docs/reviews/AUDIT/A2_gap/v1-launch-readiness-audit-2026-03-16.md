# Caca Traca — Documentation Classification and Plan vs Implementation Gap Analysis
**Date:** 2026-03-16

## 1. Documentation Map (what you used)

### 1.1 Classified documents
| # | File Identifier / Name | Inferred Type | Short Description | Used in Gap Analysis? |
| --- | --- | --- | --- | --- |
| 1 | `docs/VISION.md` | Strategic overview / scoped v1 vision | Best statement of intended v1 product, user, feature scope, and deferred items. | yes |
| 2 | `docs/scratchpadprompts/transitmap.md` | Working architecture + product intent log | Long-form design and implementation memory for the food system, transit map, rewards, and launch blockers. | yes |
| 3 | `docs/current-state-architecture.md` | Current-state architecture | Strong implementation claim for data ownership, providers, food pipeline, and AI boundaries. | yes |
| 4 | `docs/STRATEGIC_OVERVIEW.md` | Architecture / review hybrid | Broad product and architectural scan with explicit staleness notes; useful as a risk lens, not as ground truth. | yes |
| 5 | `docs/adrs/0001-cloud-only-architecture.md` | ADR | Defines Convex-only persistence, IDB-only API key, and no offline writes. | yes |
| 6 | `docs/adrs/0002-food-registry-and-canonicalization.md` | ADR + implementation history | Canonical food model, zone model, deterministic-first parsing, and registry architecture. | yes |
| 7 | `docs/adrs/0007-ai-model-configuration.md` | ADR | Two-tier model strategy plus hardcoded food-search exception. | yes |
| 8 | `docs/product/launch-criteria.md` | Launch plan / readiness checklist | Claims current v1 blockers and “done” criteria; several claims are now stale. | yes |
| 9 | `docs/product/scope-control.md` | Scope-control plan | Explicit in-scope, deferred, and rejected work for v1. | yes |
| 10 | `docs/plans/2026-03-14-food-pipeline-ui-fixes.md` | Fix plan / implementation review | Useful for the unresolved-food UX and food request persistence status. | yes |
| 11 | `docs/plans/2026-03-15-food-matching-refactor-migration.md` | Migration plan | Server-first matching design with aliases, embeddings, and confidence routing. | yes |
| 12 | `docs/plans/2026-03-15-pr2-review-fixes.md` | Review fix plan | Useful for recent claimed fixes and remaining review waves. | yes |
| 13 | `docs/plans/v1-release-lock-migration-checklist.md` | Migration / release plan | Useful for schema hardening and release-lock history. | yes |
| 14 | `docs/working/2026-03-15-food-registry-refactor.md` | Working refactor note | Describes remaining taxonomy and metadata cleanup after core registry refactor. | yes |
| 15 | `docs/working/2026-03-15-food-matching-refactor-session-handover.md` | Session handover / implementation note | Useful for transition status, AI/report extraction intent, and remaining open questions. | yes |
| 16 | `docs/working/2026-03-16-pr3-review-findings-and-fixes.md` | Review / working note | Useful for recent implementation claims and remaining defects. | partial |
| 17 | `docs/dr-poo-architecture-ideas-and prompt-versioning/v3-strategy.md` | Prompt strategy / phased plan | Best source for intended Dr. Poo narrative and prompt evolution. | yes |
| 18 | `docs/reviews/ai_prompt/AI_SYSTEM_REVIEW.md` | Review | Historical AI system review; mostly useful for architectural concerns that still remain. | partial |
| 19 | `docs/reviews/ai_prompt/2026-02-25-dr-poo-prompt-and-data-review.md` | Review / architecture note | Early Dr. Poo data-flow intent; use cautiously because several assumptions were superseded. | partial |
| 20 | `docs/backlog/bugs.md` | Backlog / active issue register | Useful for open launch-relevant defects and descoping decisions. | yes |
| 21 | `docs/backlog/features.md` | Backlog / roadmap | Useful for remaining v1-v2 scope boundaries and planned admin/UI follow-ups. | yes |
| 22 | `docs/backlog/tech-debt.md` | Tech debt register | Useful for known architectural debt that directly affects launch confidence. | yes |
| 23 | `docs/SESSION-2026-03-10.md` | Session log | Mostly historical implementation chatter; low value unless tracing a regression. | no |
| 24 | `docs/archive/audits/*` | Archived reviews | Down-weighted; only used when a finding still maps cleanly to live code. | partial |
| 25 | `docs/scratchpadprompts/*` other than `transitmap.md` | Scratchpad / prompt notes | Mostly supporting context, not primary launch-readiness sources. | no |

### 1.2 Key planning / architecture sources
- `docs/VISION.md`: Primary v1 scope contract. It is the cleanest statement of what the app should be at launch and what is intentionally deferred.
- `docs/scratchpadprompts/transitmap.md`: The richest source for the intended food-system mental model, transit-map progression, reward model, and launch blockers that were discovered during implementation.
- `docs/current-state-architecture.md`: Best single-source claim of how the app is supposed to work now, especially for persistence, contexts, and the food pipeline. Several sections are accurate, but some are already behind the code.
- `docs/adrs/0001-cloud-only-architecture.md`: Defines the core persistence boundary and clarifies that offline behavior is intentionally not supported.
- `docs/adrs/0002-food-registry-and-canonicalization.md`: Explains the registry-first and deterministic-first food architecture and is essential for judging the food pipeline.
- `docs/adrs/0007-ai-model-configuration.md`: Useful for checking whether AI model selection and BYOK behavior match the intended operating model.
- `docs/product/launch-criteria.md`: Important because it declares what should block launch, but it now overclaims several “done” items and under-describes some current risks.
- `docs/product/scope-control.md`: The best source for descoping candidates, especially reproductive health, onboarding, and post-v1 work.
- `docs/plans/2026-03-15-food-matching-refactor-migration.md`: Important because the live code now reflects this server-first direction more than the older current-state doc does.

## 2. Current Architecture Map (based on code)

### Food input and food pipeline
Food logging is now raw-input-first and server-driven. The client saves only `rawInput`, empty `items`, and notes; `convex/logs.add` schedules processing, and `convex/foodParsing.ts` performs preprocessing, alias/fuzzy/embedding matching, confidence routing, user resolution support, and later evidence processing after the 6-hour window. The older client auto-LLM path still exists in code, but it is no longer the main pipeline shape and appears to be legacy.

Key files / directories:
- `src/hooks/useFoodParsing.ts`
- `convex/foodParsing.ts`
- `shared/foodMatching.ts`
- `src/components/track/FoodMatchingModal.tsx`

### Food registry, canonicalization, and ingredient exposure model
The food system is registry-first. `shared/foodRegistry.ts` holds the canonical foods, zones, group/line hierarchy, metadata, and examples; deterministic lookup lives in `shared/foodCanonicalization.ts`; downstream projection and evidence logic depend on canonical names rather than raw phrases. `ingredientExposures` are created server-side from resolved food items, which is consistent with the intended analytics contract.

Key files / directories:
- `shared/foodRegistry.ts`
- `shared/foodCanonicalization.ts`
- `shared/foodProjection.ts`
- `convex/schema.ts`

### Patterns, transit map, database, and food trial summaries
Patterns is partly modernized and partly transitional. The database/grid and hero metrics are driven from `analyzeLogs()` plus `foodTrialSummary` and mapped AI assessments, while the newer registry-driven transit map exists and renders, but its hook still drops AI verdict details and carries TODO placeholders such as `firstSeenAt`. There is also a split between the newer `RegistryTransitMap` path and the older visual `TransitMap` component stack, which makes the area feel more live than fully settled.

Key files / directories:
- `src/pages/Patterns.tsx`
- `src/hooks/useTransitMapData.ts`
- `src/components/patterns/transit-map/*`
- `shared/foodEvidence.ts`
- `convex/computeAggregates.ts`

### AI analysis system (Dr. Poo)
Dr. Poo is fully wired as a persisted Convex-backed reporting system. Reports are generated from recent logs plus half-week conversation history, recent suggestions, weekly summaries, food trial summaries, and profile data; the response schema includes `clinicalReasoning`, meal ideas, suggestions, and structured food assessments that are extracted into dedicated tables. The prompt is sophisticated and versioned in code, but still hardcoded rather than runtime-managed.

Key files / directories:
- `src/lib/aiAnalysis.ts`
- `src/hooks/useAiInsights.ts`
- `convex/ai.ts`
- `convex/aiAnalyses.ts`
- `convex/extractInsightData.ts`
- `src/components/archive/DrPooReport.tsx`

### Daily logging, habits, and quick capture
Track is the main authenticated workflow and is broadly cohesive. It supports food, fluid, bowel, habits, activity, weight, quick capture, unresolved-food review, and weekly summary auto-triggering; habit logs are rebuilt from synced logs into ephemeral Zustand state for fast UI access. The logging experience is usable, but it still carries a broad scope surface and some unresolved UX defects.

Key files / directories:
- `src/pages/Track.tsx`
- `src/components/track/*`
- `src/components/track/today-log/*`
- `src/components/track/quick-capture/*`
- `src/contexts/SyncedLogsContext.tsx`

### Settings, personalization, app data, and BYOK
Settings is broad and functional, with Convex-backed profile settings and IndexedDB-backed API-key storage. AI model preference is configurable, health/tracking/forms are real, and the app-data form exposes export/import/delete flows; however, reproductive health remains present in both settings and track flows despite being explicitly out of v1 scope. The BYOK implementation stores the key locally and passes it transiently to Convex actions, but the settings UI currently misstates that the key is “never sent to the cloud.”

Key files / directories:
- `src/pages/Settings.tsx`
- `src/components/settings/*`
- `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx`
- `src/hooks/useApiKey.ts`
- `src/lib/apiKeyStore.ts`

### Data and cloud architecture
The app is genuinely cloud-only in the core domain. Convex owns profiles, logs, food summaries, AI reports, conversations, suggestions, and weekly summaries; Clerk gates access; Zustand is ephemeral and no longer a persistence layer; IndexedDB stores the API key only. The one meaningful architectural blur that remains is duplicated food-evidence computation on both client and server.

Key files / directories:
- `src/routeTree.tsx`
- `src/store.ts`
- `src/contexts/ProfileContext.tsx`
- `src/contexts/SyncedLogsContext.tsx`
- `convex/schema.ts`

### Release-readiness foundations
The repository has meaningful automated coverage and currently passes non-E2E validation: `bun run typecheck` passed, and `bun run test:unit` passed with 607 tests. There is still no CI pipeline and no `.github/workflows/` directory, so quality gates remain manual. This is the single clearest launch-readiness gap outside the product itself.

Key files / directories:
- `package.json`
- `e2e/*.spec.ts`
- `convex/*.test.ts`, `convex/__tests__/*`
- `shared/__tests__/*`
- `src/lib/__tests__/*`

## 3. Plan vs Implementation Gaps

### 3.1 Feature & flow gaps
| # | Area / Module | Planned Behavior or Architecture | Actual Implementation (summary) | Gap Type | Priority | Key Files / Docs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | CI / release gating | Launch criteria and scratchpad notes both treat CI as a ship blocker before public launch. | No `.github/workflows/` exists; all checks are manual. Typecheck and unit tests pass locally, but nothing enforces this on push. | missing | critical | `docs/product/launch-criteria.md`, `docs/scratchpadprompts/transitmap.md`, `package.json` |
| 2 | End-to-end food-to-insight coherence | Vision and transit-map notes expect food entry to become meaningful visual and analytical guidance about what to eat next. | Logging and server-side matching are solid, but the downstream picture is split between deterministic analysis, AI summaries, a partial transit map, and stale/forked docs about which layer is authoritative. | partial | critical | `docs/VISION.md`, `docs/scratchpadprompts/transitmap.md`, `src/pages/Track.tsx`, `src/pages/Patterns.tsx`, `shared/foodEvidence.ts`, `src/hooks/useTransitMapData.ts` |
| 3 | Server-first food matching architecture | Migration plan says the server-first matcher with aliases, embeddings, confidence routing, and candidate/bucket UI should replace the older client LLM path. | `convex/foodParsing.ts` now implements that server-first design, but `docs/current-state-architecture.md` still describes a client-initiated LLM loop, and the legacy `useFoodLlmMatching` hook plus disabled `convex/foodLlmMatching` tests remain in repo history. | different-better | high | `docs/plans/2026-03-15-food-matching-refactor-migration.md`, `docs/current-state-architecture.md`, `convex/foodParsing.ts`, `src/hooks/useFoodLlmMatching.ts`, `convex/__tests__/foodLlmMatching.test.ts` |
| 4 | Transit map v1 scope | `launch-criteria.md` and `scope-control.md` still say “Phase 5 transit map UI” is deferred post-launch. | A registry-driven transit map UI already exists and renders, but it is incomplete: AI verdict fields are dropped, `firstSeenAt` is placeholder data, and a dead feature flag still claims to gate it. | different-worse | high | `docs/product/launch-criteria.md`, `docs/product/scope-control.md`, `src/lib/featureFlags.ts`, `src/hooks/useTransitMapData.ts`, `src/components/patterns/transit-map/RegistryTransitMap.tsx` |
| 5 | Reproductive health in v1 | Vision and launch docs say reproductive health is not ready for v1 and should be gated or deferred. | It is still present in schema, track flow, settings UI, AI prompt context, and today-log grouping. This is not just dormant code; it is active product scope. | descope candidate | high | `docs/VISION.md`, `docs/product/launch-criteria.md`, `src/pages/Track.tsx`, `src/pages/Settings.tsx`, `convex/schema.ts`, `src/lib/aiAnalysis.ts` |
| 6 | BYOK messaging and architecture | ADR-0001 says the API key is stored locally and sent transiently to Convex actions. | The implementation matches that model, but the settings UI says “never sent to the cloud,” which is false. For a small v1 this architecture is acceptable, but the disclosure is currently misleading. | different-worse | high | `docs/adrs/0001-cloud-only-architecture.md`, `src/hooks/useApiKey.ts`, `src/lib/apiKeyStore.ts`, `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx` |
| 7 | Runtime prompt management | Launch criteria treat runtime prompt management as a blocker. | Prompting is versioned in code and more mature than the doc suggests, but prompts remain hardcoded in `src/lib/aiAnalysis.ts` with no runtime editing or prompt registry. | partial | moderate | `docs/product/launch-criteria.md`, `docs/dr-poo-architecture-ideas-and prompt-versioning/v3-strategy.md`, `src/lib/aiAnalysis.ts` |
| 8 | Security hardening around AI and food requests | Reviews flagged sanitization and markdown-link issues as pre-release work. | `foodRequests.submitRequest` still stores unsanitized strings, `weeklySummaries` stores unsanitized LLM text, and AI markdown is rendered without a safe-link policy. | partial | high | `docs/reviews/AUDIT/A1_CC_codebase-health/CONSOLIDATED-AUDIT-REPORT.md`, `docs/reviews/AUDIT/A1_CC_codebase-health/A8-Security-report.md`, `convex/foodRequests.ts`, `convex/weeklySummaries.ts`, `src/components/archive/DrPooReport.tsx` |
| 9 | Single source of truth for food evidence | Current-state architecture and tech-debt docs both identify server-only evidence computation as the desired end state. | `buildFoodEvidenceResult()` still runs client-side for live UI and server-side for persisted summaries, so the same concept is computed in two places. | partial | high | `docs/current-state-architecture.md`, `docs/backlog/tech-debt.md`, `shared/foodEvidence.ts`, `convex/computeAggregates.ts` |
| 10 | Food request workflow | Food-pipeline fixes and feature backlog say persistence shipped but admin/review tooling is still needed. | `foodRequests` persistence exists and the modal can submit requests, but there is still no admin/review surface or approval loop. | partial | moderate | `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`, `docs/backlog/features.md`, `convex/foodRequests.ts`, `src/components/track/FoodMatchingModal.tsx` |
| 11 | Menu / Patterns duplication | Scope and tech-debt docs imply the product should converge on a coherent analysis surface. | Both Menu and Patterns independently call `analyzeLogs()`, which duplicates a heavy derived calculation and increases drift risk between surfaces. | emergent | moderate | `docs/backlog/tech-debt.md`, `src/pages/Patterns.tsx`, `src/pages/secondary_pages/Menu.tsx` |
| 12 | Onboarding / public-user readiness | Vision and backlog defer onboarding, but public launch docs still treat it as a meaningful “should have”. | There is no onboarding wizard; this is acceptable for a private or tiny beta, but weak for a broader public v1 where users must understand BYOK, logging model, and settings quickly. | missing | moderate | `docs/VISION.md`, `docs/product/launch-criteria.md`, `docs/backlog/features.md` |

### 3.2 Hanging or partial implementations
| # | Area | Intended End State (from docs) | Current State in Code | What’s missing to complete it | Suggested Next Step |
| --- | --- | --- | --- | --- | --- |
| 1 | Food-to-guidance loop | A user logs food, sees canonical food history, gets reliable safety signals, and receives sensible “next food” guidance. | The pipeline from raw input to canonical items is strong, but “what to eat next” still depends on a mix of deterministic stats, AI narrative, and a partial transit-map model. | Decide which layer is authoritative for v1 UI: deterministic, AI, or fused summary. Then remove or demote the others. | Write a short ADR for v1 food-status authority and collapse the UI to one visible truth. |
| 2 | Registry transit map | Phase 5 transit/game-layer concept should eventually become a clear, trustworthy map of progression. | Registry-based map exists, but still nulls AI verdict fields and carries placeholder data for `firstSeenAt`. Docs also disagree about whether it exists at all. | Wire real AI verdict/status metadata into transit stations or deliberately reduce the map to deterministic-only v1. | Pick a v1 transit-map contract and update `useTransitMapData` plus docs to match. |
| 3 | Reproductive health | Explicitly deferred or feature-gated for post-v1. | Still active in track, settings, schema, and AI context. | Either hide it completely behind a real flag or commit to supporting it. | For v1, gate the UI and exclude it from Track and AI payloads. |
| 4 | Prompt management | Launch criteria wants runtime prompt/version management. | Prompt version exists in code, but the prompt is still embedded in `src/lib/aiAnalysis.ts`. | Missing operational prompt editing/version policy, not missing AI functionality. | Downgrade this from “ship blocker” to “post-launch ops improvement” unless non-developer prompt editing is truly required. |
| 5 | Food request administration | Unknown foods should move from user request into a maintained registry workflow. | Request creation is implemented; review/admin tooling is absent. | Missing triage, status update, and approval surface. | Add a minimal admin-only list/detail screen or move the workflow fully out of product scope for v1. |
| 6 | Security cleanup for AI surfaces | Reviews expect user text and AI output to follow the same sanitization standards as the rest of the app. | Core app input safety exists, but newer paths (`foodRequests`, `weeklySummaries`, markdown links) still lag the standard. | Sanitization and safe-link wrappers are not consistently applied. | Patch those three paths before launch and re-run the security review. |

## 4. Stale or Misleading Docs
| # | Document | Section / Claim | What It Says | What Code Actually Does | Fix Doc or Fix Code? |
| --- | --- | --- | --- | --- | --- |
| 1 | `docs/current-state-architecture.md` | Server-side food pipeline section | Says the client hook `useFoodLlmMatching` detects unresolved items and drives the LLM path. | The main live architecture is now the server-first matcher in `convex/foodParsing.ts`; the older client hook exists but is no longer the main design. | Fix doc |
| 2 | `docs/product/launch-criteria.md` | “Phase 5: Transit map UI — Not implemented” | Treats the transit map as deferred post-launch. | Transit-map UI components and registry-driven map wiring exist now. | Fix doc |
| 3 | `docs/product/launch-criteria.md` | “Testing suite — Done” notes | Claims 75 E2E + 33 unit tests with old counts. | Current unit suite passes 607 tests; the doc’s numbers are stale and mix categories. | Fix doc |
| 4 | `docs/product/launch-criteria.md` and `docs/VISION.md` | Reproductive health feature-gated / deferred | Says repro is not ready for v1 and should be gated. | Repro is active product scope in Track, Settings, validators, and AI. | Fix code or explicitly descoped flagging |
| 5 | `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx` | API key disclosure text | Says the key is stored on-device and “never sent to the cloud.” | ADR-0001 and the actual request path send the key transiently to Convex actions. | Fix code copy |
| 6 | `docs/backlog/tech-debt.md` | “Transit map feature flag orphaned” | Says the flag remains after all TransitMap components were deleted. | Transit map components exist again, but the flag is still effectively dead because it is permanently `true`. | Fix both |
| 7 | `docs/scope-control.md` / `launch-criteria.md` | Prompt management as hard blocker | Treats runtime prompt management as mandatory for v1. | The live app already has versioned-in-code prompts and functional AI reports. The missing piece is runtime ops tooling, not core product viability. | Fix doc unless product policy says otherwise |

## 5. Recommended Actions (Top 8)
- Build a minimal CI pipeline now. Effort: `small`. Run `bun run typecheck`, `bun run test:unit`, and at least one Playwright smoke slice on push/PR. This is the cleanest launch blocker.
- Pick one authoritative v1 food-status surface. Effort: `medium`. Decide whether Patterns/Menu/transit map should lead with deterministic evidence, AI verdicts, or a fused summary, then simplify the UI and docs around that choice.
- Descope reproductive health for v1 in code, not only in docs. Effort: `medium`. Hide settings sections, remove Track entry points, and exclude it from AI context unless you explicitly want to support it.
- Fix AI/BYOK disclosure and hardening gaps. Effort: `small`. Update the settings copy to accurately describe transient server transit, sanitize `foodRequests` and `weeklySummaries`, and add a safe-link policy to markdown rendering.
- Rewrite `docs/current-state-architecture.md` and `docs/product/launch-criteria.md` together. Effort: `small`. They are still the main operational docs, but they now disagree with the code in exactly the areas a launch decision depends on.
- Collapse duplicated analysis paths where possible. Effort: `medium`. Start with lifting `analyzeLogs()` into one shared source for Menu and Patterns, then plan the larger `buildFoodEvidenceResult()` server-only cleanup.
- Treat prompt management as a post-launch operational improvement unless you need non-developer editing before launch. Effort: `medium` if done now, `small` if deferred and documented. The current hardcoded versioned prompt is acceptable for a small v1.
- Decide whether the transit map is in or out for v1. Effort: `medium`. If in, complete the missing station data and document it. If out, hide it cleanly and let the database/hero views carry the launch.

## Short BYOK recommendation
For a small v1 serving roughly 100 users, the current BYOK model is acceptable if you are explicit about it: the key is stored locally on the user’s device, then sent transiently over TLS to your Convex action so the server can call OpenAI, and it is not persisted server-side. That is not “never sent to the cloud,” so the product copy should say what actually happens. The safer next step after v1 is either a server-managed application key for first-party usage or a more deliberate user-secret strategy with clearer threat modeling and operational controls.
