> **Ref:** `docs/plans/archive/food-registry-audit-checklist.md`
> **Updated:** 2026-04-05
> **Version:** 1.0 (ARCHIVED)
> **History:** v1.0 (2026-04-05) — archived as reference template

# Food Registry Audit Checklist

**Purpose:** Template for a dedicated session to walk through every entry in `shared/foodRegistry.ts` and verify correctness. Work through the registry top-to-bottom (Zone 1A → 1B → 2 → 3), one entry at a time.

**File to audit:** `/Users/peterjamesblizzard/projects/PDH/shared/foodRegistry.ts`

---

## How to Use

For each entry, run through the six checks below. Mark each as:

- `OK` — correct as-is
- `NEEDS FIX` — note what to change
- `QUERY` — uncertain, flag for clinical review

At the end of the session, collect all `NEEDS FIX` and `QUERY` items into a single change list before editing.

---

## Per-Entry Checklist

### Entry: `<canonical name>`

#### 1. Canonical name

- [ ] Is the name unambiguous? (Would two different users mean the same food when they read this?)
- [ ] Is it in plain English, lowercase, no jargon?
- [ ] Does it refer to the preparation state where that matters? (e.g. "boiled fish" vs "fried fish")
- [ ] Is it distinct from every other canonical in the registry — no overlapping meaning?

**Notes:**

---

#### 2. Group / Line classification

- [ ] Is the `group` correct? (`protein` / `carbs` / `fats` / `seasoning`)
- [ ] Is the `line` correct for that group?
  - `protein` → `meat_fish` | `eggs_dairy` | `vegetable_protein`
  - `carbs` → `grains` | `vegetables` | `fruit`
  - `fats` → `oils` | `dairy_fats` | `nuts_seeds`
  - `seasoning` → `sauces_condiments` | `herbs_spices`
- [ ] Does the line assignment make sense for how the transit map groups items visually?
- [ ] Are `category` and `subcategory` consistent with the group/line? (e.g. a `meat_fish` line entry should not have subcategory `grain`)

**Notes:**

---

#### 3. Zone assignment

- [ ] Is `zone` (1, 2, or 3) clinically appropriate for post-anastomosis reintegration?
- [ ] If `zone: 1`, is the `subzone` (`1A` or `1B`) correct?
  - `1A` = clear/full liquids only (no solids at all)
  - `1B` = soft, low-residue solids (first solid foods post-surgery)
- [ ] Is this consistent with NHS low-residue / UCSF ileostomy / Leeds ileostomy guidance?
- [ ] Would a clinician object to this zone placement?

**Notes:**

---

#### 4. Examples

- [ ] Do the examples cover the realistic range of what a user might type for this food?
- [ ] Are common brand names or regional variants included where relevant?
- [ ] Are there any examples that would better match a _different_ canonical?
- [ ] Are there obvious missing variants (common spellings, plurals, prep variations)?
- [ ] Are there any examples that are too generic and would cause false matches?

**Notes:**

---

#### 5. Aliases / overlap

- [ ] Could any example in this entry reasonably match a different canonical?
- [ ] Is there a risk of collision with a nearby entry (e.g. "plain biscuit" colliding with "cream cracker")?
- [ ] If the `notes` field exists, does it adequately distinguish this entry from close neighbours?
- [ ] Does the `notes` field need to be added or updated to prevent LLM misclassification?

**Notes:**

---

#### 6. `lineOrder`

- [ ] Does `lineOrder` reflect a sensible clinical progression within this line?
  - Lower numbers = try first (gentler, safer, lower residue/risk)
  - Higher numbers = try later (more challenging, higher residue/fat/spice)
- [ ] Is the ordering consistent with other entries on the same line?
- [ ] Would a newly post-op patient encounter foods in this order naturally?

**Notes:**

---

#### 7. Digestion metadata (if present)

- [ ] Is `totalResidue` correct relative to the zone? (Zone 1 entries should generally be `very_low` or `low`)
- [ ] Is `fiberTotalApproxG` plausible for a standard serving?
- [ ] Are `gasProducing`, `osmoticEffect`, `irritantLoad`, `highFatRisk`, `lactoseRisk` consistent with the zone and clinical guidance?
- [ ] If metadata is absent, should it be added? (High-risk items especially benefit from explicit metadata)

**Notes:**

---

## Session Log

Use this section to record findings as you go.

| Entry | Check | Status | Change needed |
| ----- | ----- | ------ | ------------- |
|       |       |        |               |

---

## Change List

Collect all `NEEDS FIX` items here before editing the file.

1.
2.
3.

---

## Clinical Reference

- **Zone 1A:** Clear/strained liquids. Immediate post-op. < 0 g fibre.
- **Zone 1B:** Soft, low-residue solids. First solid foods. < 2 g fibre/serving, no skins/seeds/hulls.
- **Zone 2:** Expanded defensive diet. Peeled/well-cooked veg, more protein prep methods. Still no garlic, onion, chili, fried foods, legumes, raw salads.
- **Zone 3:** Experimental. One new food at a time, only when stable on Zone 2 baseline.

**Sources:** NHS low-residue diet leaflets · UCSF ileostomy diet · Bowel Cancer Australia · Leeds Teaching Hospitals ileostomy guide
