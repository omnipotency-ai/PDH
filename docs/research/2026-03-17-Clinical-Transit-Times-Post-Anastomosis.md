# Clinical Transit Times: Post-Anastomosis Recovery

> **Research date:** 2026-03-17
> **Verified accurate as of:** 2026-03-17
> **Method:** Multi-query web research triangulating clinical studies, reviews, and reference databases.
> **Context:** Research conducted for Caca Traca (anastomosis food reintegration tracker) Sprint 2.5, Wave 1.
> **Confidence note:** Post-surgical transit data is sparse — most studies measure early recovery (days 1-3) rather than the weeks-to-months trajectory. Ranges below reflect best available evidence; where data is thin, this is stated explicitly.

---

## 1. Post-Anastomosis Transit Times

### 1A. Ileocolic Anastomosis (ileum reconnected to colon — right hemicolectomy)

This is the more functionally disruptive surgery because it removes the ileocecal valve, which normally acts as a one-way gate between the small and large intestine.

**Immediate post-operative (days 1-3):**

- First flatus: ~44 hours after right colon resection (vs 16h for small bowel, 17h for left colon)
- First stool: ~70 hours after right colon resection (vs 36h for small bowel, 46h for left colon)
- Solid food tolerance: ~16 hours post-op
- Right colectomy has the slowest initial recovery of all bowel resection types
- Source: PMC11996960 (2025), fast-track recovery protocol study

**Weeks 1-4 (early recovery):**

- Postoperative ileus (impaired motility) is universal in the first days; resolves over 1-2 weeks
- At 3 weeks post-op: colonic transit time is reduced by about one-third compared to pre-op, with only slight reduction in small bowel transit time
- Loose stools and increased frequency are common — approximately 1 in 5 patients develop chronic loose stools or nocturnal defecation after right-sided colectomy
- Opioid pain medication dramatically extends transit (see Section 6)
- Source: PMC5628992 (wireless motility capsule pre/post study, n=13)

**Months 1-6 (adaptation):**

- By 6 months: small bowel transit time normalizes; colonic transit time remains somewhat reduced (less colon = less transit time, permanently)
- The remaining intestine undergoes structural adaptation (villous hypertrophy, increased absorptive capacity) over 1-2 years
- Diarrhea mostly improves as the small bowel increases its water absorption capacity
- 3-4 months is the typical timeline for bowel habits to "settle"
- Source: PMC5628992, PMC9645552

**Steady state (6+ months):**

- No significant differences found between pre-operative and 6-month post-operative wireless motility capsule examinations for ileocolic junction transit patterns
- However, the ileocecal valve is permanently gone — its rhythm-regulatory, immune-monitoring, and microbiota-stabilizing functions are lost
- 32% of patients with ileocecal junction resection develop small intestinal bacterial overgrowth, associated with ongoing diarrhea
- Some patients never fully normalize: "very severe, consistent bowel symptoms that sometimes do not get better even with medication"
- Long-term quality of life scores eventually match general population (median 16 months post-op)
- Source: PMC5628992, PMC7447648, ScienceDirect (Does Long-Term Bowel Function Change After Colectomy)

**Key functional impact:** Loss of the ileocecal valve means:

- Faster transit through the remaining colon (less colon + no valve = reduced resistance)
- Higher risk of bile acid malabsorption (ileal resection disrupts bile salt reabsorption)
- Higher risk of bacterial reflux from colon into small intestine
- More than 25% of patients experience chronic diarrhea

### 1B. Colonic Anastomosis (colon reconnected to colon — left hemicolectomy, sigmoid colectomy)

This surgery preserves the ileocecal valve and the right colon (primary water absorption site), making it less functionally disruptive.

**Immediate post-operative (days 1-3):**

- First flatus: ~17 hours after left colon resection (much faster than right-sided)
- First stool: ~46 hours
- Solid food tolerance: ~14 hours
- Left colectomy recovers gut function faster than right colectomy
- Source: PMC11996960

**Weeks 1-4 (early recovery):**

- Bowel function usually returns within 3 days
- Postoperative ileus still occurs but is shorter-duration than right-sided surgery
- Constipation is actually the more common complaint (opposite of right hemicolectomy)
- Sigmoid resection patients experience constipation 1.5x more often than general population
- Source: PMC7940204, PMC9645552

**Months 1-6 (adaptation):**

- Recovery typically faster than ileocolic — 3-4 months for most patients
- Decreased activity of the descending colon and prolonged transit time attributed to autonomic denervation
- Constipation tendency persists in some patients
- Source: PMC9645552

**Steady state (6+ months):**

- Generally better long-term bowel function than right hemicolectomy
- Colonic anastomoses acquire only ~75% of normal tissue strength at 4 months (slower structural healing than small bowel)
- Some patients report up to 1 year before bowels fully regulate
- Source: PMC9355065

### 1C. Summary: Ileocolic vs Colonic Anastomosis

| Dimension                  | Ileocolic (right)           | Colonic (left/sigmoid)            |
| -------------------------- | --------------------------- | --------------------------------- |
| Initial recovery speed     | Slower (70h to first stool) | Faster (46h to first stool)       |
| Primary complaint          | Diarrhea / loose stools     | Constipation / difficult emptying |
| Transit time change        | Reduced (faster)            | May be prolonged (slower)         |
| Time to stabilize          | 3-6+ months                 | 3-4 months                        |
| Long-term dysfunction rate | ~20-25% chronic             | Lower, but constipation persists  |

---

## 2. Transit Time Floors and Ceilings

### 2A. The "6-Hour Floor" Question

**Is 6 hours the fastest food can transit from mouth to bowel movement?**

The answer is nuanced:

- **Stomach emptying:** 2-5 hours for solids, 10-40 minutes for liquids
- **Small intestine transit:** 2-6 hours (median 4.6h, range 2-7.5h in healthy adults)
- **Minimum stomach + small intestine:** ~4 hours (2h stomach + 2h small intestine) under fastest conditions
- **Colon transit:** 10-59 hours normally

**Absolute physiological minimum (whole gut):** Clinical literature defines rapid transit as whole gut transit time < 10 hours. This means the fastest a fully formed stool can emerge is roughly 10 hours, requiring rapid gastric emptying, fast small bowel transit, AND fast colonic transit simultaneously.

**However, in diarrheal states:** Liquid stool can appear much faster. In patients with autonomic neuropathy, 25% of an ingested marker was recovered in stool within 45 minutes. But this is pathological rapid transit, not food being digested and absorbed normally.

**The gastrocolic reflex explains the "1-hour misconception":** When you eat, the gastrocolic reflex triggers bowel contractions within 15-90 minutes. This moves ALREADY-DIGESTED food (from previous meals) toward the exit. The bowel movement you have 30 minutes after eating is not the food you just ate — it is food from 12-72 hours ago being pushed along to make room. This is the single most common misconception about digestive timing.

**Recommendation for the app:**

- **Minimum floor:** 6 hours is a reasonable and defensible floor for the app. It is physiologically possible for liquid to traverse faster in extreme cases, but for food being meaningfully digested, 6 hours is at the very bottom of what is clinically plausible.
- **Practical minimum for post-surgical patients:** 8-10 hours is more realistic, since even with shortened colon, the remaining intestine needs time.
- **Display note:** When users log a BM within 1-5 hours of eating, the app should explain the gastrocolic reflex: "This bowel movement likely contains food from previous meals, not what you just ate."

### 2B. Maximum Transit Time

- **Normal maximum:** 72 hours (commonly cited upper limit)
- **Extended normal in women:** Up to 100 hours
- **Clinical "delayed" threshold:** > 73 hours whole gut transit time
- **Post-surgical patients on opioids:** Can exceed 96+ hours easily
- **Extreme constipation:** Days to weeks in severe cases

**Recommendation for the app:**

- **Maximum ceiling:** 96 hours (4 days) as the outer tracking window
- **"Likely expired" indicator:** After 72 hours, mark food-to-BM correlation as low-confidence
- **Hard cutoff:** After 96 hours, do not attempt to correlate a food with a BM

---

## 3. Transit Time by Food Type

### 3A. Gastric Emptying by Food Type (time to leave stomach)

| Food type                          | Gastric emptying time |
| ---------------------------------- | --------------------- |
| Water                              | 10-20 minutes         |
| Clear liquids (juice, tea)         | 20-40 minutes         |
| Complex liquids (smoothies, broth) | 40-60 minutes         |
| Simple carbs (rice, pasta, bread)  | 30-60 minutes         |
| Mixed meals                        | 2-4 hours             |
| High-fat/high-protein meals        | 4-5+ hours            |

Source: Cleveland Clinic, Healthline, BodySpec

### 3B. Effect on Total Transit Time

**Liquids vs solids:** Liquids leave the stomach far faster (minutes vs hours), but once past the stomach, the speed difference narrows. Total transit is still dominated by colon time (10-59 hours). Net effect: liquids arrive at the colon earlier but colon transit is similar.

**Fat:** Slows gastric emptying significantly. Triggers the "ileal brake" — a feedback mechanism that slows transit to optimize fat absorption. High-fat meals can add 2-4 hours to stomach + small intestine transit.

**Protein:** Moderate slowing of gastric emptying. Less ileal brake effect than fat.

**Simple carbohydrates:** Fastest gastric emptying of solid foods. Minimal ileal brake.

**Fiber:**

- Insoluble fiber (bran, vegetable skins): Speeds colonic transit — acts as mechanical bulk
- Soluble fiber (oats, beans): Forms gel, slows gastric emptying but normalizes overall transit
- High-fiber diets reduce total transit time by 10-30% on average
- Source: PMC5872693, Lancet (1973 fiber/transit study)

### 3C. Post-Surgical Differences

In post-surgical patients, these effects are amplified:

- Fat may cause more pronounced diarrhea (especially after ileocecal resection due to bile acid malabsorption)
- Fiber tolerance is reduced in early recovery — high fiber can worsen symptoms in weeks 1-4
- Liquids are tolerated earliest (clear liquids first, then complex liquids, then soft solids)
- The food reintroduction sequence (clear liquids → full liquids → soft foods → regular diet) exists because transit handling improves as healing progresses

**Recommendation for the app:**
Use food-category-based transit window adjustments:

| Food category               | Transit window adjustment               |
| --------------------------- | --------------------------------------- |
| Clear liquids               | Start window 2h earlier than default    |
| Complex liquids             | Start window 1h earlier                 |
| Simple carbs / low-fiber    | Default window                          |
| Mixed meals                 | Default window                          |
| High-protein                | Extend window start by 1h               |
| High-fat                    | Extend window start by 2h               |
| High-fiber (once tolerated) | Narrow window slightly (faster transit) |

---

## 4. Bristol Stool Scale and Transit Speed Correlation

### 4A. The Core Correlation

The original 1997 study (Heaton & Lewis, _Scandinavian Journal of Gastroenterology_) established that stool form correlates with transit speed better than stool frequency or output:

- **r = -0.54** (baseline transit vs stool form, P < 0.001)
- **r = -0.65** (when transit is experimentally altered, P < 0.001)

The negative correlation means: higher Bristol score = faster transit.

| Bristol Type | Description         | Transit speed        | Approx. colonic transit |
| ------------ | ------------------- | -------------------- | ----------------------- |
| Type 1       | Hard lumps          | Very slow            | >72 hours               |
| Type 2       | Lumpy sausage       | Slow                 | 48-72 hours             |
| Type 3       | Sausage with cracks | Normal (slower end)  | 24-48 hours             |
| Type 4       | Smooth sausage      | Normal (ideal)       | 18-30 hours             |
| Type 5       | Soft blobs          | Slightly fast        | 12-18 hours             |
| Type 6       | Mushy, fluffy       | Fast                 | 8-14 hours              |
| Type 7       | Liquid              | Very fast / diarrhea | <8 hours                |

Source: Heaton & Lewis 1997 (PubMed 9299672), Wikipedia (Bristol stool scale), MDCalc

### 4B. Limitations

- The correlation is moderate, not strong (r = -0.54 is useful but imperfect)
- Types 1 and 2 have limited predictive validity (challenged in literature)
- In IBS patients, the correlation breaks down — stool form does not reliably predict transit
- In healthy adults with no complaints, no correlation was found between form and transit
- Post-surgical patients likely fall somewhere between healthy and IBS populations — the correlation is useful but should not be treated as definitive

### 4C. Ideal Bristol Score During Recovery

- **General ideal:** Types 3 and 4 (consensus across all clinical sources)
- **Rome III "normal" range:** Types 3, 4, and 5
- **Post-surgical reality:** Many post-ileocolic patients run at Types 5-6 (loose) for months; many post-left-colectomy patients run at Types 1-3 (firm/hard)
- **No post-surgical-specific ideal was found in the literature** — clinicians use the general 3-4 target

**Recommendation for the app:**

- Target range: Bristol 3-4 (display as "ideal")
- Acceptable range: Bristol 2-5 (display as "within range" or equivalent)
- Concern thresholds: Bristol 1 (severe constipation) or Bristol 6-7 (diarrhea) should prompt attention
- During early recovery (weeks 1-8), widen the acceptable range — Bristol 5-6 is expected after right hemicolectomy and should not trigger alarm
- Use Bristol score as a transit speed signal but with explicit uncertainty: "Bristol 5-6 suggests faster transit, but this is an estimate, not a measurement"

### 4D. Surgery-Type-Aware Bristol Ranges

| Bristol | Ileocolic patient (early recovery) | Colonic patient (early recovery) | Either (steady state 6mo+) |
| ------- | ---------------------------------- | -------------------------------- | -------------------------- |
| 1       | Concern (unusual)                  | Expected range                   | Concern                    |
| 2       | Unusual                            | Expected range                   | Normal-ish                 |
| 3-4     | Ideal (great progress)             | Ideal (great progress)           | Ideal                      |
| 5       | Expected range                     | Unusual                          | Normal-ish                 |
| 6       | Expected range                     | Concern (unusual)                | Concern                    |
| 7       | Concern (even for ileo)            | Concern                          | Concern                    |

---

## 5. Healthy Adult Transit Times (Contextual Reference)

### 5A. Averages

| Segment               | Normal range    | Median        |
| --------------------- | --------------- | ------------- |
| Gastric emptying      | 2-5 hours       | ~3.5 hours    |
| Small bowel transit   | 2-6 hours       | ~4.6 hours    |
| Colonic transit       | 10-59 hours     | ~30-40 hours  |
| **Whole gut transit** | **10-73 hours** | **~28 hours** |

Source: PMC4015195, PMC1383315, Colorado State (vivo.colostate.edu)

### 5B. Gender Differences

- **Males:** Mean colonic transit time 22.3 +/- 16.1 hours; upper normal limit 54.5 hours
- **Females:** Mean colonic transit time 30.1 +/- 21.4 hours; upper normal limit 72.9 hours; may reach 100 hours
- Colonic transit is significantly faster in men; postlag gastric emptying is also more rapid
- The difference is attributed to hormonal influences (progesterone slows motility)
- Source: PMC1383315, PubMed 1588218

### 5C. Smokers / Nicotine Users

The effects of smoking on transit are paradoxical and region-dependent:

- **Colonic transit:** Nicotine significantly decreases colonic transit time (speeds it up), primarily in the rectosigmoid region. Both 17.5mg and 35mg transdermal nicotine patches showed this effect.
- **Small intestinal transit:** Smoking and nicotine delay mouth-to-cecum transit time (slows it down)
- **Gastric emptying:** Mixed — high-nicotine cigarettes delay gastric emptying, but acute smoking may speed it in habitual smokers
- **Net effect for the app's user:** Smokers likely have faster colonic transit but potentially slower small bowel transit. The net whole-gut effect is modest and variable.
- Source: PubMed 9659670, Springer (Digestive Diseases and Sciences)

### 5D. Athletes / High Activity

- Moderate exercise reduces colonic transit time and improves motility
- Trained endurance runners have faster baseline gastric emptying (67.7 min vs 85.3 min half-time)
- Exercise bouts < 60 minutes at low-to-moderate intensity promote GI motility
- Prolonged exercise (> 90 min) may paradoxically inhibit transit
- High-intensity/long-duration exercise (> 2h at 60% VO2max) can cause GI distress and dysfunction
- A 12-week aerobic exercise program significantly shortened colonic transit time
- Source: Nature (Scientific Reports, 2025), APS Journal of Applied Physiology

### 5E. Overweight / Obese

- **Gastric emptying:** Accelerated in obesity (faster, not slower — counterintuitive)
- **Small intestinal transit:** Increased proximal gut transit; may contribute to poor satiety signaling
- **Colonic transit:** Some evidence for delayed colonic transit; constipation is more frequent in obese individuals
- **Net effect:** Faster upper GI, potentially slower lower GI — but high individual variability
- Source: PMC3890396, PMC7200119

### 5F. The "1-Hour Misconception"

Many people believe food can exit the body within 1 hour of eating. This is physiologically impossible for actual digestion:

- The **minimum** time for food to traverse stomach + small intestine + colon is ~10 hours (under extreme rapid-transit conditions)
- The bowel movement experienced 15-90 minutes after eating is caused by the **gastrocolic reflex** — the stomach signaling the colon to make room, pushing out food from 12-72 hours earlier
- The gastrocolic reflex is triggered by fatty foods, large meals, caffeine, and spicy foods
- This reflex is often heightened in post-surgical patients and IBS patients
- Source: Cleveland Clinic, StatPearls (NBK549888)

---

## 6. Factors Affecting Transit Time

### 6A. Hydration

- 50% water restriction doubles gastrointestinal transit time
- Dehydration weakens peristalsis (intestinal contractions) and increases water absorption from stool, hardening it
- Inadequate water intake induces constipation even without clinical dehydration
- **However:** Increasing water intake above normal levels in already-hydrated individuals shows limited additional benefit
- High-fiber diet + 2L mineral water daily significantly increased bowel frequency and reduced laxative use
- **For the app:** Hydration status is a meaningful factor. Under-hydration slows transit; optimal hydration maintains baseline but does not accelerate beyond it.
- Source: WebMD, PMC (multiple hydration studies), Monash FODMAP

### 6B. Physical Activity

- Light-to-moderate exercise reduces colonic transit time
- Acute exercise increases all indices of gut motility within 1-2 minutes post-exercise
- Mechanisms: autonomic nervous system changes, biomechanical oscillations, reduced inflammation
- Sedentary behavior is associated with slower transit and higher constipation risk
- 12-week exercise programs measurably shorten transit time
- **For the app:** Physical activity is a meaningful positive factor for transit speed. Post-surgical patients are encouraged to walk early (standard of care).
- Source: Nature (2025), PMC4130869, Journal of Nutrition (2023)

### 6C. Stress and Anxiety

- Stress decreases small intestinal transit (slows it) and can cause bacterial overgrowth
- Cortisol disrupts brain-gut communication, altering motility and visceral sensitivity
- Effects include: altered motility, increased visceral perception, changed secretion, increased intestinal permeability
- In IBS patients, stress responses are exaggerated and normalization is delayed
- Post-surgical patients are often under significant psychological stress — this compounds motility issues
- **For the app:** Stress is a meaningful factor that typically slows upper GI transit but can trigger urgent colonic contractions (the "nervous stomach" effect). The net effect is unpredictable per individual.
- Source: Gastroenterology (2004), PMC4202343, UNC IBS Center

### 6D. Post-Surgical Medications

**Opioids (major impact):**

- 40-95% of patients on opioids experience constipation
- Opioids slow motility, increase water absorption from stool, and increase anal sphincter tone
- Effect is immediate and dose-dependent
- Can extend transit time by days
- Mu-opioid receptors are distributed throughout the GI tract
- Bowel function may not normalize until opioids are discontinued
- **For the app:** Opioid use is the single largest non-surgical factor affecting transit time. If the user is on opioids, all transit expectations should be dramatically extended.
- Source: StatPearls (NBK493184), PMC5914368

**Loperamide (Imodium):**

- Commonly prescribed post-colectomy (especially right-sided) — up to 8 tablets/day
- Reduces intestinal peristalsis and promotes water absorption
- Prolongs whole-gut transit time (primarily colonic effect)
- Does not affect mouth-to-cecum transit
- Postoperative diarrhea occurs in ~24% after subtotal colectomy
- **For the app:** Loperamide use should be tracked as it directly slows transit. If the user is taking it, transit windows should be extended.
- Source: StatPearls (NBK557885), Gastroenterology (1984)

**Other common post-surgical medications:**

- **Methylnaltrexone:** Opioid antagonist that accelerates oral-cecal transit without reversing analgesia
- **Lubiprostone:** Accelerates small intestinal and colonic transit; reduces time to first BM by 50% in opioid-induced constipation
- **Stool softeners (docusate):** Minimal effect on transit time; primarily affect stool consistency

### 6E. Smoking / Nicotine

(See Section 5C above)

- Net effect: faster colonic transit (rectosigmoid), slower small bowel transit
- Post-surgical relevance: if the user smokes, they may have somewhat faster colonic transit, but this effect is modest compared to the surgical and medication factors

---

## 7. Practical Recommendations for App Default Values

Based on all the above research, here are the recommended defaults for Caca Traca:

### 7A. Transit Time Window Defaults

| Parameter                                    | Value     | Rationale                                                                        |
| -------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| **Minimum floor**                            | 6 hours   | Below this is physiologically implausible for actual food transit                |
| **Gastrocolic reflex explanation threshold** | 0-5 hours | BMs in this window are from previous meals; show educational tooltip             |
| **Default window start (post-surgical)**     | 8 hours   | Conservative — most post-surgical patients are slower than healthy               |
| **Default window center**                    | 24 hours  | Median transit is roughly 24h for healthy adults; reasonable starting assumption |
| **Default window end**                       | 72 hours  | Standard clinical upper limit of normal                                          |
| **Maximum tracking ceiling**                 | 96 hours  | Beyond this, correlation is unreliable                                           |
| **"Low confidence" threshold**               | >72 hours | Mark as uncertain                                                                |

### 7B. Recovery Phase Adjustments

| Phase                        | Window adjustment                          | Rationale                                                 |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Weeks 1-2 (acute recovery)   | Extend all windows by 50% (opioids, ileus) | Everything is slower during acute recovery                |
| Weeks 3-8 (early adaptation) | Default windows                            | Active adaptation period                                  |
| Months 2-6 (mid adaptation)  | Default windows, begin narrowing           | Gut is adapting; transit stabilizing                      |
| 6+ months (steady state)     | Use learned calibration data               | Individual data is more reliable than population defaults |

### 7C. Surgery Type Adjustments

| Surgery type                    | Adjustment                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Ileocolic (right hemicolectomy) | Shift window earlier (faster transit expected), widen acceptable Bristol to 5-6 |
| Colonic (left/sigmoid)          | Shift window later (slower transit expected), expect Bristol 2-3 more often     |

### 7D. Bristol Score Mapping for Transit Estimation

| Bristol | Transit speed label  | Estimated colonic transit |
| ------- | -------------------- | ------------------------- |
| 1       | Very slow            | >72h                      |
| 2       | Slow                 | 48-72h                    |
| 3       | Normal (slower end)  | 24-48h                    |
| 4       | Normal (ideal)       | 18-30h                    |
| 5       | Slightly fast        | 12-18h                    |
| 6       | Fast                 | 8-14h                     |
| 7       | Very fast / diarrhea | <8h                       |

**Important caveat:** These are estimates with moderate correlation (r = -0.54). The app should display them as estimates, not facts. Label: "Based on stool consistency, transit was likely [fast/normal/slow]."

### 7E. Trigger vs Transit Correlation Model

For diarrhea events, there are TWO types of food correlation:

| Correlation type | Window     | Question it answers              | Bristol relevance  |
| ---------------- | ---------- | -------------------------------- | ------------------ |
| **Trigger**      | 0-3 hours  | "What food caused this episode?" | Bristol 6-7 only   |
| **Transit**      | 6-96 hours | "What food is in this stool?"    | All Bristol scores |

- Bristol 7: trigger correlation is primary (food triggered gastrocolic evacuation)
- Bristol 6: both trigger and transit are relevant
- Bristol 3-5: transit correlation only
- Bristol 1-2: transit + cumulative diet pattern

### 7F. Key Data Gaps and Uncertainties

1. **Weeks 1-6 post-op transit data is extremely sparse.** Most surgical studies measure time-to-first-flatus/stool but not ongoing transit time during recovery. The 3-week and 6-month wireless motility capsule study (PMC5628992, n=13) is the best available but is a tiny sample.

2. **No post-surgical Bristol targets exist.** The "3-4 is ideal" target comes from general population data. Clinicians likely adjust expectations per patient, but this is not codified in published literature.

3. **Food-type transit differences in post-surgical patients are not well-studied.** The food category adjustments above are extrapolated from healthy adult data. Post-surgical gut may respond differently (e.g., fat may cause more dramatic effects due to bile acid malabsorption).

4. **Individual variation is enormous.** Even in healthy adults, transit time varies 10-73 hours. Post-surgical variation is likely wider. The app's learned calibration (from individual user data) will be more valuable than any population default after ~2 weeks of consistent logging.

5. **The 6-hour floor is conservative-safe.** True minimum in diarrheal states can be faster, but for the purpose of food-to-BM correlation in a recovery app, 6 hours prevents false correlations while capturing genuine rapid transit.

---

## Sources

- [GI Recovery After Bowel Resection (PMC11996960)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11996960/) — Fast-track protocol recovery times
- [Wireless Motility Capsule: Ileocolic Anastomosis Pre/Post (PMC5628992)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5628992/) — Key study: transit changes at 3 weeks and 6 months
- [Anastomotic Healing (PMC9355065)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9355065/) — Tissue strength recovery timeline
- [Right Hemicolectomy Bowel Function Systematic Review (PMC7447648)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7447648/) — Long-term dysfunction rates
- [Long-term Bowel Dysfunction After Colectomy (PMC9645552)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9645552/) — Quality of life data
- [Variable Gut Recovery: Right vs Left (PMC7940204)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7940204/) — Rectosigmoid hyperactivity
- [Ileocecal Valve Removal Effects (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0022480420302626) — Valve removal reverses loperamide effects
- [Stool Form and Transit Time (PubMed 9299672)](https://pubmed.ncbi.nlm.nih.gov/9299672/) — Original Bristol/transit correlation study (Heaton & Lewis 1997)
- [Bristol Scale and Colonic Transit Prediction (PMC5628989)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5628989/) — Sensitivity/specificity data
- [Regional Transit Times (PMC4015195)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4015195/) — Wireless motility capsule reference values
- [Transit Time Variability by Gender (PMC1383315)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1383315/) — Male vs female transit
- [GI Transit Overview (Colorado State)](https://vivo.colostate.edu/hbooks/pathphys/digestion/basics/transit.html) — Segment-by-segment reference
- [Gastrocolic Reflex (StatPearls NBK549888)](https://www.ncbi.nlm.nih.gov/books/NBK549888/) — Physiology
- [Gastrocolic Reflex (Cleveland Clinic)](https://my.clevelandclinic.org/health/body/gastrocolic-reflex) — Patient-facing explanation
- [Nicotine and Colonic Transit (PubMed 9659670)](https://pubmed.ncbi.nlm.nih.gov/9659670/) — Transdermal nicotine study
- [Smoking and GI Motility (PubMed 8536520)](https://pubmed.ncbi.nlm.nih.gov/8536520/) — Interdigestive motility
- [Opioid-Induced Constipation (StatPearls NBK493184)](https://www.ncbi.nlm.nih.gov/books/NBK493184/) — Mechanism and prevalence
- [Opioid Bowel Dysfunction Guideline (PMC5914368)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5914368/) — Clinical management
- [Loperamide (StatPearls NBK557885)](https://www.ncbi.nlm.nih.gov/books/NBK557885/) — Mechanism of action
- [Fiber and Transit (PMC5872693)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5872693/) — Fiber modulation of transit
- [Exercise and Gut Motility (Nature, 2025)](https://www.nature.com/articles/s41598-025-18860-8) — Acute exercise effects
- [Exercise and Transit in Normal/Overweight/Obese (Journal of Nutrition)](<https://jn.nutrition.org/article/S0022-3166(23)72411-5/fulltext>) — Activity level associations
- [Obesity and GI Motility (PMC3890396)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3890396/) — High-fat diet effects
- [Stress and Gut (Gastroenterology 2004)](<https://www.gastrojournal.org/article/S0016-5085(04)01559-8/pdf>) — Acute stress study
- [Hydration and Constipation (WebMD)](https://www.webmd.com/digestive-disorders/water-a-fluid-way-to-manage-constipation) — Fluid intake evidence
- [Intestinal Anastomosis Healing (Healthline)](https://www.healthline.com/health/healing-time-of-intestinal-anastomosis) — Recovery timeline
- [Bowel Transit Time (Mount Sinai)](https://www.mountsinai.org/health-library/tests/bowel-transit-time) — Reference ranges
- [Digestion Timeline (Cleveland Clinic)](https://health.clevelandclinic.org/how-long-does-it-take-to-digest-food) — Food type gastric emptying
