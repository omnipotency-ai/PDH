# Bristol Stool Scale Classification — Evidence-Based Reference

> Generated 2026-03-10. Research for PDH food safety classification algorithm.

## Bristol Scale Classifications for Post-Anastomosis Recovery

| Bristol | Classification  | Medical Basis                                                                                                                           |
| ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2     | **Constipated** | Rome III standard. Hard, difficult to pass.                                                                                             |
| 3-4-5   | **Safe**        | Rome III includes Type 5 as normal. Post-anastomosis, Type 5 is frequently the best achievable outcome.                                 |
| 6       | **Safe-loose**  | Expected in early recovery (first 3-6 months). Not pathological. Persistent beyond 6 months may indicate incomplete adaptation or LARS. |
| 7       | **Diarrhea**    | Universally flagged as concerning, especially with urgency or incontinence.                                                             |

### Key Nuance: Recovery Phase Awareness

After ileostomy reversal, the expected "normal" shifts significantly:

- **Weeks 1-4:** Frequent loose stools (Bristol 5-7) are the norm, not pathological
- **Months 1-3:** Most improvement occurs; frequency decreases, consistency firms up
- **Months 3-6:** Continued firming; patterns become more predictable
- **6 months to 2 years:** Full adaptation; some patients never return to pre-surgical baseline

Bristol 6 in early recovery is genuinely "safe-loose." Beyond 6 months post-op, persistent Bristol 6 should escalate to "watch" territory.

## Food Safety Classification Logic

### Majority-Rules Principle

A food's classification should reflect the **distribution** of outcomes, not be flipped by outliers.

Example: Banana with 20 safe trials (Bristol 3-4) and 6 loose trials (Bristol 6):

- 77% safe, 23% loose = classified as **safe**
- The 6 loose trials are noted but do not override the majority

### Proposed Thresholds (percentage-based)

| Safe %     | Loose % | Diarrhea % | Classification                        |
| ---------- | ------- | ---------- | ------------------------------------- |
| >= 70%     | any     | < 10%      | **Safe**                              |
| >= 50%     | >= 20%  | < 15%      | **Safe-loose**                        |
| < 50%      | >= 30%  | < 20%      | **Watch**                             |
| any        | any     | >= 20%     | **Watch** (AI should assess)          |
| AI verdict | —       | —          | **Avoid** (temporary, AI-driven only) |

**Important:** "Avoid" is NEVER permanent and NEVER deterministic. Only AI can recommend avoidance, and it's always temporary — the food can be retried.

### Minimum Trials

- `MIN_RESOLVED_TRIALS = 2` — defensible for consumer app
- FODMAP reintroduction protocol uses 3 consecutive days
- The Bayesian system (Beta prior + recency weighting) provides additional rigour beyond raw count
- After 2 resolved trials, food graduates from "testing" to a classified state

### Multi-Food Attribution

When multiple foods fall within the transit window for a single bowel event:

- **Good outcomes:** Shared credit, minimum 60% per food (`candidatePenalty`)
- **Bad outcomes:** Shared blame, minimum 25% per food (more conservative on blame than credit)
- This asymmetry is correct — stronger evidence required before condemning a food

## Transit Time Windows

### Normal Healthy Adults

- Small bowel transit: 4-6 hours (oro-cecal)
- Colonic transit: 30-40 hours (up to 72h normal)
- Total gut transit: Median 28 hours, range 10-73 hours

### Post-Ileostomy Reversal

- Immediately post-op: Transit can be as short as a few hours
- At 10 months post-op: Typically normalizes to ~24 hours
- The colon gradually increases water absorption efficiency over months

### App Defaults

- Default transit center: 12 hours (720 minutes)
- Default spread: 6 hours (360 minutes)
- Effective window: 6h to 18h (floor of 55 minutes)
- System learns from data via `learnTransitCalibration()` using median + IQR

### User's Observed Window

- Total: ~12 hours
- Pre-output zone: first 6 hours (food hasn't reached output zone)
- Likely affecting output: 6-18 hours after eating
- Trial gap enforcement: 12 hours between trials (reduces multi-food confounding)

## Food Normalization Rules

### What Stays Whole

Well-known foods are single items, NOT broken into ingredients:

- Guacamole (not avocado + onion + lime + tomato)
- Bechamel sauce (not flour + eggs + milk)
- Hummus, pesto, tzatziki, etc.

### What Gets Broken Down

Recipes with ingredients become saved presets:

- "Friday night pasta" = beef mince + onions + garlic + tomato sauce + herbs
- These break into ingredient-level tracking
- The recipe is saved as a preset for quick re-entry

### Preparation Variants

The same food with different preparation is a DIFFERENT food:

- Mashed carrots = pureed carrots (same thing, deduplicate)
- Boiled chicken ≠ fried chicken (different digestion impact)
- Raw carrot ≠ cooked carrot (different fibre state)

### Ambiguity Resolution

When preparation is ambiguous (e.g. "chicken + olive oil" — fried or drizzled?), the app should prompt the user to clarify. This is where AI context can help: "You mentioned chicken and olive oil — was the chicken fried in the oil or was it added as seasoning?"

## Existing Apps and Clinical Tools

### Consumer Apps

- **mySymptoms** — Most methodologically transparent. Configurable analysis window (1-72h, default 24h). Widely recommended by dietitians.
- **Bowelle** — IBS-focused. Bristol + food diary. Pattern detection.
- **Auggi** — Image recognition for stool classification against Bristol.

### Clinical Scoring

- **LARS Score** (Low Anterior Resection Syndrome): 0-42 scale. 0-20 = no LARS, 21-29 = minor, 30-42 = major.
- **Output Consistency Scale (OCS):** Developed for ostomy patients. More relevant than Bristol for active ostomy.

### Key Finding

**No existing app defines formal classification thresholds for food safety scoring in GI recovery.** PDH's Bayesian evidence system with transit calibration, modifier adjustments, and multi-food penalty is more sophisticated than any commercially available tool.

## Sources

- Bristol Stool Form Scale Reliability — PMC (PMC4760857)
- Clinical Management of Bowel Dysfunction After Low Anterior Resection — PMC (PMC5866128)
- LARS Score Development and Validation — PubMed (22504191)
- Management of LARS Following Resection for Rectal Cancer — PMC (PMC9913853)
- Output Consistency Scale for Ostomate Output — PMC (PMC9744382)
- Monash FODMAP Reintroduction Protocol — monashfodmap.com
- FODMAP Reintroduction Challenge Plan — dietvsdisease.org
- AAAAI Oral Food Challenge Update
- Oral Food Challenge — PMC (PMC6843825)
- Methods for Assessment of Small Bowel and Colonic Transit — PMC (PMC3270312)
- Colonic Transit Studies Normal Values — NASPGHAN
- Risk Factors of Delayed Recovery After Ileostomy Reversal — PMC (PMC8254522)
- Ileostomy Diarrhea Pathophysiology and Management — PMC (PMC7155987)
- Metagenomic Estimation of Dietary Intake from Stool — PMC (PMC10871216)
- Food Components and Constipation — BMC Gastroenterology (2024)
- Rome III Diagnostic Criteria for Functional Gastrointestinal Disorders
- North Bristol NHS Trust — Reversal of Stoma
- Cleveland Clinic — Ostomy Reversal
- SecuriCare — Reintroduction of Food After Stoma Surgery
