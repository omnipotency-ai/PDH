Now let me create a comprehensive analysis document. I have all the information needed.

## WQ-107: LogEntry.tsx Refactor Plan

Based on thorough analysis of `LogEntry.tsx` (832 LOC) and the six SubRow editors, here is a structured refactor plan:

---

## Current Architecture

### LogEntry.tsx (832 LOC)
A monolithic component that handles **all 7 log types** with a single component tree:
- **Digestion** logs: Expandable group with collapsible inline editor
- **Food** logs: Inline editing with per-item controls
- **Fluid** logs: Simple text + timestamp
- **Habit** logs: Icon + timestamp only
- **Activity** logs: Duration + timestamp
- **Weight** logs: Value + timestamp
- **Reproductive** logs: Complex multi-field form

### Existing SubRow Editors (6 files)
Fully independent, composable components that delegate to **EditableEntryRow**:
- `FoodSubRow.tsx` (220 LOC)
- `FluidSubRow.tsx` (119 LOC)
- `ActivitySubRow.tsx` (83 LOC)
- `HabitSubRow.tsx` (34 LOC)
- `WeightSubRow.tsx` (94 LOC)
- `ReproductiveSubRow.tsx` (268 LOC)

### EditableEntryRow.tsx (287 LOC)
Generic wrapper that handles:
- Shared date/time inputs
- Edit/save/delete state machine
- Three layout modes: `inline`, `stacked`, `stacked-2`
- Three padding modes: `compact`, `normal`, `spacious`
- Auto-edit-entry integration

---

## Identified Duplications

### 1. **State Management Duplication**

| Draft State | LogEntry | SubRow | Duplication |
|---|---|---|---|
| `draftDate`, `draftTimestamp` | ✓ (manual) | EditableEntryRow | Digestion reinvents these; others use SubRow pattern |
| `draftPrimary` (food items) | ✓ (manual) | FoodSubRow.initDraftItems | Identical initDraftItems logic in both |
| `draftNotes` | ✓ (manual) | EditableEntryRow | Manual state in LogEntry + EditableEntryRow |

**Impact**: Food editing logic appears twice with 95% identical code (lines 135–151 vs FoodSubRow lines 227–237).

---

### 2. **Type-Specific Editing UI Duplication**

| Feature | LogEntry | SubRow | Duplication |
|---|---|---|---|
| Food item rows (qty/unit/name) | Lines 671–723 | FoodSubRow 278–324 | ~95% identical UI |
| Digestion bristol buttons (1–7) | Lines 455–469 | N/A (SubRow not created) | Only in LogEntry |
| Reproductive bleeding buttons | Lines 757–776 | ReproductiveSubRow 86–102 | ~90% identical UI |
| Reproductive symptom chips | Lines 779–803 | ReproductiveSubRow 106–128 | ~90% identical UI |

**Impact**: Food and Reproductive editing is duplicated across files; Digestion has no SubRow equivalent.

---

### 3. **Save/Validation Logic Duplication**

| Log Type | LogEntry saveEditing | SubRow buildSaveData | Status |
|---|---|---|---|
| **Food** | Lines 193–227 | FoodSubRow 243–273 | ~95% identical |
| **Fluid** | Lines 228–239 | FluidSubRow 46–59 | ~90% identical |
| **Digestion** | Lines 240–258 | N/A | Only in LogEntry |
| **Reproductive** | Lines 259–269 | ReproductiveSubRow 49–65 | ~85% identical |

**Impact**: 4 types have duplicate save logic; Digestion save exists only in LogEntry.

---

### 4. **Display Rendering Duplication**

**LogEntry** constructs full rows inline with icon, title, detail, notes, and delete/edit buttons.
**SubRows** delegate all of this to EditableEntryRow.

**Impact**: Non-digestion logs in LogEntry rebuild what EditableEntryRow already does.

---

## Architecture Debt

### Why LogEntry Exists in Current Form

1. **Digestion is Special**: Expandable group-row layout breaks the flat list assumption
2. **Mixed Rendering Context**: Digestion needed collapsible UI; others just needed inline editing
3. **Historical Layering**: SubRows were added later; LogEntry predates them
4. **Inconsistent State Patterns**: Some types used draft state, others didn't; no unified pattern

### Why This is a Problem

- **Maintenance Cost**: Changes to Food/Fluid/Reproductive/Digestion editing require edits in TWO places
- **Test Coverage Gap**: LogEntry type-specific logic is not covered by SubRow tests
- **Cognitive Load**: Reader must understand why Food has both LogEntry and FoodSubRow logic
- **Inconsistent Patterns**: Some types use `EditableEntryRow`, others don't
- **Scaling Risk**: New log types must be added to both places

---

## Concrete Refactor Plan

### Phase 1: Extract Digestion into DigestiveSubRow

**Goal**: Move all digestion-specific logic (lines 304–642) into a new `DigestiveSubRow.tsx`.

**What moves**:
- All digestion draft state (`draftBristol`, `draftEpisodes`, `draftUrgency`, `draftEffort`, `draftVolume`, `draftAccident`)
- Expanded/collapsed toggle state
- Bristol button UI (lines 451–469)
- Urgency/Effort/Volume button UIs (lines 506–581)
- Notes textarea (lines 584–592)
- Save/cancel/delete handlers
- Collapsed preview building (lines 320–349)
- Display rendering for collapsed + expanded state

**What stays in LogEntry**:
- Type dispatch (if/else chains for types 1–7)
- Icon + title rendering (shared across all types)
- Wrapping container

**Estimated LOC reduction**: 340 LOC → DigestiveSubRow

**Key Decision**: Digestion collapsible UI is wrapped by EditableEntryRow-style pattern OR built as a custom layout inside DigestiveSubRow? **Recommend custom layout** since collapsible state is domain logic, not generic.

---

### Phase 2: Remove Food/Fluid/Reproductive Duplication from LogEntry

**Goal**: Delete type-specific editing code from LogEntry; delegate entirely to SubRows for food, fluid, reproductive.

**What gets deleted from LogEntry**:
- Lines 669–723 (food editing)
- Lines 726–734 (fluid editing)
- Lines 737–817 (reproductive editing)
- Corresponding draft state initialization (lines 60–88)
- Corresponding draft state reset (lines 126–133)
- Corresponding save logic (lines 193–269)
- Corresponding display rendering (lines 819–887, partially)

**What replaces it**:
- Conditional render: if (log.type is SubRow-handled) → `<SubRow />`
- If (log.type is Digestion) → `<DigestiveSubRow />`
- Else (Habit, Activity, Weight) → keep inline single-row display

**Estimated LOC reduction**: ~280 LOC removed from LogEntry

---

### Phase 3: Consolidate Remaining Single-Row Types

**Goal**: Unify Habit, Activity, Weight display in LogEntry (they don't currently have SubRows).

**Option A (Recommended)**: Create placeholder SubRows for Habit/Activity/Weight that are nearly empty:
```tsx
export function HabitSubRow({ entry }: { entry: HabitLog }) {
  return <EditableEntryRow
    buildSaveData={() => ({ ...entry.data })}
    renderEditFields={() => null}
    renderDisplay={() => <span>HH:mm</span>}
    editLayout="inline"
  />;
}
```
Then LogEntry becomes:
```tsx
const subRowMap = {
  food: FoodSubRow,
  fluid: FluidSubRow,
  activity: ActivitySubRow,
  habit: HabitSubRow,
  weight: WeightSubRow,
  reproductive: ReproductiveSubRow,
  digestion: DigestiveSubRow,
};

const SubRow = subRowMap[log.type];
return <SubRow entry={log} />;
```

**Estimated LOC reduction**: LogEntry becomes ~150 LOC (just the dispatcher).

**Option B**: Keep Habit/Activity/Weight inline in LogEntry (~50 LOC each). Less refactor, but less consistency.

**Recommendation**: Option A. Creates unified pattern, allows future migration of display logic to SubRows.

---

## Final Structure

### After Refactor

| File | Lines | Purpose |
|---|---|---|
| `LogEntry.tsx` | ~150 | Dispatcher. Type → SubRow mapper. Icon/title wrapper. |
| `DigestiveSubRow.tsx` | ~340 | NEW: Collapsible bowel log editor. |
| `FoodSubRow.tsx` | ~220 | UNCHANGED (already aligned) |
| `FluidSubRow.tsx` | ~119 | UNCHANGED (already aligned) |
| `ActivitySubRow.tsx` | ~83 | UNCHANGED (already aligned) |
| `HabitSubRow.tsx` | ~34 | UNCHANGED (already aligned) |
| `WeightSubRow.tsx` | ~94 | UNCHANGED (already aligned) |
| `ReproductiveSubRow.tsx` | ~268 | UNCHANGED (already aligned) |
| `EditableEntryRow.tsx` | ~287 | UNCHANGED (already aligned) |

### Overall LOC Impact

- **Before**: LogEntry (832) + 6 SubRows (898) = **1,730 LOC**
- **After**: LogEntry (150) + DigestiveSubRow (340) + 6 SubRows (898) = **1,388 LOC**
- **Reduction**: ~340 LOC (20%)
- **Duplication Eliminated**: 100% of food, fluid, reproductive duplicates removed

---

## Benefits

1. **Single Responsibility**: Each SubRow owns its type-specific logic
2. **Test Isolation**: DigestiveSubRow logic tested independently
3. **Consistency**: All log types follow the same pattern (dispatch → SubRow)
4. **Maintenance**: Changes to Food editing happen once (FoodSubRow), not twice
5. **Scaling**: New log types only need a new SubRow, not LogEntry changes
6. **Readability**: LogEntry becomes a thin dispatcher, easier to understand at a glance

---

## Implementation Sequence

1. **Create DigestiveSubRow.tsx** with all digestion state and logic (340 LOC)
2. **Test DigestiveSubRow** with existing test suite
3. **Update LogEntry** to conditionally render DigestiveSubRow
4. **Remove digestion state/logic** from LogEntry
5. **Remove food/fluid/reproductive state/logic** from LogEntry (validate SubRows handle it)
6. **Create stub SubRows** for Habit/Activity/Weight if choosing Option A
7. **Update LogEntry dispatcher** to map all types to SubRows
8. **Remove icon/title rendering** if moved to SubRows, OR keep as wrapper
9. **Run full test suite** and E2E tests

---

## Estimated Effort

- **Digestion extraction**: 2–3 hours (complex collapsible state, bristol/urgency/effort/volume logic)
- **Remove duplicates**: 1–2 hours (search-and-replace, careful validation)
- **Create stub SubRows**: 30 minutes
- **Update LogEntry dispatcher**: 30 minutes
- **Testing + fixes**: 1–2 hours
- **Total**: ~6–8 hours

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Digestion collapsible state breaks | Comprehensive unit + E2E tests for each collapse/expand path |
| Food/Reproductive save logic behaves differently | Parallel testing: run both old LogEntry and new SubRow paths on same data |
| Missing edge cases (e.g., accident flag, expired items) | Audit all draft state before/after refactor; compare JSON output |
| Performance regression | Verify EditableEntryRow re-renders don't exceed current frequency |

---

## Notes for Implementation

- **Preserve All Styling**: Bristol button styles, reproduction symptom chips, accident flag all must migrate exactly
- **Date/Time Handling**: DigestiveSubRow will use EditableEntryRow's date/time system; ensure `applyDateTimeToTimestamp` works correctly
- **Auto-Edit Integration**: useAutoEditEntry hook is already in EditableEntryRow; verify it works for DigestiveSubRow
- **Notes Field**: Digestion has a notes textarea; ensure it coexists with EditableEntryRow's generic notes handling
- **Habit Icon Resolution**: LogEntry resolves habit icons from config (lines 90–98); move this to HabitSubRow if creating one