Excellent! Now I have comprehensive information. Let me create the final research report:

---

## WQ-341: Skeleton/Empty States Research Report

### Executive Summary

The app currently **lacks centralized empty state and skeleton loading patterns**. Two major data-heavy components—DatabaseTable and TransitMapContainer—lazy-load without fallback UI, creating an implicit assumption that data arrives instantly. The codebase has:

- A functional `<Spinner>` component (size-4 Loader2Icon)
- A well-structured `<ErrorBoundary>` for error recovery
- CSS animations for shimmer and pulse effects (already in `index.css`)
- One explicit empty state implementation (TransitMapContainer, lines 119-128)
- **No reusable skeleton, empty state, or loading pattern components**

### Current State Analysis

#### Suspense/Fallback Usage
- **Only 1 active Suspense boundary** in the codebase: `Track.tsx` line 751, wrapping `FoodMatchingModal` with `fallback={null}`
- `Patterns.tsx` uses eager data loading (no Suspense boundaries yet)
- No pattern established for async data loading UI

#### Existing Empty States

1. **TransitMapContainer** (lines 119-128): Checks `foodStats.length === 0 && network.testedStations === 0`
   - Shows calm message: "No food evidence yet. Log some food..."
   - Centered, min-height, reasonable typography
   - **Good reference for the pattern**

2. **DatabaseTable** (lines 157-165): Checks `table.getRowModel().rows.length === 0`
   - Shows: "No foods found."
   - Plain text, no visual guidance
   - **Minimal—could be richer**

#### Data Loading Patterns
- `Patterns.tsx` expects data synchronously: `allFoodTrials ?? []`, `mappedAssessments ?? []`
- No visible loading state when these queries resolve
- No distinction between "loading first time" vs "data arrived empty"

#### CSS Animation Foundation
The app **already has shimmer and pulse animations** (`index.css`):
- `@keyframes shimmer` (line 1104): horizontal gradient sweep
- `@keyframes pulseGlow` (line 1094): teal glow pulse
- `animate-shimmer` and `animate-pulse-glow` utility classes available
- Status/success animations also exist

#### Spinner Component
File: `src/components/ui/spinner.tsx`
- Uses `Loader2Icon` from lucide-react
- Default: `size-4`, animated via `animate-spin`
- Accepts className prop for customization
- Properly labeled with `role="status"` and `aria-label="Loading"`

#### Error Handling
`ErrorBoundary` component (lines 30-90) is **well-designed for section-level error recovery**:
- Generic, accepts custom fallback render
- Shows calm message: "Something went wrong in [label]"
- Offers "Retry" and "Reload page" options
- Already used in Track.tsx for FoodMatchingModal

---

### Findings: What's Missing

| Need | Status | Impact |
|------|--------|--------|
| Centralized `<EmptyState>` component | Missing | Inconsistent messaging; scattered null checks |
| `<Skeleton>` component (bone loaders) | Missing | No visual feedback while data loads |
| `<LoadingContainer>` wrapper | Missing | Hard to wrap async sections cleanly |
| Convex `useQuery` loading detection | Partial | `allFoodTrials ?? []` masks "loading" state |
| Suspense boundaries on data-heavy tabs | Missing | DatabaseTable renders before data arrives |
| Progressive disclosure for loading | Missing | Users see blank page while data fetches |

### Proposed Architecture

#### 1. EmptyState Component

**File:** `src/components/ui/EmptyState.tsx`

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;      // Lucide icon or SVG element
  title: string;               // "No foods logged yet"
  description: string;         // "Start by logging your first food..."
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "minimal" | "full"; // minimal = centered text; full = icon + title + desc + button
  className?: string;          // Override container styling
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "full",
  className,
}: EmptyStateProps)
```

**Usage:**
```typescript
{databaseRows.length === 0 ? (
  <EmptyState
    icon={<Database size={32} className="text-[var(--text-muted)]" />}
    title="No foods in your database"
    description="Log your first food to get started. Use the track button below."
    action={{ label: "Log food now", onClick: handleNavigateToTrack }}
    variant="full"
  />
) : (
  <DatabaseTable data={databaseRows} ... />
)}
```

**Design:**
- Centered container (min-height: 300px or 400px depending on context)
- Icon size 32-40px, muted color
- Title: text-lg, font-semibold
- Description: text-sm, text-muted
- Optional action button (secondary style)
- Calm, non-alarming tone

---

#### 2. Skeleton Component (Bone Loader)

**File:** `src/components/ui/Skeleton.tsx`

```typescript
interface SkeletonProps {
  width?: string | number;  // "100%", "200px", etc.
  height?: string | number; // "16px", "1.5rem", etc.
  circle?: boolean;         // For avatar skeletons
  className?: string;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  circle = false,
  className,
}: SkeletonProps)
```

**Usage:**
```typescript
<div className="space-y-2">
  <Skeleton width="60%" height="1.5rem" />          {/* Title */}
  <Skeleton width="100%" height="1rem" />           {/* Description line 1 */}
  <Skeleton width="80%" height="1rem" />            {/* Description line 2 */}
  <div className="mt-4 flex gap-2">
    <Skeleton width="80px" height="40px" />         {/* Button */}
    <Skeleton width="100px" height="40px" />        {/* Button 2 */}
  </div>
</div>
```

**Design:**
- Base color: `bg-[var(--surface-2)]` (slightly raised from background)
- Shimmer animation: applies `animate-shimmer` via inline style
- Responsive: can use `h-4`, `h-6`, `w-12`, etc.
- Circle variant: `rounded-full`
- Rectangular default: `rounded-md`

---

#### 3. SkeletonTable Component (Database-specific)

**File:** `src/components/ui/SkeletonTable.tsx`

```typescript
interface SkeletonTableProps {
  columnCount: number;       // e.g., 5 columns
  rowCount?: number;         // e.g., 8 rows (default: 5)
  headerVisible?: boolean;   // Show header skeleton
}

export function SkeletonTable({
  columnCount,
  rowCount = 5,
  headerVisible = true,
}: SkeletonTableProps)
```

**Usage:**
```typescript
const table = useReactTable({ ... });
const isLoading = databaseRows.length === 0 && isStillFetching;

return isLoading ? (
  <SkeletonTable columnCount={6} rowCount={8} />
) : (
  <DatabaseTable ... />
);
```

**Design:**
- Renders a table structure with shimmer rows
- Header row (if `headerVisible`): light pulse
- Body rows: staggered shimmer effect (each row starts shimmer ~100ms apart)
- Matches DatabaseTable column layout

---

#### 4. LoadingFallback Component (Suspense-safe)

**File:** `src/components/ui/LoadingFallback.tsx`

```typescript
interface LoadingFallbackProps {
  label?: string;       // "Loading data...", "Analyzing...", etc.
  variant?: "spinner" | "skeleton" | "pulse";
  children?: React.ReactNode; // Optional custom content
}

export function LoadingFallback({
  label = "Loading...",
  variant = "spinner",
  children,
}: LoadingFallbackProps)
```

**Variants:**
- **spinner**: Just the Spinner + label text (fast, minimal)
- **skeleton**: Shows placeholder shapes (full data load, ~2-4s)
- **pulse**: Pulsing card outline (indeterminate state)

**Usage:**
```typescript
<Suspense fallback={<LoadingFallback variant="skeleton" label="Fetching database..." />}>
  <DatabaseTabContent rows={databaseRows} />
</Suspense>
```

---

#### 5. Integration Points: Where to Add These

| Component | Pattern | Implementation |
|-----------|---------|-----------------|
| **DatabaseTable** | Empty state | Add `{rows.length === 0 ? <EmptyState /> : <table>}` |
| **DatabaseTable** | Loading skeleton | Wrap parent in Suspense w/ `<SkeletonTable>` fallback |
| **TransitMapContainer** | Empty state | Keep existing; enhance with icon + action button |
| **Patterns.tsx** | Suspense boundaries | Wrap `<DatabaseTabContent>` and transit map section |
| **Any async data** | General loading | Use `<LoadingFallback variant="skeleton">` |
| **Forms/modals** | Field skeletons | Use `<Skeleton width="100%" height="2.5rem">` |

---

### Component API Reference

#### EmptyState
```typescript
<EmptyState
  icon={<PackageX size={40} />}
  title="No entries found"
  description="Create your first entry to see it appear here."
  action={{ label: "Create", onClick: handleCreate }}
  variant="full"
/>
```

#### Skeleton (for building custom skeletons)
```typescript
<div className="rounded-lg border p-4">
  <Skeleton width="40%" height="1.5rem" /> {/* Title */}
  <div className="mt-2 space-y-2">
    <Skeleton height="1rem" />
    <Skeleton width="90%" height="1rem" />
  </div>
</div>
```

#### SkeletonTable
```typescript
<SkeletonTable columnCount={6} rowCount={8} headerVisible />
```

#### LoadingFallback
```typescript
<Suspense fallback={<LoadingFallback variant="skeleton" label="Analyzing patterns..." />}>
  <PatternsView />
</Suspense>
```

---

### Implementation Priority

**Phase 1 (High Priority — WQ-341 Part 1)**
1. Create `<EmptyState>` component
2. Enhance TransitMapContainer empty state with icon + action
3. Improve DatabaseTable empty state to use EmptyState component
4. Test in Patterns page

**Phase 2 (Medium Priority — WQ-341 Part 2)**
1. Create `<Skeleton>` base component
2. Create `<SkeletonTable>` specialized component
3. Create `<LoadingFallback>` Suspense wrapper
4. Add Suspense boundaries to Patterns.tsx DatabaseTabContent

**Phase 3 (Lower Priority — Future)**
1. Audit all async data loading points (searches, form submissions, etc.)
2. Apply pattern to filters, modals, and drawers
3. Implement staggered skeleton animations for large lists
4. Consider `loading.tsx` segments if migrating to RSC

---

### Design Language Alignment

All components should follow these principles from the design skill:

1. **Calm Progressive Disclosure**: Empty state is not scary; it's a gentle invitation
2. **Semantic Colors**: Icons use domain colors (food = sky, output = teal, etc.) but skeleton uses neutral surface colors
3. **Responsive**: All patterns work at mobile (small space) and desktop
4. **Accessibility**: Skeletons must have `aria-busy="true"`, empty states must be readable by screen readers
5. **Typography**: Match existing hierarchy (text-sm, text-muted for secondary)

---

### Files to Create/Modify

**New files:**
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Skeleton.tsx`
- `src/components/ui/SkeletonTable.tsx`
- `src/components/ui/LoadingFallback.tsx`

**Modify:**
- `src/components/ui/index.ts` (export new components)
- `src/components/patterns/database/DatabaseTable.tsx` (use EmptyState)
- `src/components/patterns/transit-map/TransitMapContainer.tsx` (enhance empty state)
- `src/pages/Patterns.tsx` (add Suspense boundaries)

---

### Summary

This plan provides a **scalable, design-aligned solution** for loading and empty states:

1. **EmptyState** — unified messaging (replace 2+ ad-hoc empty checks)
2. **Skeleton** — bone loaders with shimmer animation (leverage existing CSS)
3. **SkeletonTable** — specialized for data tables (DatabaseTable use case)
4. **LoadingFallback** — Suspense-safe wrapper (future async boundaries)

All components respect the design language, use existing animations, and integrate cleanly with current architecture.