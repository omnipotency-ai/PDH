# Food Data Flow — From Text Input to UI Display

> **Status (2026-03-15): Current and accurate.** This is the single canonical location — no duplicate at project root. Reflects the Phase 4.6 server-side pipeline. Last verified against `convex/foodParsing.ts`, `convex/foodLlmMatching.ts`, and `shared/foodParsing.ts`.

How food text travels through the system, what each field name means, where it's stored, and where it appears in the UI.

---

## Stage 1: Raw Input

**What happens:** You type into the food input box and hit "Log Food".

**Field:** `rawInput`
**Example:** `"2 sl toast, 1 med banana"`

**Where it's stored:** In the Convex `logs` table, inside the `data` JSON column alongside `items` and `notes`:

```json
{
  "type": "food",
  "data": {
    "rawInput": "2 sl toast, 1 med banana",
    "items": [ ... ],
    "notes": ""
  }
}
```

**Where it appears in UI:**

- The **"Edit food entry"** button (pencil icon on food entries) opens `RawInputEditModal` — a sheet that shows the full rawInput in a textarea. Available for all food entries (via `canEditPrimary()` in `helpers.ts`). Saving here replaces rawInput, clears items, and re-triggers the full pipeline from scratch.
- Also accessible from inside the `FoodMatchingModal` (the review modal for unresolved items).

**Key rule:** `rawInput` is never modified by the pipeline. Only the user can change it (via the edit modal). It's the sacred original.

---

## Stage 2: User Segment

**What happens:** `rawInput` is split on commas by `splitRawFoodItems()`. Each piece between commas becomes a `userSegment`.

**Function:** `splitRawFoodItems(sanitiseFoodInput(rawInput))`
**File:** `shared/foodParsing.ts`

**Field:** `userSegment`
**Example:** `"2 sl toast"` (first segment), `"1 med banana"` (second segment)

**Where it's stored:** On each item in `data.items[]` in the Convex log.

**Where it appears in UI:**

- The **inline edit** (expand a food entry in Today's Log) initialises the "Food name" text field from `userSegment` first — **this is a known bug** because it includes the quantity and unit text (shows "2 sl toast" even though qty/unit fields separately show "2" and "sl").
- The evidence engine (`processEvidence`) uses `userSegment` as the `ingredientName` stored on `ingredientExposures`.

**Key rule:** `userSegment` preserves your original wording for that one food, including quantity/unit text. It's never modified after initial parsing.

---

## Stage 3: Parsed Name, Quantity, Unit

**What happens:** Each `userSegment` is run through `parseLeadingQuantity()` which strips off any leading number and unit.

**Function:** `parseLeadingQuantity(segment)`
**File:** `shared/foodParsing.ts`

**Fields:**
| Field | Example | Description |
|-------|---------|-------------|
| `parsedName` | `"toast"` | The food name with quantity and unit stripped off |
| `quantity` | `2` | Extracted number (null if none) |
| `unit` | `"sl"` | Normalised unit abbreviation (null if none) |

**Unit normalisation examples:**

- "slices" / "slice" / "sl" → `"sl"`
- "medium" / "med" → `"med"`
- "large" / "lg" → `"lg"`
- "grams" / "gram" / "g" → `"g"`

**Where stored:** On each item in `data.items[]`:

```json
{
  "userSegment": "2 sl toast",
  "parsedName": "toast",
  "quantity": 2,
  "unit": "sl"
}
```

**Where it appears in UI:**

- **Today's Log display** (green tick + name): reads `parsedName` via `getFoodItemDisplayName()` in `helpers.ts`. Currently shows just the bare name (e.g., "toast") with no quantity — a known issue.
- **Inline edit** qty/unit fields: read from `quantity` and `unit` directly.
- **Patterns page** trial sub-rows: uses `parsedName` for display.

---

## Stage 4: Canonical Name + Resolution

**What happens:** `parsedName` is looked up in the food registry via `canonicalizeKnownFoodName()`. If found, we have a match. If not, the item stays unresolved for LLM or user matching.

**Functions:**

- `canonicalizeKnownFoodName(parsedName)` — tries parsed name first
- `canonicalizeKnownFoodName(segment)` — falls back to full segment
- LLM matching (client-initiated, `foodLlmMatching.ts`)
- User matching (`resolveItem` mutation via `FoodMatchingModal`)

**Fields:**
| Field | Example | Description |
|-------|---------|-------------|
| `canonicalName` | `"toast"` | The registry's official name. Could differ from parsedName (e.g., "toasted bread" → `"toast"`) |
| `resolvedBy` | `"registry"` | Who matched it: `"registry"`, `"llm"`, `"user"`, or `"expired"` |
| `recoveryStage` | `2` | Anastomosis recovery stage (1/2/3) from the registry |

**Resolution paths:**

1. **Registry** (`resolvedBy: "registry"`): Instant, deterministic. Happens during `processLog`.
2. **LLM** (`resolvedBy: "llm"`): Client-initiated via BYOK API key. `applyLlmResults` mutation writes results.
3. **User** (`resolvedBy: "user"`): Manual match via `FoodMatchingModal` dropdown. `resolveItem` mutation.
4. **Expired** (`resolvedBy: "expired"`): After 6 hours, unresolved items get `canonicalName: "unknown_food"` via `processEvidence`.

**Where stored:** On each item in `data.items[]`:

```json
{
  "userSegment": "2 sl toast",
  "parsedName": "toast",
  "canonicalName": "toast",
  "resolvedBy": "registry",
  "quantity": 2,
  "unit": "sl",
  "recoveryStage": 2
}
```

**Where it appears in UI:**

- **Resolution dot** (green ✓ / yellow ○ / spinner): based on whether `canonicalName` exists and `resolvedBy` value.
- **Tooltip** on hover: "Matched: quelito (user)" — shows `canonicalName` + `resolvedBy`.
- **FoodMatchingModal**: shows unresolved items (no `canonicalName`) for user to match.
- **Evidence engine** (6hr): creates `ingredientExposures` using `canonicalName` for pattern correlation.
- **Patterns page**: groups trials by `canonicalName`.

---

## Stage 5: Ingredient Exposures (Evidence Engine)

**What happens:** 6 hours after logging, `processEvidence` runs. It expires any still-unresolved items to `unknown_food`, then creates `ingredientExposures` records for resolved items.

**Table:** `ingredientExposures`
**Key fields:**
| Field | Source |
|-------|--------|
| `ingredientName` | `userSegment` (your original wording) |
| `canonicalName` | From Stage 4 |
| `quantity` | From Stage 3 |
| `unit` | From Stage 3 |
| `logTimestamp` | From the parent log |

**Where it appears in UI:**

- **Patterns page**: trial history, food evidence, transit correlations.

---

## Legacy Fields (old data only)

These exist on entries created before the pipeline was built:

| Field     | What it was                |
| --------- | -------------------------- |
| `name`    | Old pre-pipeline food name |
| `rawName` | Old pre-pipeline raw name  |

New entries don't use these. `getFoodItemDisplayName()` falls back to them for backwards compatibility.

---

## Complete Item Lifecycle

```
You type: "2 sl toast, 1 med banana"
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  rawInput = "2 sl toast, 1 med banana"      │  ← Stored on log.data
│  (sacred — never modified by pipeline)      │     Edit food entry modal reads this
└─────────────────────────────────────────────┘
                    │
          sanitiseFoodInput() → splitRawFoodItems()
          (clean up voice artefacts, split on commas)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  userSegment:              userSegment:
  "2 sl toast"              "1 med banana"
        │                       │
  parseLeadingQuantity()    parseLeadingQuantity()
        │                       │
        ▼                       ▼
  qty=2, unit="sl"          qty=1, unit="med"
  parsedName="toast"        parsedName="banana"
        │                       │
  canonicalizeKnownFoodName()   canonicalizeKnownFoodName()
        │                       │
        ▼                       ▼
  canonicalName="toast"     canonicalName="banana"
  resolvedBy="registry"     resolvedBy="registry"
  recoveryStage=2           recoveryStage=2
        │                       │
        └───────────┬───────────┘
                    ▼
        Written to data.items[]
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   [If unresolved]       [After 6 hours]
   LLM or User match     processEvidence()
   → updates items[]     → creates ingredientExposures
                          → expires unmatched to unknown_food
```

---

## Known Issues (to fix)

1. **Inline edit draft uses `userSegment` for name field** — shows "2 sl toast" in name even though qty/unit fields show "2"/"sl". Should use `parsedName`.
2. **Log display shows bare `parsedName` with no quantity** — "toast" instead of "2 sl toast" or "2× toast".
3. **Food delete has no confirmation** — single click deletes immediately, unlike other log types which have "Sure?" inline confirmation.
4. **Saving inline edit corrupts `parsedName`** — writes `userSegment` value back to `parsedName`, undoing the quantity stripping.
