Excellent! Now I have a comprehensive understanding. Let me create a final summary document with all findings:

## Summary: Hardcoded Medical/Surgery/Condition Strings Research

### Executive Summary

I've identified **11 major locations** where hardcoded surgery/medical/condition strings appear in the codebase. These are currently tightly coupled to the domain logic and prompts. Key findings:

1. **Surgery type strings are duplicated** across 3 separate type systems with different naming conventions
2. **AI coaching prompts hardcode "post-surgery anastomosis recovery patient"** in 3 locations (habitCoaching, aiAnalysis, etc.)
3. **Stimulant/drug keywords are hardcoded** in 2 files with overlapping/inconsistent aliases
4. **The profile/schema already has the fields** to support parameterization but they're not being leveraged consistently

---

### Detailed Findings

#### 1. **Surgery Type Duplication (WQ-136 partially)**

**Type System Inconsistency:** Two different `SurgeryType` types exist:

**In `/convex/validators.ts` (line 516-523) and `/src/types/domain.ts` (line 40-46):**
```
- "Colectomy with ileostomy"
- "Colectomy with colostomy"
- "Colectomy with primary anastomosis"
- "Ileostomy reversal"
- "Colostomy reversal"
- "Other"
```

**In `/shared/foodEvidence.ts` (line 308):**
```
- "ileocolic"      (should map to: Ileostomy reversal / Colectomy with primary anastomosis)
- "colonic"        (should map to: Colostomy reversal)
- "other"
- undefined
```

**Files referencing surgery types:**
- `/src/types/domain.ts:40-46` — Type definition
- `/convex/validators.ts:516-523` — Validator definition (duplicates domain types)
- `/src/components/settings/health/SurgerySection.tsx:14-18` — UI dropdown (hardcoded strings)
- `/src/components/landing/WaitlistForm.tsx:12-13` — Waitlist form (hardcoded strings)
- `/src/lib/aiAnalysis.ts:329` — Uses `surgeryType === "Ileostomy reversal"` (hardcoded comparison)
- `/shared/foodEvidence.ts:327-328` — SURGERY_TYPE_CENTER_MINUTES map (uses "ileocolic"/"colonic", not domain types)
- `/src/lib/foodStatusThresholds.ts:355` — Uses `surgeryType === "ileocolic"` (hardcoded)

**Current state:** The `healthProfile.surgeryType` is a domain-level enum, but the clinical logic in `foodEvidence.ts` and `foodStatusThresholds.ts` uses a DIFFERENT enum ("ileocolic", "colonic"). There's no explicit mapping layer between them.

---

#### 2. **Hardcoded "post-surgery anastomosis recovery patient" Coaching Prompts (WQ-136 main)**

**Location 1: `/src/lib/habitCoaching.ts` (line 65)**
```typescript
"with one piece of practical advice, encouragement, or contextual reward",
"for a post-surgery anastomosis recovery patient.",
```

**Location 2: `/src/lib/habitCoaching.ts` (line 259)**
```typescript
"in 100 characters or fewer for a post-surgery anastomosis recovery patient.",
```

**Location 3: `/src/lib/aiAnalysis.ts` (line 1314)**
```typescript
return `You are Dr. Poo, a clinical nutritionist specialising in post-operative colon reconnection recovery — specifically ileostomy and colostomy reversal patients. You have deep expertise in gut motility, the enteric nervous system, dietary reintroduction after anastomosis, and the gut-brain axis.
```

**Location 4: `/src/lib/aiAnalysis.ts` (line 1351)**
```typescript
"Your job is to DEDUCE what is happening in this patient's gut by weighing ALL the evidence together ... post-anastomosis physiology."
```

**Location 5: `/src/lib/aiAnalysis.ts` (line 1498)**
```typescript
"If transit has stalled (no movement 12h+): this happens in post-anastomosis recovery."
```

**Location 6: `/src/lib/aiAnalysis.ts` (line 1501)**
```typescript
"### 5. Bristol stool interpretation for post-anastomosis patients"
```

**Issue:** These strings assume a single use case (anastomosis/reversal patient) with no support for:
- Future users with different conditions (IBD flares, other GI conditions)
- Customizable coaching personality based on health profile
- Non-English languages

---

#### 3. **Stimulant/Drug Keyword Hardcoding (WQ-138 main)**

**Location 1: `/shared/foodEvidence.ts` (line 517)**
```typescript
if (
  /cig|nicotine|smok|coffee|caffeine|stimulant|tina|rec drug/.test(key)
) {
  current.deltaMinutes -= Math.min(180, quantity * 20);
  current.reliability -= 0.12;
}
```

**Location 2: `/src/lib/derivedHabitLogs.ts` (line 6)**
```typescript
const REC_DRUG_ALIASES = ["rec drugs", "rec_drugs", "recreational drugs", "tina"];
```

**Issue:** 
- Aliases are inconsistently managed (one place has `rec_drugs` hardcoded in foodEvidence regex, another has REC_DRUG_ALIASES array)
- "tina" is a specific street name for methamphetamine; better to use medical terminology
- No user preference for which substances they track or how they affect them
- Alcohol pattern at line 521 is similarly hardcoded

**Regex patterns in foodEvidence (line 517, 521):**
```typescript
/cig|nicotine|smok|coffee|caffeine|stimulant|tina|rec drug/  // accelerants
/alcohol|beer|wine|spirit|opiate|depressant/                  // decelerants
```

---

#### 4. **Existing Profile Fields That Support Parameterization**

The schema **already has** these fields in `HealthProfile` (`/src/types/domain.ts:224-256`):
- `surgeryType` (enum) — maps to domain
- `surgeryTypeOther` (string) — for custom surgery types
- `otherConditions` (string) — free text for additional conditions
- `medications` (string)
- `supplements` (string)
- `alcoholUse` (enum) 
- `alcoholFrequency` (enum)
- `recreationalDrugUse` (string) — could store user's own substance terms
- `recreationalCategories` (enum: "stimulants" | "depressants")
- `recreationalStimulantsFrequency` (enum)
- `smokingStatus` (enum)
- `lifestyleNotes` (string)

**Gap:** The coaching and AI logic don't leverage these existing fields. Instead, they hardcode assumptions about the user's condition and habits.

---

#### 5. **Mapping Between Domain and Clinical Surgery Types**

Currently missing is an explicit mapping. Should exist somewhere like `src/lib/surgeryTypeUtils.ts`:

```typescript
export function mapDomainSurgeryTypeToClinica(
  surgeryType: SurgeryType, 
): ClinicialSurgeryType {
  // "Ileostomy reversal" or "Colectomy with primary anastomosis" → "ileocolic"
  // "Colostomy reversal" → "colonic"
  // "Other" or "Colectomy with ileostomy" → "other" or undefined
}
```

---

### Files Affected (Comprehensive List)

**Type definitions:**
- `/src/types/domain.ts` (SurgeryType, HealthProfile)
- `/convex/validators.ts` (healthProfileValidator)
- `/shared/foodEvidence.ts` (SurgeryType — different definition!)

**UI/Settings:**
- `/src/components/settings/health/SurgerySection.tsx`
- `/src/components/landing/WaitlistForm.tsx`
- `/src/pages/Settings.tsx`

**Logic/Coaching:**
- `/src/lib/habitCoaching.ts` (2 hardcoded strings at lines 65, 259)
- `/src/lib/aiAnalysis.ts` (4 hardcoded references at lines 1314, 1351, 1498, 1501)
- `/src/lib/foodStatusThresholds.ts` (uses "ileocolic" comparison at line 355)
- `/shared/foodEvidence.ts` (regex hardcoding at line 517)
- `/src/lib/derivedHabitLogs.ts` (REC_DRUG_ALIASES at line 6)

**Tests:**
- `/src/lib/__tests__/aiAnalysis.test.ts` — many hardcoded surgery type tests
- `/src/lib/__tests__/foodStatusThresholds.test.ts`
- `/shared/__tests__/foodEvidence.transit.test.ts`

---

### Recommended Parameterization Approach

**Step 1: Create a config/preference service**

Add to `HealthProfile` (or new `CoachingPreferences`):
```typescript
export interface CoachingContext {
  // From health profile
  healthCondition: string;  // "anastomosis recovery" | custom
  surgeryTypeLabel: string; // user-facing label
  
  // Substance tracking preferences
  trackedSubstances: {
    stimulants: string[];   // ["coffee", "tea", "cigarettes", ...]
    depressants: string[];  // ["alcohol", "opioids", ...]
    custom: string[];
  };
  
  // Habit modifiers (current hardcoding)
  stimulantTransitModifier: number; // -180 (current default)
  stimulantReliabilityPenalty: number; // -0.12
  depressantTransitModifier: number; // +120
  depressantReliabilityPenalty: number; // -0.08
}
```

**Step 2: Map domain surgery type to clinical model**

Create `/src/lib/surgeryTypeMapper.ts`:
```typescript
export function getClinicalSurgeryType(
  domainType: SurgeryType,
  otherLabel?: string,
): ClinicialSurgeryType {
  // Deterministic mapping with clear logic
}
```

**Step 3: Externalize prompts**

Move coaching prompts from inline strings to:
- `/src/lib/coachingPrompts.ts` (template with interpolation)
- Allow `preferredConditionLabel` to parameterize "post-surgery anastomosis recovery"

**Step 4: Centralize substance keywords**

Create `/src/lib/substanceModifiers.ts`:
```typescript
export const DEFAULT_SUBSTANCE_MODIFIERS = {
  stimulants: {
    keywords: ["nicotine", "coffee", "caffeine", ...],
    transitModifier: -180,
    reliabilityPenalty: -0.12,
  },
  depressants: {
    keywords: ["alcohol", "opioid", ...],
    transitModifier: +120,
    reliabilityPenalty: -0.08,
  },
};
```

Then pass this config to `foodEvidence.ts` and `derivedHabitLogs.ts` instead of hardcoding regexes.

---

### Files to Create/Modify (Summary)

| File | Action | Reason |
|------|--------|--------|
| `/src/lib/surgeryTypeMapper.ts` | Create | Explicit mapping between domain and clinical types |
| `/src/lib/substanceModifiers.ts` | Create | Centralized substance keyword + modifier config |
| `/src/lib/coachingPrompts.ts` | Create | Template prompts with parameterization |
| `/src/types/domain.ts` | Modify | Add `CoachingContext` or extend `AiPreferences` |
| `/src/lib/habitCoaching.ts` | Modify | Use coachingPrompts templates instead of inline strings |
| `/src/lib/aiAnalysis.ts` | Modify | Use templates + config for system prompt |
| `/shared/foodEvidence.ts` | Modify | Inject substance config instead of hardcoded regex |
| `/src/lib/derivedHabitLogs.ts` | Modify | Use centralized REC_DRUG_ALIASES config |
| `/src/lib/foodStatusThresholds.ts` | Modify | Use surgeryTypeMapper for comparisons |

---

### Output Summary

**Hardcoded strings found:**
1. Line 65, 259 in `habitCoaching.ts` — "post-surgery anastomosis recovery patient"
2. Lines 1314, 1351, 1498, 1501 in `aiAnalysis.ts` — "post-operative colon reconnection", "post-anastomosis", etc.
3. Line 517 in `foodEvidence.ts` — `tina|rec drug` regex and substance modifiers
4. Line 6 in `derivedHabitLogs.ts` — REC_DRUG_ALIASES array
5. Line 355 in `foodStatusThresholds.ts` — `surgeryType === "ileocolic"` hardcoded comparison
6. UI dropdowns in `SurgerySection.tsx` and `WaitlistForm.tsx` — surgery type options

**Parameterization approach:** Externalize into config objects that read from `HealthProfile` + new `CoachingContext` preference fields, then inject into prompt templates and keyword-matching logic instead of hardcoding.