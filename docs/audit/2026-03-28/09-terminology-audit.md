Now I have all the data needed. Here is the complete terminology audit:

---

## WQ-171 Terminology Audit

### Summary Table

| # | Term Group | Variant | Docs Count | Code Count | Recommendation |
|---|-----------|---------|------------|------------|----------------|
| 1 | **Map concept** | transit map | ~311 | ~100+ (dominant) | **CANONICAL** |
| | | Transit Map | ~53 | used in titles/labels | Acceptable for proper-noun/heading use |
| | | live network | ~12 | 2 (UI labels) | Retire from docs; keep only as a UI label if that is the user-facing name |
| | | metro map | ~6 | 1 | Retire |
| | | transit chart | ~2 | 0 | Retire |
| | | transit network | ~1 | 0 | Retire |
| 2 | **Food tracking event** | trial / food trial | ~476 | `foodTrial*` (101+) | **CANONICAL: "food trial"** |
| | | transit (digestive) | ~1404 | common but different meaning | Different concept -- "transit" = gut transit time, not a synonym |
| | | passage | ~2 | 0 | Not in use |
| 3 | **Recovery taxonomy** | Zone (Zone 1/2/3) | ~418 | `FoodZone` type (50+) | **CANONICAL: "zone"** (Zone 1, Zone 2, Zone 3) |
| | | recoveryStage | ~12 (docs) | ~180+ (schema field) | Code field name; docs should say "zone" and note `recoveryStage` is the schema field |
| | | recovery stage | ~4 | 0 | Retire from docs; field is `recoveryStage` but concept is "zone" |
| | | recovery zone | ~3 | 0 | Retire |
| | | food zone | ~3 | `FoodZone` type | Acceptable as compound; "zone" alone is preferred |
| | | food stage / food phase | ~3 | 0 | Retire |
| | | reintroduction phase/zone | ~1 | 0 | Retire |
| 4 | **Stool metric** | Bristol Stool Scale | ~19 | 3 (first-mention form) | **CANONICAL for first mention** |
| | | Bristol Scale | ~28 | 2 | Acceptable short form after first mention |
| | | Bristol classification | ~26 | 0 | Retire -- "classification" is an algorithm name, not the scale name |
| | | Bristol score | ~9 | `BristolScore` type (50+) | Code type only; docs should say "Bristol score" for the numeric value |
| | | BSS | ~4 | 0 | Retire |
| | | stool scale | overlaps with above | 0 | Only as part of "Bristol Stool Scale" |
| 5 | **AI personality** | Dr. Poo | ~292 | 52 | **CANONICAL for prose** |
| | | DrPoo | ~198 | 68 | **CANONICAL for code** (PascalCase identifier) |
| | | Dr Poo (no period) | ~33 | 1 | Retire -- always use period in prose |
| | | drPoo / drpoo | in some files | camelCase in code | Acceptable as camelCase in code only |
| 6 | **Data normalization** | canonical / canonicalName | ~488+ | 900+ (dominant) | **CANONICAL** |
| | | canonicalization | ~23 | in function names | Acceptable as process noun |
| | | normalized / normalizedName | ~50+ | ~30 (secondary field) | Acceptable for the string-normalization step; `normalizedName` is a real field |
| | | normalization | ~41 | limited | Acceptable for string-normalization process |
| 7 | **Food safety judgment** | assessment | ~181+ | 210 (dominant) | **CANONICAL for the structured output** (`foodAssessments` table) |
| | | verdict | ~56+ | 146 (Dr. Poo prompt field) | **Keep for Dr. Poo output** -- `verdict` is a prompt/AI field name |
| | | rating | ~9 | 0 in food context | Retire in food context (only used in old audit quality ratings) |
| 8 | **API key model** | BYOK | ~82 | in comments | **CANONICAL acronym** |
| | | bring your own key | ~4 | 0 | Use on first mention to define the acronym, then BYOK |
| | | user API key | ~1 | 0 | Retire |

### Canonical Term Glossary (Recommended)

| Concept | Canonical Term | First-Mention Form | Code Identifier |
|---------|---------------|-------------------|-----------------|
| The visual food map | transit map | transit map | `TransitMap`, `transit-map` |
| A food being tracked for safety | food trial | food trial | `foodTrial`, `foodTrialSummary` |
| Recovery reintroduction tier | zone | Zone 1 / Zone 2 / Zone 3 | `FoodZone`, `recoveryStage` (schema) |
| Stool classification scale | Bristol Scale | Bristol Stool Scale (first mention) | `BristolScore` |
| AI coaching personality | Dr. Poo (prose) | Dr. Poo | `DrPoo` (code) |
| Food name resolution | canonical | canonical name | `canonicalName` |
| Food safety determination | assessment (structured) / verdict (AI) | food assessment | `foodAssessments` / `verdict` (prompt) |
| Key management model | BYOK | BYOK (bring your own key) | BYOK |

### Worst Offender Files (Most Internal Inconsistency)

**Tier 1 -- Active docs with 3+ variant groups mixed:**

1. **`docs/WORK-QUEUE.md`** -- Mixes "transit map" + "transit chart" + "metro map" + "live network"; mixes "Dr. Poo" + "DrPoo" + "Dr Poo" + "drpoo" (4 variants); mixes "verdict" + "assessment"
2. **`docs/WIP.md`** -- 4 Dr. Poo variants (Dr. Poo, DrPoo, drPoo, drpoo); mixes "assessment" + "verdict"; mixes "recoveryStage" + "recovery stage"
3. **`docs/reviews/AUDIT/A5_NLM/01_holistic-overview-of contradictions.md`** -- 3 map variants (transit map, transit chart, metro map, live network); mixes Bristol terms
4. **`docs/reviews/AUDIT/A3_data/CODE_INDEX.md`** -- 3 Dr. Poo variants; mixes Bristol terms; mixes map terms

**Tier 2 -- Active docs with 2 variant groups mixed:**

5. **`docs/current-state-architecture.md`** -- Mixes "canonical" + "normalized" without distinguishing them
6. **`docs/VISION.md`** -- "Bristol Stool Scale" and "Bristol Scale" used interchangeably
7. **`docs/plans/specification.md`** -- Mixes "recovery stage" + "food zone" + "food stage"
8. **`docs/dr-poo-prompts/v2-system-prompt.md`** -- "verdict" and "assessment" used for the same concept
9. **`docs/archive/browser-testing/2026-03-09-v1-test-run.md`** -- 3 Dr. Poo variants

### Key Observations

- **"transit map" is overwhelmingly dominant** (311 occurrences vs. 12 for "live network", 6 for "metro map"). The code uses `TransitMap` exclusively. The stragglers are almost all in a single contradictions-audit file and the work queue itself.
- **"Dr. Poo" vs "DrPoo" is the worst drift** by file count. 30+ files mix variants. The split is natural (prose vs. code), but "Dr Poo" (no period) has no justification and appears in 12 files.
- **"assessment" vs "verdict"** is a genuine semantic distinction, not drift. `assessment` is the structured food-safety determination (`foodAssessments` table). `verdict` is the Dr. Poo AI output field. Docs conflate them because Dr. Poo produces verdicts that become assessments. This should be clarified, not collapsed.
- **"zone" vs "stage"** is mostly clean. Code uses `FoodZone` for the type and `recoveryStage` for the schema field. Only `docs/plans/specification.md` uses the confusing alternatives "food stage" and "food phase."
- **BYOK is clean.** 82 uses of the acronym, 4 of the expanded form. No real drift.
- **"Bristol classification"** (26 occurrences) is the sneaky one -- it sounds like a synonym for the scale but actually refers to the classification algorithm. Docs should distinguish "Bristol Stool Scale" (the medical scale) from "Bristol classification" (the app's algorithm that classifies food trial outcomes).