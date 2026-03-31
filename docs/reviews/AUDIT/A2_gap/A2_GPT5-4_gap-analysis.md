# V1 Launch-Readiness Audit Plan

## Summary

Produce a documentation classification and plan-vs-implementation audit aimed at one outcome: a credible roadmap to launch Caca Traca v1 to an initial audience of roughly 100 users.

Authoritative weighting for this audit:
- `docs/VISION.md` is the primary statement of intended v1 scope.
- `docs/scratchpadprompts/transitmap.md` is a high-value intent source for the food journey, transit-map metaphor, rewards, and progression model, even if it is long and informal.
- `docs/current-state-architecture.md` is a strong implementation claim that must be verified, not blindly trusted.
- The codebase is evidence of what is wired today, but not the sole authority for product scope, because some implemented areas may be intentionally out of v1.
- Archived docs get medium weight: use them when they still explain current structures, unresolved migrations, or major feature intent not captured elsewhere.

The report will optimize for `architecture/feature gaps` with an execution-aware launch lens:
- What major modules and flows exist or are missing.
- What should be descoped from v1 for cohesion.
- What top actions are required to make the product launchable and robust enough for early users.

## Key Sources To Classify And Use

Primary sources to rely on heavily:
- `docs/VISION.md`
- `docs/scratchpadprompts/transitmap.md`
- `docs/current-state-architecture.md`
- `docs/STRATEGIC_OVERVIEW.md` with explicit staleness caveats
- `docs/adrs/0001-cloud-only-architecture.md`
- `docs/adrs/0002-food-registry-and-canonicalization.md`
- `docs/adrs/0007-ai-model-configuration.md`

Secondary sources to use when they materially affect v1 readiness:
- Active plans in `docs/plans/`, especially food pipeline, migration, review-fix, and release-lock docs
- Working docs in `docs/working/` that describe completed or partial refactors still visible in code
- Reviews that contain architectural claims or feature-level status, especially `docs/reviews/AUDIT/*` and `docs/reviews/ai_prompt/*`

Sources to down-weight or mostly exclude:
- Pure debugging/session logs unless they record architectural decisions or unfinished migrations still relevant
- Low-level backlog items unless they express meaningful v1 features, blockers, or descoping decisions
- Prompt scratchpads that do not describe concrete product behavior

## Audit Method

### 1. Documentation classification
Build a doc inventory from the concatenated index, then classify each document by inferred role:
- Strategic overview / vision
- Architecture / current state
- Plan / PRD / phase plan / migration plan
- ADR
- Code review / refactor review
- Debugging / incident notes
- Backlog / TODO
- Scratchpad / working notes

For each doc, decide:
- Whether it is relevant to v1 launch-readiness and plan-vs-implementation analysis
- Whether it is stale, superseded, or still operative
- Whether it expresses scope, architecture, implementation status, or only temporary working context

### 2. Architecture mapping from code
Map the actual implemented system by major module and flow, using `src/`, `convex/`, `shared/`, tests, config, and relevant docs as evidence.

Core areas to cover:
- Food input and food pipeline
- Food registry / canonicalization / ingredient exposure model
- Patterns / transit map / database / food trial summaries
- AI analysis / Dr. Poo / prompts / report extraction / suggestions
- Daily logging and today-log editing flows
- Habits / quick capture / streaks / celebrations
- Settings / profile / personalization / app data / BYOK key handling
- Data architecture: Convex, Clerk, Zustand, IndexedDB, PWA/service worker
- Release-readiness foundations: test coverage reality, CI/CD presence, security and data-handling issues that materially affect v1

For each area, record:
- Intended behavior from selected docs
- Actual implementation shape and key files
- Whether it is launch-ready, partial, divergent, emergent, or a descoping candidate

### 3. Gap analysis
Create coarse-grained feature/flow findings, not micro-bugs.

Gap categories:
- `missing`: planned for v1 or strongly implied by architecture docs, absent in code
- `partial`: visible implementation exists but the end-to-end feature/flow is incomplete
- `different-better`: implemented differently than planned in a way that improves viability
- `different-worse`: implemented differently in a way that weakens usability, coherence, or architecture
- `emergent`: implemented without a clear durable plan source
- `descope candidate`: implemented or partially implemented but should be removed, hidden behind a flag, or explicitly deferred from v1

Priority will be based on user impact and launch risk:
- `critical`: blocks core product value or creates major risk for launch
- `high`: should be resolved before launch for cohesion or reliability
- `moderate`: important but can be deferred with explicit documentation
- `low`: cleanup or clarity improvements

### 4. Launch-readiness overlay
In addition to plan-vs-code drift, evaluate whether the product can plausibly serve ~100 users:
- Can a user log food and see meaningful downstream representation and analysis?
- Are the core food-to-insight flows coherent end to end?
- Is personalization real and configurable, or mostly hardcoded?
- Does BYOK work acceptably for v1, and what are the practical risks?
- Are there missing foundations such as CI, test reliability, broken analysis loops, or unstable partial modules that undermine launch confidence?

Include a short BYOK recommendation:
- Assess whether browser-local API key storage is acceptable for a 100-user v1
- Clarify current risk posture
- Recommend the next safer architecture without turning the report into a deep security memo

## Deliverable Structure

The final report will follow the format you requested, with two additions:
- A `descoping candidates` thread embedded into the gaps and recommendations
- Rough effort sizing for top actions

Sections:
1. `Documentation Map`
2. `Current Architecture Map`
3. `Plan vs Implementation Gaps`
4. `Stale or Misleading Docs`
5. `Recommended Actions`

Additional output conventions:
- Every meaningful gap will cite at least one doc and one code location
- Major modules will be described in terms of behavior and flow, not file inventories
- Recommendations will include rough effort sizing such as `small`, `medium`, `large`, or `multi-week`
- Reproductive health and similar features will be treated as `descoping candidates` if they reduce v1 cohesion
- Testing, CI, and security will be included only where they materially affect launch-readiness or architecture confidence

## Test And Validation Coverage In The Audit

The audit itself is read-only, but evidence can include:
- Existing test files and test organization
- Whether claimed test infrastructure exists and is relevant
- Whether CI/CD presence or absence materially weakens launch confidence
- Whether docs claim robustness that is not supported by implemented checks

The report will not try to fully re-verify every test result; it will use current repo structure and documented review evidence to assess confidence and identify major blind spots.

## Assumptions And Defaults

- Primary outcome is a v1 launch roadmap, not a pure historical fidelity exercise.
- Implemented code that conflicts with v1 scope may be recommended for removal or feature-flagging rather than treated as success.
- Archived documents are relevant when they still explain the food pipeline, transit-map intent, migration state, or launch blockers.
- `docs/current-state-architecture.md` is helpful but potentially stale outside the food-system work updated around 2026-03-15.
- The audit should be comprehensive across docs, code, tests, and config, but concise at the feature/module level rather than exhaustive line-by-line verification.
