# Branching Convention — Caca Traca

A literary/mythic naming system for git branches. Each prefix maps to a specific
domain of work so future-you (and Claude Code) can pick the right namespace in
under five seconds.

The theme: transformation, refinement, journey, and the patient cataloguing of
the unknown — which is, more or less, what building this app is.

---

## The Pantheon

| Prefix | Domain | Source |
|---|---|---|
| `dantes-inferno/*` | Food page work | Dante's *Inferno* |
| `pans-labyrinth/*` | Audits, cross-app fixes, bug fixes | Guillermo del Toro |
| `piranesi/*` | Data cataloguing & calibration (calorie/portion/index work) | Susanna Clarke |
| `ouroboros/*` | Refactors, optimisations, tidy-ups | Alchemical symbol |
| `memory-of-light/*` | Version releases | *Wheel of Time* #14 |
| `odyssey/*` | Epic features, long multi-sprint journeys | Homer |
| `recluse/*` | Small features, side branches, experiments (may not merge) | Modesitt's *Saga of Recluce* |
| `enneads/*` | AI plumbing — Convex functions, streaming, model calls, the substrate | Plotinus |
| `prospero/*` | RAG, knowledge retrieval, source corpus | Shakespeare's *The Tempest* |
| `pug/*` | The 4 personas (Nourish, Coach, Buddy, Dr. Poo), system prompts, voice work | Feist's *Riftwar* |
| `polgara/*` | Proactive AI care — the Jiminy Cricket layer | Eddings' *Belgariad* |
| `codice/*` | Documentation | The reference book itself |
| `alchemist/*` | Tests & QA | Coelho / alchemical tradition |

**13 prefixes. One per domain. No overlaps.**

---

## Decision Guide

When you're about to create a branch, walk this list top-to-bottom and stop at
the first match.

1. **Is this a release?** → `memory-of-light/`
2. **Is it tests, QA, or coverage work?** → `alchemist/`
3. **Is it documentation?** → `codice/`
4. **Is it AI plumbing — Convex functions, streaming, model calls, token accounting?** → `enneads/`
5. **Is it RAG / knowledge retrieval / source corpus work?** → `prospero/`
6. **Is it persona voice work — system prompts, tone, the four voices?** → `pug/`
7. **Is it proactive coaching — when/whether to nudge Peter?** → `polgara/`
8. **Is it food page UI/UX?** → `dantes-inferno/`
9. **Is it data work on the food registry — calories, portions, indices, canonicalisation?** → `piranesi/`
10. **Is it a bug fix or audit finding anywhere across the app?** → `pans-labyrinth/`
11. **Is it a refactor, optimisation, or tidy-up?** → `ouroboros/`
12. **Is it a new feature?**
    - **Big, multi-sprint, touches many areas** → `odyssey/`
    - **Small, scoped, or experimental (might not merge)** → `recluse/`

If two prefixes seem to fit, pick the more specific one. (E.g. a bug in the
food page → `dantes-inferno/` over `pans-labyrinth/`, because food page is
more specific than "anywhere in the app".)

---

## The AI Four-Layer Split

The AI work is split across four prefixes in a deliberate emanation hierarchy:

- **`enneads/`** = **Substrate.** The plumbing everything else emanates from.
  Convex functions, model invocation, streaming, token accounting, retries,
  rate limits, the raw infra. Named for Plotinus's *Enneads*, where reality
  flows downward in layers from a single foundational source.
- **`prospero/`** = **Knowledge.** RAG, source corpus, NotebookLM-style
  retrieval, the food registry as a queryable knowledge base. Prospero is the
  scholar-magus defined by his books — knowledge retrieved and orchestrated
  on demand.
- **`pug/`** = **Voices.** The four personas themselves (Nourish, Coach,
  Buddy, Dr. Poo). System prompts, tone calibration, persona-specific thread
  state, the rules that keep Nourish from sounding like Dr. Poo. Pug is the
  magician who masters multiple traditions of magic — perfect for bridging
  four distinct coaching voices.
- **`polgara/`** = **Care.** Proactive coaching — the Jiminy Cricket layer.
  When to nudge, what care looks like, the matriarchal "I know what you need
  before you do" element. Not yet developed at time of writing. Polgara is
  the healer-matriarch of the *Belgariad* who quietly steers Garion across
  decades.

*Substrate → knowledge → voices → care.* Four layers, four prefixes.

There's a Hermetic thread running through the whole convention:
**`enneads`** (Neoplatonism) → **`prospero`** (Renaissance magus) →
**`alchemist`** (transmutation) → **`ouroboros`** (the alchemical seal).
Coherent on purpose.

---

## Branch Name Format

```
<prefix>/<short-kebab-description>
```

Keep the description under ~5 words. Verb-first when it helps.

### Examples

```
dantes-inferno/staging-area-increment-controls
dantes-inferno/zone-aware-food-search
pans-labyrinth/fix-transit-map-disconnect
pans-labyrinth/audit-c1-c6-bugs
piranesi/normalise-metric-portions
piranesi/bayesian-evidence-rescore
ouroboros/save-first-enrich-later
ouroboros/canonicalisation-cleanup
memory-of-light/v0-3-0
odyssey/transit-map-rebuild
odyssey/full-coaching-system
recluse/spike-voice-input
recluse/experiment-streak-gamification
enneads/convex-streaming-handler
enneads/token-accounting
prospero/notebooklm-source-pipeline
prospero/food-registry-rag
pug/nourish-system-prompt
pug/dr-poo-on-demand-trigger
pug/buddy-tone-softening
polgara/proactive-hydration-nudge
polgara/morning-checkin-trigger
codice/branching-convention
codice/agent-prompt-spec-format
alchemist/convex-test-food-registry
alchemist/playwright-food-log-flow
```

---

## Notes for Claude Code Sessions

When orchestrating parallel agents in worktrees, the prefix tells the agent
(and you) what it's allowed to touch:

- An `enneads/` agent works on infra only — no persona copy, no RAG logic, no UI.
- A `prospero/` agent works on retrieval and source management — never writes persona prompts or model-calling code.
- A `pug/` agent works on persona voice and system prompts — never touches infra or retrieval logic.
- A `polgara/` agent works on proactive trigger logic — when/whether to nudge — never the voices themselves.
- A `piranesi/` agent never touches UI — it's pure data work.
- A `recluse/` agent has the loosest leash because the branch may never merge.
- An `alchemist/` agent only writes tests; if it finds a bug, it opens a `pans-labyrinth/` branch for the fix.

This separation makes parallel agent work much safer — each agent has a
clearly defined blast radius matching its prefix.

---

*"Fix one thing, prove it works, move on."*
