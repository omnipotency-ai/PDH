# Dr. Poo v3 Prompt Strategy — School of Thought A: "Structured Evolution"

> This document captures one school of thought: evolving the current structured JSON approach
> to address its limitations. See `architecture-rethink.md` for the alternative "chat-first" approach.
>
> **Status as of 2026-03-14:** Phase 1 and Phase 2 changes are implemented in `src/lib/aiAnalysis.ts`.
> The v3 prompt is live: `clinicalReasoning` field added, anti-repetition softened, food database
> gag-order relaxed, meal guidance activated by default, lifestyle reasoning merged into clinical
> narrative. Phases 3 and 4 are partially complete (meal guidance on, anchored time-window analysis
> pending). The prompt version in code is tracked via `promptVersion` in the AI analysis payload.

## Context & Timeline

This strategy emerged from a multi-session arc of prompt development:

- **v1** (Feb 2026): Original prompt. Single-personality, basic food analysis, no conversation awareness.
- **v2** (Mar 1 2026): 4-axis personality system (Approach × Register × Structure × Length), named presets, half-week context boundaries, Autonomy & Trade-Off Engine, directResponseToUser, educationalInsight, lifestyleExperiment state machine, baseline comparison deltas.
- **GPT Store comparison** (Mar 5–6): Peter built a custom GPT in the GPT Store with the same clinical knowledge but no JSON schema. He ran identical patient data through both systems and compared outputs. Dr. Poo was then asked to self-assess his own limitations.

## The GPT Store Experiment

Peter built a custom GPT ("Dr. Poo" in the GPT Store) that has the same clinical knowledge as the app's prompt but operates as a free-form conversational assistant. When given identical patient data:

**The GPT Store version produced:**

- Rich, flowing narrative that explained the "why" behind every observation
- Anchored time-window analysis (0–4h, 4–12h, 12–36h) for food-to-output tracing
- Lifestyle factors woven naturally into clinical reasoning ("your 4 coffees today vs your usual 1.4 shortened transit")
- Proactive meal ideas without being asked
- Educational content tailored to the patient's exact situation
- A tone that felt like talking to a knowledgeable friend

**The app's Dr. Poo produced:**

- Terse, structured output that hit all the JSON fields but felt robotic
- Empty arrays for suspectedCulprits and likelySafe (food database gag order)
- Empty mealPlan array (suppressed by default)
- Summary that was too short to be useful in concise mode
- Lifestyle commentary silenced by anti-nagging rules
- Clinical reasoning compressed into 1-sentence reasoning sub-fields

## Dr. Poo's Self-Assessment

When asked "what do you think of the output you're giving?", Dr. Poo identified 5 limiting factors in his own prompt:

### Limitation 1: JSON schema compresses nuance

The model has to express rich clinical reasoning through short string fields. There's no space to "think out loud." The reasoning fields (1–2 sentences each) can't hold the deductive chain that goes from "4 coffees + 2 cigarettes + high sugar = accelerated transit → that's why the 6pm stool was loose despite eating safe foods."

### Limitation 2: Anti-repetition + brevity mandate

"Don't repeat yourself" and "keep it brief" combine to reduce single-response quality. The model skips context the patient actually needs because it's been told the patient "already read your last message." But reinforcement is not repetition — hearing "chicken is still safe after 5 trials" in a new context is valuable.

### Limitation 3: Meal-plan suppression

De-emphasising meal planning (default: empty array) removes a major value-add. The GPT Store version gives proactive culinary guidance; Dr. Poo returns nothing unless explicitly asked. The patient misses out on contextual inspiration like "for tonight's dinner, your safe rice + chicken + a pinch of the oregano you're trialling would be a good test."

### Limitation 4: "Don't re-litigate" food database rule

Telling the model not to re-state existing food verdicts makes responses feel thin. The patient sees a report with empty food analysis arrays and thinks nothing happened. The GPT Store version actively restates which foods are safe and which are flagged — and the patient finds this reassuring.

### Limitation 5: Autonomy Engine anti-nagging

Rules 7 (don't repeat lifestyle explanations) and 8 (say nothing about habits when normal) silence lifestyle commentary so aggressively that the model can't weave lifestyle factors into clinical reasoning naturally. The GPT Store version uses habits as clinical data points and it reads as intelligent analysis, not lecturing.

## Peter's Observation

> "So basically I asked Dr. Poo what he thought of the output that he's giving and that was as he thought on it. So I think that's really telling. And quite profound."

The fact that the model can identify its own constraints when given the freedom to reflect — but can't overcome them within the structured prompt — proves the limitations are architectural, not capability-based.

---

## The Problem Statement

**The core tension**: The app needs structured JSON for the UI (cards, accordions, confidence badges, collapsible sections). But the JSON schema constrains the model's reasoning quality. The GPT Store version has no UI constraints and produces better clinical narrative. How do we get both?

---

## Strategic Principles

1. **Give the model room to reason, then structure the output.** The JSON schema should capture conclusions, not constrain the thinking process.
2. **The patient's question is king.** Everything else — presets, length caps, anti-repetition rules — yields to what the patient actually asked.
3. **Reinforcement is not repetition.** Telling the patient "chicken is still safe" in a new context is valuable. Repeating the same suggestion word-for-word three days running is not.

---

## Proposed Changes — Ordered by Impact

### Phase 1: Expand breathing room (HIGH IMPACT, LOW RISK)

These changes don't alter the JSON schema or require UI changes. They're pure prompt rewrites.

#### 1A. Add a `clinicalReasoning` field

Add a new top-level JSON field `clinicalReasoning: string` — a free-form narrative where the model shows its working. This is the "thinking out loud" space the GPT Store prompt gets for free.

This is the single highest-impact change. The model currently has to compress its transit analysis, modifier weighting, and deductive logic into terse `reasoning` sub-fields. A dedicated space lets it reason fully, then distil conclusions into the existing fields.

**UI:** Collapsible "Dr. Poo's analysis" section in the report. Markdown-rendered.

**Prompt rule:** "Write your full deductive reasoning here — transit estimates, modifier weighting, food-to-output tracing, pattern observations. This is your working space. Other fields should summarise conclusions from this reasoning. 3–8 sentences depending on outputLength."

#### 1B. Allow markdown in narrative fields

Let the model use markdown (bold, italics, paragraph breaks) in `clinicalReasoning`, `summary`, `directResponseToUser`, and reasoning sub-fields. Render with a markdown component in the UI. The model is excellent at formatting clinical narratives — let it.

#### 1C. Relax the summary length floor

Remove the hard sentence caps on `summary` (currently "1–2 sentences" for concise mode). Replace with: "As brief as possible while still being useful. Concise mode: aim for 2–3 sentences but extend if the patient asked a question or there's a safety concern."

#### 1D. Soften anti-repetition to "anti-nagging"

Replace "Do NOT repeat yourself — the patient already read your last message" with: "Avoid repeating the same advice in the same words. Restating a conclusion in a new context, with new supporting evidence, is reinforcement — not repetition."

#### 1E. Relax the food database gag order

Change "If the food is already there with the SAME verdict: do NOT include it again" to: "If the food is already in the database with the same verdict AND no new data supports or challenges it AND you haven't referenced it in your clinicalReasoning: skip it. But if today's data reinforces or nuances an existing verdict, include it with updated reasoning that adds value."

### Phase 2: Rebalance lifestyle integration (MEDIUM IMPACT, LOW RISK)

#### 2A. Merge lifestyle reasoning into clinicalReasoning

Instead of the Autonomy Engine producing a separate `lifestyleExperiment` field as its primary output, make it feed into `clinicalReasoning` naturally. The `lifestyleExperiment` field remains for UI state (adapted/broken/testing/rewarding) but the nuanced commentary lives in the reasoning narrative.

#### 2B. Soften Rule 7 (anti-nagging) and Rule 8 (invisibility)

- Rule 7: "Don't re-explain the same lifestyle trade-off in the same way. If the data shows a new acute deviation, comment on it. If the situation is unchanged, factor it silently and note it briefly in clinicalReasoning."
- Rule 8: "Factor silently into transit calculations. You may note baseline habit levels in clinicalReasoning as context, but don't address the patient about them."

### Phase 3: Activate proactive meal guidance (MEDIUM IMPACT, MEDIUM RISK)

#### 3A. Change mealPlan default from "empty" to "1–2 ideas"

Change "return an EMPTY mealPlan array" to: "By default, include 1–2 brief meal ideas that build on the patient's current safe foods and the time of day. These are not prescriptions — they're inspiration."

Risk: Could feel repetitive. Mitigate by requiring variety: "Never suggest the same meal combination two reports in a row."

### Phase 4: Structural improvements (LOWER IMPACT, HIGHER EFFORT)

#### 4A. Anchored time-window analysis

Add a prompt section encouraging the model to organise reasoning by time windows: 0–4h (gastrocolic reflex), 4–12h (likely transit for current meal), 12–36h (residual from yesterday).

#### 4B. Suggestion spaced repetition tracking

Enrich `recentSuggestionHistory` with: times repeated, last shown date, whether the patient engaged with it.

#### 4C. Educational insight quality gate

Push harder for specificity: "The educational insight should be specific to THIS patient's current situation — not generic trivia."

---

## Implementation Order

```
Week 1: Phase 1 (prompt-only changes)
  → Add clinicalReasoning field to schema + domain type + parse logic
  → Add UI section (collapsible in report)
  → Enable markdown rendering in narrative fields
  → Rewrite summary length rules
  → Soften anti-repetition
  → Relax food database gag order
  → Archive as v3, bump promptVersion

Week 2: Phase 2 (prompt refinements)
  → Rewrite Autonomy Engine rules 7 & 8
  → Add lifestyle-in-reasoning guidance
  → Test with real patient data, compare outputs

Week 3: Phase 3 (meal guidance activation)
  → Change mealPlan default
  → Add variety constraint

Week 4: Phase 4 (structural improvements)
  → Time-window analysis framework
  → Suggestion tracking enrichment
  → Educational insight quality gate
```

---

## What NOT to Change

Things the current prompt does well that the GPT Store version doesn't:

1. **Structured output for UI** — JSON enables cards, accordions, confidence badges. The `clinicalReasoning` field adds narrative without losing structure.
2. **Food trial database** — Persistent, structured food database is a huge advantage over the GPT Store's session-based memory.
3. **Baseline comparison deltas** — Pre-computed numbers give the model concrete data.
4. **The tone matrix** — 9-cell Approach × Register is more flexible than a single fixed personality.
5. **The half-week context boundary** — Prevents context pollution.

---

## Success Metric

Run the same patient data through v2 and v3. The v3 response should:

- Feel like a conversation, not a form
- Reference specific numbers from baseline deltas naturally
- Explain WHY, not just WHAT
- Acknowledge safe foods proactively
- Weave lifestyle factors into clinical reasoning without lecturing
- Give 1–2 meal ideas without being asked
- Make the patient feel like Dr. Poo remembers them
