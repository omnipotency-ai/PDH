# Food Page Implementation Plan — Connected Data Model

> **Ref:** `docs/plans/food-page-implementation-plan.md`
> **Created:** 2026-04-08
> **Updated:** 2026-04-09 (v3 — connected architecture rewrite)
> **Parent plan:** [`food-platform-master-plan.md`](food-platform-master-plan.md)
> **Filter spec:** [`filter-prompt.md`](filter-prompt.md)
> **Branch:** `odyssey/food-platform`

---

## 1. The Connected Data Model

The three tables are **not** parallel systems. They form a directed graph:

```
┌──────────────────────────┐
│   clinicalRegistry       │ ← Zones: digestive properties, zone 1/2/3
│   "bread"                │   osmotic, residue, gas, irritant, lactose, fibre
│   zone: 1                │
└──────────┬───────────────┘
           │  registryId (many → one)
           │
┌──────────┴───────────────┐
│   ingredientProfiles     │ ← Products: per-user catalogue with macros
│   "Barry's pan bread"    │   kcal, protein, carbs, fat, sugars, fibre per 100g
│   toleranceStatus: like  │   user's declared tolerance status
│   customPortions: [...]  │ ← Portions: user-owned portion definitions
│     { label: "slice",    │   label + weightG, inline editable
│       weightG: 30 }      │
└──────────────────────────┘
```

**When a food is logged on Home**, it carries everything: macros from the product + zone properties from its linked zone entry + the user's portion choice + tolerance status. Nothing is siloed.

**When viewed on Insights**, the zones table is the same `clinicalRegistry` data, overlaid with analytics: trial outcomes, Bristol averages, and transit times — all averaged across every product that rolls up to that zone entry. "Bread" shows the aggregated outcome of toast, baguettes, sliced pan, etc.

### Key Relationships

| From                   | To               | Via                  | Meaning                                          |
| ---------------------- | ---------------- | -------------------- | ------------------------------------------------ |
| ingredientProfiles     | clinicalRegistry | `registryId`         | Product rolls up to a zone entry                 |
| ingredientProfiles     | (self)           | `customPortions[]`   | Portions are embedded per-product                |
| Insights DatabaseTable | clinicalRegistry | same data            | Zones table on Food = analytics base on Insights |
| ingredientProfiles     | foodTrialSummary | `canonicalName` join | AI-derived trial analysis                        |

---

## 2. Unified Tolerance Status

**One status, not two.** The user declares their subjective tolerance via a 2×2 matrix:

```
                Tolerated    Not tolerated
Liked           like         watch
Not liked       dislike      avoid
```

| Status     | Meaning                              | Colour |
| ---------- | ------------------------------------ | ------ |
| `building` | Untested / in progress               | grey   |
| `like`     | Tolerated + I like it                | green  |
| `dislike`  | Tolerated + I don't like it          | blue   |
| `watch`    | I like it + doesn't agree with me    | amber  |
| `avoid`    | Don't like + doesn't agree, why eat? | red    |

**No "safe" or "unsafe".** Foods aren't unsafe — they're "not tolerated well."

### Where Status Lives

Status is a **user declaration** stored on `ingredientProfiles.toleranceStatus`. This is the field that both the Food page and Insights page read. The AI system (`foodTrialSummary`) has its own analytical status for pattern detection, but the user's declared status is what matters for display and filtering.

The existing `ingredientOverrides` table (safe/watch/avoid) is superseded. We migrate its data to the new `toleranceStatus` field on `ingredientProfiles` and deprecate the table.

### Status Display Priority

1. User-set `toleranceStatus` on `ingredientProfiles` → shown everywhere
2. If not set → `building` (default for new products)
3. AI suggestions appear as recommendations in Dr Poo reports, but don't auto-write to `toleranceStatus`

---

## 3. Page Responsibilities

| Page         | Owns                                                                                                              | Does NOT do        |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Home**     | All logging (food, water, BMs, habits), Dr Poo, quick insights, favourite toggle in NutritionCard                 | Database editing   |
| **Food**     | Product catalogue CRUD, zone properties editing, portion management, tolerance status setting, composable filters | Logging, analytics |
| **Insights** | Analytics overlay on zones data: trial history, Bristol averages, transit times, AI assessments, smart views      | Data editing       |
| **Settings** | Preferences, goals, profile                                                                                       | —                  |

---

## 4. Schema Changes

### `ingredientProfiles` — add tolerance status

```typescript
// Add to schema:
toleranceStatus: v.optional(v.union(
  v.literal("building"),
  v.literal("like"),
  v.literal("dislike"),
  v.literal("watch"),
  v.literal("avoid"),
)),
```

### `ingredientOverrides` — deprecate

The existing `ingredientOverrides` table with safe/watch/avoid is replaced by `ingredientProfiles.toleranceStatus`. A one-time migration maps:

- `safe` → `like`
- `watch` → `watch`
- `avoid` → `avoid`

After migration, the table is retained (data preservation) but no new writes.

---

## 5. Convex Mutations Needed

### `ingredientProfiles` — extend existing

- **`upsert`** — add args: `customPortions`, `productName`, `barcode`, `registryId`, `toleranceStatus` (schema fields exist, mutation doesn't accept them)
- **`remove`** — new: delete by `_id`, auth-gated, ownership check
- **`setToleranceStatus`** — new: set status for a product (dedicated mutation for clarity, calls `ctx.db.patch`)
- **`updatePortions`** — new: replace `customPortions` array for a product (dedicated for the Portions view)

### `clinicalRegistry` — new CRUD file

Currently only has a seed script. Needs `convex/clinicalRegistry.ts`:

- **`list`** — query: all rows, sorted by zone → lineOrder
- **`byCanonicalName`** — query: single lookup
- **`update`** — mutation: patch any editable field by `_id`, auth-gated
- **`create`** — mutation: insert new entry, check canonicalName uniqueness
- **`remove`** — mutation: delete by `_id`, auth-gated

### Migration — override status to tolerance status

- **`migrateOverridesToTolerance`** — internal mutation: for each `ingredientOverrides` row, find or create matching `ingredientProfiles` and set `toleranceStatus` (safe→like, watch→watch, avoid→avoid)

---

## 6. Food Page Views

### Tab 1: Registry (Products)

TanStack React Table of `ingredientProfiles` rows. Each row = one product the user eats/drinks.

**Columns:**

| Column  | Source                              | Editable           | Type                              |
| ------- | ----------------------------------- | ------------------ | --------------------------------- |
| Name    | `displayName`                       | yes (text)         | string                            |
| Product | `productName`                       | yes (text)         | string                            |
| Zone    | via `registryId` → clinicalRegistry | no (badge, linked) | 1/2/3                             |
| Status  | `toleranceStatus`                   | yes (select)       | building/like/dislike/watch/avoid |
| kcal    | `nutritionPer100g.kcal`             | yes (number)       | number                            |
| Protein | `nutritionPer100g.proteinG`         | yes (number)       | number                            |
| Carbs   | `nutritionPer100g.carbsG`           | yes (number)       | number                            |
| Fat     | `nutritionPer100g.fatG`             | yes (number)       | number                            |
| Fibre   | `nutritionPer100g.fiberG`           | yes (number)       | number                            |
| Source  | `source`                            | no (badge)         | manual/openfoodfacts              |
| Actions | —                                   | —                  | delete                            |

**No "macro category" column** — every food has all macros, so grouping by macro is redundant.

**Zone badge** is a read-only lookup via `registryId`. Clicking it could navigate to the Zones tab filtered to that entry.

**Expanding a row** shows: zone properties from linked `clinicalRegistry` entry (osmotic, residue, gas, etc.) + custom portions list. This is how the user sees "everything this food carries."

**Actions:** Add manually, Import from OpenFoodFacts, Delete with confirmation.

### Tab 2: Zones (Digestive Properties)

TanStack React Table of `clinicalRegistry` rows. Each row = a digestive category that products roll up to.

**Columns:**

| Column      | Source              | Editable           | Type          |
| ----------- | ------------------- | ------------------ | ------------- |
| Name        | `canonicalName`     | yes (text)         | string        |
| Zone        | `zone`              | yes (select 1/2/3) | number        |
| Category    | `category`          | yes (select)       | enum          |
| Subcategory | `subcategory`       | yes (select)       | enum          |
| Osmotic     | `osmoticEffect`     | yes (select)       | risk level    |
| Residue     | `totalResidue`      | yes (select)       | residue level |
| Gas         | `gasProducing`      | yes (select)       | gas level     |
| Fibre (g)   | `fiberTotalApproxG` | yes (number)       | number        |
| Fat Risk    | `highFatRisk`       | yes (select)       | risk level    |
| Irritant    | `irritantLoad`      | yes (select)       | risk level    |
| Lactose     | `lactoseRisk`       | yes (select)       | risk level    |
| Notes       | `notes`             | yes (text)         | string        |
| Actions     | —                   | —                  | delete        |

**This is the same data the Insights page reads.** The Food page makes it editable. The Insights page overlays analytics (trial counts, Bristol averages, transit times) on top of it.

**Expanding a row** shows: all products that roll up to this zone entry (via `registryId` reverse lookup). Enables filtering like "show me all bread products."

**Composable filter bar** (per `filter-prompt.md`): Linear-style chips for zone, category, osmotic, residue, gas, fibre, fat risk, irritant, lactose, tags.

**Actions:** Add new zone entry, Delete with confirmation.

### Tab 3: Portions (User-Owned)

Flattened view of `customPortions` across all `ingredientProfiles`. Not a separate Convex table.

**Columns:**

| Column     | Source                     | Editable     | Type                 |
| ---------- | -------------------------- | ------------ | -------------------- |
| Food       | parent `displayName`       | no           | string               |
| Label      | `customPortions[].label`   | yes (text)   | string               |
| Weight (g) | `customPortions[].weightG` | yes (number) | number               |
| Type       | system default vs custom   | no (badge)   | indicator            |
| Actions    | —                          | —            | delete (custom only) |

**Save flow:** Edit label/weight → rebuild `customPortions` array → call `ingredientProfiles.updatePortions`. No American units.

**Add portion:** Per-food. Shows food picker (combobox), then adds an empty portion row.

---

## 7. Insights Page Evolution

The existing `Patterns.tsx` DatabaseTable already reads zone data from `clinicalRegistry` (via `getFoodEntry()`). The evolution:

1. **Replace static `getFoodEntry()` lookups** with live Convex `clinicalRegistry` queries — so edits on the Food page are immediately reflected on Insights.
2. **Transit times** are averaged per zone category, not per product. The `foodTrialSummary` transit data for "toast", "baguette", "pan bread" all aggregate under the "bread" zone entry.
3. **Remove macro category column** — every food has all macros, the column adds no signal.
4. **Show `toleranceStatus`** from `ingredientProfiles` instead of the separate `ingredientOverrides` system.
5. **Keep smart views, filters, and hero strip** — these are Insights features, not Food page features.

This is a **later phase** (after the Food page tables work). The existing Patterns page continues to function as-is during Food page development.

---

## 8. Execution Tasks

### Phase 1: Foundation (parallel)

#### F-T01: Page Shell + Tab Navigation

**Files:** `src/pages/Food.tsx`

Replace the 8-line stub with a three-tab page: `[Registry] [Zones] [Portions]`. Same pill-tab pattern as `FoodFilterView`. Each tab renders a placeholder until its table ships.

- State: `activeTab: "registry" | "zones" | "portions"` — default `"zones"` (most-used)
- Container: `flex flex-col gap-4 pb-20`
- `data-slot="food-page"`

#### F-T02: Editable Table Primitives

**Files:** `src/components/food/EditableCell.tsx`, `EditableNumberCell.tsx`, `EditableSelectCell.tsx`, `useInlineEdit.ts`, `TableActions.tsx`

Reusable inline-editing cells for TanStack Table:

- **EditableCell** (text): click → input, blur/Enter → save, Escape → revert
- **EditableNumberCell**: same, `type="number"`, non-negative validation, optional suffix
- **EditableSelectCell**: click → dropdown/menu, select → save immediately
- **useInlineEdit** hook: `{ isEditing, editValue, startEdit, cancelEdit, commitEdit }`, optimistic UI with revert on error
- **TableActions**: row delete with inline confirmation (Base UI Dialog, not `confirm()`), "Add row" button

All cells: per-cell editing (not per-row), save on blur/enter, `data-slot="editable-cell"`.

#### F-T03: Convex Backend Changes

**Files:** `convex/schema.ts`, `convex/ingredientProfiles.ts`, `convex/clinicalRegistry.ts` (new)

1. Add `toleranceStatus` field to `ingredientProfiles` schema
2. Extend `ingredientProfiles.upsert` args: `customPortions`, `productName`, `barcode`, `registryId`, `toleranceStatus`
3. Add `ingredientProfiles.remove` mutation
4. Add `ingredientProfiles.setToleranceStatus` mutation
5. Add `ingredientProfiles.updatePortions` mutation
6. Create `convex/clinicalRegistry.ts` with: `list`, `byCanonicalName`, `update`, `create`, `remove`

### Phase 2: Core Tables (parallel, depends on Phase 1)

#### F-T04: Zones Table

**Files:** `src/components/food/ZonesTable.tsx`, `zonesColumns.ts`, wire into `Food.tsx`

- `useQuery(api.clinicalRegistry.list)` → TanStack table with inline editing
- Each cell save → `useMutation(api.clinicalRegistry.update)`
- Column definitions per Section 6 Tab 2 above
- Select options from existing validators in `convex/validators.ts`
- Zone badge colouring via `getZoneBadgeClasses()` from `src/lib/zoneColors.ts`
- Row expansion: reverse lookup of products via `registryId`
- Global search (name substring)
- Sorting + pagination (25/50/100)

#### F-T05: Registry Table

**Files:** `src/components/food/RegistryTable.tsx`, `registryColumns.ts`, wire into `Food.tsx`

- `useQuery(api.ingredientProfiles.list)` → TanStack table with inline editing
- Each cell save → `useMutation(api.ingredientProfiles.upsert)`
- Zone column: read-only badge, looked up via `registryId` join to `clinicalRegistry`
- Status column: `EditableSelectCell` with building/like/dislike/watch/avoid → `setToleranceStatus`
- Row expansion: zone properties + portions from the linked zone entry
- "Add Food" button: empty row at top, minimum: displayName
- Global search (name substring)

### Phase 3: Extensions (parallel, depends on Phase 2)

#### F-T06: Portions View

**Files:** `src/components/food/PortionsTable.tsx`, `portionsColumns.ts`, wire into `Food.tsx`

- Flatten all `customPortions` across `ingredientProfiles` into `PortionRow[]`
- Include system defaults from `FOOD_PORTION_DATA` as read-only indicator rows
- Edit label/weight → rebuild array → `ingredientProfiles.updatePortions`
- "Add Portion" with food picker combobox
- Validate: `weightG > 0` (fix quality-backlog item)

#### F-T07: Composable Filter Bar

**Files:** `src/components/food/filters/FilterBar.tsx`, `FilterChip.tsx`, `FilterOperatorDropdown.tsx`, `FilterValueCombobox.tsx`, `FilterValueNumericInput.tsx`, `filterTypes.ts`

Implements the full composable filter system from `docs/plans/filter-prompt.md`:

```
[Zone] [is] [1, 2] [x]  [Gas] [is] [no] [x]  [+ Filter]
```

- 18 FilterTypes with operators per spec
- Chip = `[type] [operator] [value(s)] [x]`
- Integrates with TanStack `ColumnFiltersState`
- Applies to Zones table primarily, Registry table for tag/source filtering
- Horizontal scrollable bar + `[+ Filter]` grouped popover

### Phase 4: Integration (depends on Phase 3)

#### F-T08: OpenFoodFacts Import

**Files:** `src/components/food/OFFImportDialog.tsx`, wire into Registry tab

- "Import from OpenFoodFacts" button above Registry table
- Base UI Dialog with search input
- Calls `useAction(api.ingredientNutritionApi.searchOpenFoodFacts)`
- On select: creates `ingredientProfiles` row via `upsert` with `source: "openfoodfacts"`
- New row appears immediately (Convex reactivity)

#### F-T09: Insights Page Evolution

**Files:** `src/pages/Patterns.tsx`, `src/components/patterns/database/columns.tsx`

- Replace static `getFoodEntry()` with live `clinicalRegistry` Convex queries
- Show `toleranceStatus` from `ingredientProfiles` (replace `ingredientOverrides`)
- Aggregate transit times per zone category
- Remove macro category column
- Existing smart views, filters, hero strip stay

#### F-T10: Polish + Responsive

**Files:** various

1. Horizontal scroll on mobile with sticky first column
2. Skeleton loading rows
3. Empty states with helpful actions
4. Keyboard navigation: Tab between cells, Enter confirm, Escape cancel
5. Optimistic updates with toast on error revert
6. Override migration: `ingredientOverrides` → `toleranceStatus`

---

## 9. Dependency Graph

```
F-T01 (Shell) ─────┐
                    ├──► F-T04 (Zones) ──┬──► F-T07 (Filters) ──► F-T10 (Polish)
F-T02 (Cells) ─────┤                    │
                    ├──► F-T05 (Registry) ├──► F-T06 (Portions)
F-T03 (Backend) ───┘                    │
                                         ├──► F-T08 (OFF Import)
                                         └──► F-T09 (Insights Evolution)
```

**Phase 1:** F-T01 + F-T02 + F-T03 (all parallel)
**Phase 2:** F-T04 + F-T05 (parallel, blocked by Phase 1)
**Phase 3:** F-T06 + F-T07 (parallel, blocked by Phase 2)
**Phase 4:** F-T08 + F-T09 + F-T10 (parallel, blocked by Phase 2+3)

---

## 10. Non-Goals (deferred)

- Barcode scanner UI (schema field exists, scanner deferred)
- Meal template editor (foodLibrary composites, separate feature)
- AI auto-writing tolerance status (user declares, AI suggests)
- Smart Views on Food page (Insights-only for now)
- Batch editing (future — individual cell editing first)
