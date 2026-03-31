# Dr. Poo Prompt Redesign: Research-Informed, Tiered, Personal

> Date: 2026-03-30
> Status: PROPOSAL
> Context: Peter's decision that Caca Traca is a personal app (Omnigut = public version)

---

## Part 1: The Adversarial Take — What the Research Actually Says

### The Uncomfortable Truth

The research document ("Unpredictable Bowel Patterns After Ileostomy/Colostomy Reversal with Multiple Resections") says something the app's architecture has been soft-pedalling:

**Food is a modulator, not the primary driver.**

The primary drivers of Peter's bowel unpredictability are:

1. **Reduced reservoir capacity** — short rectal stump (~10-15cm) can't accommodate normal stool volumes
2. **Disordered motility** — segments contract out of sync, causing "blocked then flood"
3. **Deconditioned sphincters** — months of diversion = atrophied pelvic floor
4. **Heightened gastrocolic reflex** — eating/drinking triggers motility surges in old stool
5. **Local inflammation** — diversion colitis, possible prior sepsis, nerve remodelling
6. **Reduced absorptive surface** — less colon = less water absorption = looser stool

The research is explicit: _"no diet can completely eliminate unpredictability, especially in the early months. Some level of volatility reflects structural reality rather than choosing the wrong food."_

### What This Means for the App

The current architecture is built around a central question: **"What food caused this poo?"**

The research says the right question is: **"What combination of structural baseline + modifier stack + food + timing produced this outcome?"**

Food is maybe 20-30% of the equation at day 45 post-reversal. The other 70-80% is:

- Gastrocolic reflex strength (meal size, coffee, sugar)
- What was already in the rectum (residual from overnight, retained stool)
- Pelvic floor function (exercises, sitting position, straining habits)
- Overall motility state (sleep, walking, stimulants, stress)
- Time since surgery (adaptation is ongoing)

### The Per-BM Report Problem

Looking at the sample reports, Dr. Poo is doing something predictable but unhelpful:

**He's trying to be useful on every single BM, even when there's nothing new to say.**

The 5 reports from a single morning show:

- Same safe food list exonerated 5 times ("white bread, toast, ripe banana, egg, white rice, cream cheese")
- Same coffee observation 5 times ("500mL vs your avg 294mL")
- Same advice 5 times ("small moist binding meals", "wait 15-20 min", "gentle walk")
- Same timeline framing 5 times ("day 45 after reversal")

This isn't a prompt problem alone — it's a **trigger frequency problem**. Most BMs don't warrant a full analysis. A Bristol 4 after toast is just... your bowel doing what your bowel does. The report adds no value.

### The Gastrocolic Reflex Blind Spot

The current prompt does mention the gastrocolic reflex, but it's buried as one principle among many. The research makes clear it should be **the dominant interpretive framework** in early recovery:

> "Loose clusters are frequently reflex-driven expulsions of pre-existing stool rather than direct passage of the most recent meal. This explains why the same food can appear 'safe' on one day and associated with a loose flare on another, depending on what is already in the rectum and how stimulated the bowel is."

The implication: **most per-BM food analysis in the first 6 months is noise.** The signal is in the modifier stack and the multi-day trend.

### What Actually Helps at Day 45

Based on the research, the highest-value interventions right now are:

1. **Modifier management** — Track and manage coffee volume, meal sizes, sugar loads, walking. These have immediate, measurable effects on motility.
2. **Pelvic floor rehabilitation** — Kegel exercises, biofeedback therapy. 50-80% success rate for fecal incontinence. Is Peter doing these?
3. **Loperamide timing** — Before meals, not after loose stools. Prophylactic, not reactive.
4. **Bowel training** — Toileting after meals, footstool, unhurried sitting. Avoid forceful pushing.
5. **Time** — The bowel adapts. 6-12 months for significant improvement, up to 2 years for stabilisation.
6. **Food as stabiliser, not detective work** — Low-residue binding foods as the default, with very slow, controlled expansion. Not "what caused this Bristol 7" but "am I eating enough binding food to support the baseline?"

---

## Part 2: Mapping Dr. Poo's Dialogue to the Research

### What Dr. Poo Gets Right (and the research section that backs it)

| Dr. Poo Says                                                                  | Research Source                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| "You're in a reactive, twitchy-but-not-failing phase"                         | LARS timeline: 0-3 months = most severe, expected erratic patterns         |
| "This was almost certainly the gastrocolic reflex pushing older contents out" | Gastrocolic reflex sensitivity: loose clusters are old stool, not new food |
| "Your core stabilisers still look solid"                                      | Food modulates amplitude, doesn't determine baseline                       |
| "The blocked-then-flood pattern"                                              | Loss of reservoir capacity: small rectum can't accommodate, then overflow  |
| "Coffee is already at 500mL vs your avg 294mL"                                | Caffeine as strong reflex trigger; accelerant stacking                     |
| "No accidents despite urgency = win"                                          | Sphincter function metric; deconditioning recovery                         |
| "Walking 0 min vs avg 9.4 min"                                                | Activity supports motility regulation                                      |

### What Dr. Poo Misses (that the research emphasises)

| Research Says                                                          | Dr. Poo Doesn't Address                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Pelvic floor rehab is a "cornerstone" with 50-80% success              | Never mentioned. Not tracked. Not suggested.                                                      |
| Loperamide before meals can slow transit + increase sphincter tone     | Never mentioned as a strategic tool.                                                              |
| Transanal irrigation significantly reduces clustering and incontinence | Never mentioned.                                                                                  |
| Diversion colitis may still be causing local inflammation              | Mentions "irritated rectum" but doesn't connect to diversion colitis or suggest medical follow-up |
| "Management is inherently individualised and multimodal"               | Focuses almost entirely on food + modifiers. Missing the other modalities.                        |
| Recovery takes 6-12 months, possibly 2 years                           | Mentions "day 45" but doesn't frame expectations around the 6-12 month arc                        |
| Stress/anxiety affects gut-brain axis                                  | Not addressed in any report                                                                       |

### What Dr. Poo Over-Indexes On

1. **Individual food verdicts per-BM** — The research says single-event food attribution is unreliable due to gastrocolic reflex, modifier stacking, and structural variability.
2. **"Next food to try"** — At day 45 with active Bristol 6-7 clusters, expanding the diet is premature. Stabilise first.
3. **Lifestyle "trade-off engine"** — Sophisticated mechanism, but the research says the modifiers matter most when they DEVIATE from baseline. The current prompt gets this right in principle (Rule 1: adapted baseline) but the reports still lecture about coffee.
4. **Educational insights** — Forced to generate one every report. Becomes filler. Should be reserved for genuinely new information.

---

## Part 3: The Tiered Prompt Architecture

### The Core Insight

Not every bowel movement deserves the same analytical depth. The current system treats every BM equally: full system prompt + full user payload + full structured JSON response. This is wasteful, repetitive, and creates the noise problem.

### Proposed Tiers

#### Tier 0: Silent Log (No AI Call)

**Trigger:** Bristol 3-5 with no notable symptoms, modifiers at baseline, no new food trial in transit.

**What happens:** The BM is logged. No API call. No report. The trend tracker updates silently. A small UI indicator shows "Logged. Looking normal."

**Why:** Most BMs in a stable stretch don't need analysis. The app's job is to NOTICE when something changes, not to comment on every normal poo.

**Token cost:** 0

#### Tier 1: Brief Acknowledgment (Lightweight API Call)

**Trigger:** Bristol 6-7 (single event, not clustered), Bristol 1-2, or user requests a check.

**What happens:** Short response using a MUCH smaller system prompt. No food exoneration. No modifier recitation. Just: "Bristol 6 noted. Trend today: [direction]. [One actionable thing]."

**System prompt:** ~500 tokens (character + key principles only)
**User payload:** Last 3 BMs + today's modifiers (delta from baseline only) + any conversation-so-far summary
**Response:** ~100-200 tokens, free-form text (not JSON)

**Token cost:** ~2K total

#### Tier 2: Daily Analysis (Full API Call — Once Per Day)

**Trigger:** First BM of the day, OR user explicitly requests "Give me the full picture", OR a "bad day" pattern emerges (3+ BMs with Bristol 6-7).

**What happens:** Full analysis with the current structured JSON response. This is where food trial updates, modifier assessments, next-food suggestions, and clinical reasoning belong.

**System prompt:** Full current prompt, BUT with research-informed additions (see Part 4)
**User payload:** Full current payload
**Response:** Full structured JSON

**Token cost:** ~15-25K total (current cost)

#### Tier 3: Period Summary (Scheduled)

**Trigger:** End of day (or every 2-3 days in stable stretches). This replaces the weekly summary for higher-frequency insight.

**What happens:** Dr. Poo reviews the whole day/period. Bristol trend, modifier impact, food trial progress, recovery trajectory. This is the "debrief" — the conversation that matters.

**System prompt:** Summary-specific prompt (similar to current weekly summary)
**User payload:** All day's logs + conversation history from the period
**Response:** Narrative summary + structured data extraction

**Token cost:** ~10-15K total

### The "Conversation So Far" Summary

For Tier 1 (brief) calls after the first full analysis (Tier 2), the system needs a compressed summary of what Dr. Poo has already said today. This prevents repetition.

**How it works:**

1. After the Tier 2 (full) report, extract a "session summary" — a 200-token distillation:
   - Current Bristol trend direction
   - Key modifiers flagged (only deviations from baseline)
   - Any food on trial and its current status
   - Active advice (what was suggested)
2. For subsequent Tier 1 calls, include this summary instead of the full context.
3. Dr. Poo's Tier 1 instructions say: "You have already given a full analysis earlier today. This is a follow-up event. Only comment on what's NEW or CHANGED. Do not repeat earlier advice."

**Implementation sketch:**

```typescript
interface SessionContext {
  fullReportTimestamp: number;
  bristolTrend: string; // "improving" | "worsening" | "stable" | "mixed"
  modifierFlags: string[]; // e.g. ["coffee +70%", "walking 0 min"]
  activeFoodTrial: string | null;
  activeAdvice: string[]; // max 3 short items
  bmCountToday: number;
  lastBristol: number;
}
```

---

## Part 4: The New System Prompt (Proposed Structure)

### What Changes

1. **Hard-code Peter's context** — No more generic surgery type selector. Peter's exact surgical history, stump length, reversal date, known complications.

2. **Research-informed reasoning principles** — Bake the LARS research into the prompt as first-class reasoning rules, not background knowledge.

3. **Modifier-first, food-second** — Reverse the current analytical order. Currently: food analysis is primary, modifiers adjust. New: modifier stack is primary, food is secondary.

4. **Recovery phase awareness** — The prompt should reason differently at day 45 vs day 180 vs day 365.

5. **Drop the niceties** — No need for "your agency" language, gentle framing, or motivational coaching. Peter wants clinical utility, not encouragement.

6. **Add missing modalities** — Pelvic floor exercises, loperamide strategy, bowel training, stress tracking.

7. **Kill the forced outputs** — No mandatory educational insight. No mandatory next-food-to-try on unstable days. No mandatory meal plan section. No mini challenges during active instability.

### Proposed System Prompt Skeleton

```
You are Dr. Poo. Peter's gut analyst. Post-operative specialist.

## Peter's Surgical Reality

[Hard-coded: Multiple resections, short rectal stump (~10-15cm), low anastomosis,
ileostomy + colostomy history, diversion colitis risk, reversal date: {date},
days post-op: {computed}]

## Recovery Phase

At {days} post-reversal, Peter is in {EARLY|INTERMEDIATE|LATE} phase.
- EARLY (0-6 months): Expect erratic, unpredictable patterns. This is structural,
  not food failure. Focus on modifier management and stabilisation.
- INTERMEDIATE (6-12 months): Patterns should be stabilising. Food trials become
  more meaningful. Expand diet cautiously.
- LATE (12+ months): Residual patterns may be permanent. Optimise around the new normal.

## Analytical Order (STRICT)

1. MODIFIER STACK first: What is the combined motility pressure today?
   Coffee volume, meal sizes, sugar loads, sleep, walking, stimulants, stress.
   Compare to baseline. Calculate combined pressure.

2. STRUCTURAL CONTEXT second: Given the modifier stack + Peter's anatomy,
   is this output EXPECTED? At this phase, Bristol 6-7 after high modifier
   stacking is structural reality, not food failure.

3. GASTROCOLIC REFLEX third: Any BM within 30 minutes of eating/drinking
   is reflex-driven old stool. Do NOT attribute it to the most recent meal.
   Say this once per day, then stop.

4. FOOD ANALYSIS fourth: Only when modifiers are stable and timing supports
   actual transit, assess food. Confounded trials = flag as confounded,
   don't attribute.

5. RECOVERY TRAJECTORY fifth: Where is Peter on the 6-12 month arc?
   Is today a regression, a typical fluctuation, or genuine progress?

## What NOT to Do

- Do NOT exonerate the same safe foods repeatedly. Once is enough per day.
- Do NOT recite modifier numbers you've already stated this session.
- Do NOT give the same advice twice in the same day.
- Do NOT suggest new food trials during active instability (Bristol 6-7 in last 6h).
- Do NOT generate educational insights for the sake of it.
- Do NOT soften your language. Peter wants data, not comfort.

## Missing Modalities (ASK ABOUT THESE)

- Pelvic floor exercises: Is Peter doing them? How often? This has 50-80% success
  rate for incontinence and is a "cornerstone" of conservative management.
- Loperamide: Is Peter using it? Timing matters — before meals, not after loose stools.
- Bowel training: Toileting routine after meals, footstool, unhurried sitting.
- Transanal irrigation: Has this been discussed with his surgical team?

Only ask about these when relevant (e.g. after a bad clustering episode),
not every report.
```

### Response Format Changes

**For Tier 2 (full analysis), keep structured JSON** but simplify:

```json
{
  "summary": "string — direct, blunt, 2-3 sentences max",
  "modifierAssessment": "string — the modifier stack analysis",
  "bristolTrend": "improving | worsening | stable | mixed",
  "foodNotes": "string | null — only if food analysis is warranted",
  "actionItems": ["string — max 3, specific, actionable"],
  "foodAssessments": [...],  // only changed/new verdicts
  "nextFoodToTry": {...} | null,  // null when unstable
  "recoveryPhaseNote": "string | null — weekly, not per-BM"
}
```

**For Tier 1 (brief), use free-form text:**

Just a short paragraph. No JSON structure. Rendered directly in the chat.

---

## Part 5: The Big Question You're Not Asking

### Can Caca Traca actually help Peter tolerate more foods?

The research answer: **Yes, but not how the app currently frames it.**

The app frames food reintroduction as: "test food X, check if it caused a bad BM, build a safety database."

The research frames it as: "Start with binding foods. Stabilise the baseline. THEN gradually expand, looking for REPEATED patterns under CLEAN conditions (stable modifiers, no concurrent illness, controlled portions)."

The difference matters. The current app is trying to do signal detection in a system with enormous noise. At day 45, the noise floor is so high that single-event food attribution is unreliable. The gastrocolic reflex alone means that any meal eaten within 30 minutes of a BM is automatically a confound.

**What actually expands diet tolerance is:**

1. Time (bowel adaptation)
2. Consistent binding-food base
3. Pelvic floor strengthening (better control = less urgency = less avoidance)
4. Modifier stability (consistent coffee/sleep/walking = lower noise floor)
5. Very slow, controlled introduction of one new food at a time, tested 3+ times under clean conditions

The app CAN support all of this. But the prompt needs to LEAD with modifier management and recovery trajectory, not food detective work.

### Lifestyle factors are not a side concern — they ARE the primary intervention

The research is unambiguous:

- Walking reduces bloating and supports motility regulation
- Sleep deprivation causes dysmotility
- Coffee is the strongest immediate gastrocolic trigger
- Stress directly affects the gut-brain axis
- Pelvic floor rehab is the single most evidence-based intervention for LARS

Peter's doubts about whether food reintroduction is "possible" are partially well-founded: **if the lifestyle factors aren't managed, no amount of food testing will produce reliable results.** The signal will always be buried in modifier noise.

But the flip side: **once the modifier baseline is stable and the bowel has had 6+ months to adapt, food testing becomes much more meaningful.** The app's architecture isn't wrong — it's premature for the current phase.

### Recommendation

Restructure Dr. Poo's priorities by recovery phase:

**Phase 1 (day 0-180): Stabilise**

- Primary focus: modifier management, pelvic floor, binding food base
- Secondary focus: avoid known triggers (high fat, spice, insoluble fibre)
- Food trials: only for expanding the safe binding/neutral food list
- Dr. Poo's role: "your bowel is adapting. Here's how to support it."

**Phase 2 (day 180-365): Expand**

- Primary focus: controlled food trials under clean conditions
- Secondary focus: continuing modifier management
- Dr. Poo's role: "your baseline is stable enough to test. Let's be methodical."

**Phase 3 (day 365+): Optimise**

- Primary focus: fine-grained food sensitivity, lifestyle optimisation
- Dr. Poo's role: "you know your gut. Let's push boundaries."

---

## Part 6: Implementation Priority

1. **Immediate (prompt change only):** Add the research-informed reasoning principles to the existing system prompt. Reverse the analytical order to modifier-first. Add recovery phase awareness. Drop forced outputs on unstable days.

2. **Short-term (code change):** Implement Tier 0 (silent log for normal BMs). This alone eliminates ~50% of unnecessary API calls and all of the repetitive reports.

3. **Medium-term (architecture):** Implement the session context summary for Tier 1 calls. Build the "conversation so far" compression.

4. **Longer-term (if warranted):** Move toward the chat-first architecture from the architecture-rethink doc. The tiered approach is a natural stepping stone — Tier 1 is essentially a lightweight chat response, and Tier 2 is the current full report.
