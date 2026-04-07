# Food Page, Meal System & Navigation Restructure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure PDH from a 3-tab layout into a 4-tab + header-settings app with dedicated Home (quick logging), Track (daily log), Food (deep management), and Insights (patterns + Dr. Poo) pages.

**Architecture:** Extract the current monolithic Track page into four focused pages. Reuse existing nutrition components (NutritionCard search, FoodRow, useNutritionStore, WaterModal, LogFoodModal) as building blocks. Extend the Convex schema for meal templates (composite foodLibrary entries) and slot-scoped favourites. Navigation moves to a 4-tab bottom bar with Settings promoted to a header gear icon.

**Tech Stack:** React 19, Vite, TanStack Router, Convex (DB + backend), Tailwind v4, Zustand (ephemeral state), shadcn/ui, Fuse.js (search), Lucide icons.

**PRD:** `docs/prd/2026-04-06-food-page-and-meal-system.md`

**Design refs:** `docs/plans/archive/Worktree spec/user-annotations/pdh-light-mode-reference.png`, `pdh-dark-mode-reference.png`

---

## Non-Goals (Explicitly Out of Scope)

- **Meal system (P7)** — templates, base+modifiers, sizes, meal ordering UI, "Save as Meal" (deferred — user will weigh ingredients first)
- **AI text parser (P8)** — natural language input, template matching (depends on P7)
- **Voice capture (P9)** — Whisper integration, mic button (deferred — keyboard STT is interim)
- **Offline support** — app is online-only per CLAUDE.md
- **Full Insights redesign** — Insights = two sub-tabs (Patterns + Dr. Poo Report) for now
- **Desktop side-by-side layout** — TBD, mobile-first single-column for all new pages
- **Coach summary card** — open question (US-010 covers Dr. Poo only)
- **Barcode scanning / photo capture** — parking lot

---

## Wave Dependency Graph

```
Wave 0: Schema Extension (backend-only, no UI)
   │
   ├──► Wave 1: Navigation Restructure (US-001)
   │       │
   │       ├──► Wave 2: Track Simplification (US-011)  ─┐
   │       │                                              ├── can run in parallel
   │       ├──► Wave 3: Home Page (US-002–010)          ─┘
   │       │       │
   │       │       └──► Wave 4: Universal Interactions (US-018, US-019)
   │       │
   │       └──► Wave 5: Food Page (US-012–017)
   │               │
   │               └──► Wave 6: Seed Data (US-027)
```

**Parallel tracks after Wave 1:**

- Wave 2 and Wave 3 can run in parallel (different pages, no shared state)
- Wave 5 can start alongside Wave 3
- Wave 6 starts after Wave 5 schema work is done

---

## Wave 0: Schema Extension

**Purpose:** Extend Convex schema for composite meal templates and slot-scoped favourite tagging. Backend-only — no UI changes.

### W0-T01: Extend foodLibrary table for composite meals

**User Story:** US-020 (data model only — UI deferred to Wave 7)

**Files:**

- Modify: `convex/validators.ts` — add new validators
- Modify: `convex/schema.ts:360-367` — extend foodLibrary table
- Test: `convex/__tests__/schema.test.ts` (create if needed)

**Step 1: Add validators for structured ingredients, modifiers, and sizes**

Add to `convex/validators.ts`:

```typescript
export const structuredIngredientValidator = v.object({
  canonicalName: v.string(),
  quantity: v.number(),
  unit: v.string(), // g, ml, tsp, tbsp, slice, piece, shot, pinch
});

export const mealModifierValidator = v.object({
  canonicalName: v.string(),
  quantity: v.number(),
  unit: v.string(),
  isDefault: v.boolean(),
});

export const sizeAdjustmentValidator = v.object({
  canonicalName: v.string(),
  quantity: v.number(),
  unit: v.string(),
});

export const mealSizeValidator = v.object({
  name: v.string(),
  adjustments: v.array(sizeAdjustmentValidator),
});

export const slotDefaultValidator = v.object({
  slot: v.string(), // "breakfast" | "lunch" | "dinner" | "snacks"
  overrides: v.array(structuredIngredientValidator),
});
```

**Step 2: Extend foodLibrary table in schema**

In `convex/schema.ts`, widen the `foodLibrary` table definition:

```typescript
foodLibrary: defineTable({
  userId: v.string(),
  canonicalName: v.string(),
  type: v.union(v.literal("ingredient"), v.literal("composite")),
  ingredients: v.array(v.string()),
  // New fields (all optional for widen-migrate-narrow)
  structuredIngredients: v.optional(v.array(structuredIngredientValidator)),
  slotDefaults: v.optional(v.array(slotDefaultValidator)),
  modifiers: v.optional(v.array(mealModifierValidator)),
  sizes: v.optional(v.array(mealSizeValidator)),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_name", ["userId", "canonicalName"]),
```

**Step 3: Run typecheck to verify schema compiles**

Run: `bun run typecheck`
Expected: PASS (no type errors)

**Step 4: Run `npx convex dev` to verify schema pushes**

Run: `npx convex dev --once`
Expected: Schema pushed successfully

**Step 5: Commit**

```bash
git add convex/validators.ts convex/schema.ts
git commit -m "feat(schema): extend foodLibrary with composite meal fields (widen)"
```

---

### W0-T02: Add tspToGrams field to ingredientProfiles

**User Story:** US-020, US-027

**Files:**

- Modify: `convex/schema.ts:115-141` — add tspToGrams to ingredientProfiles

**Step 1: Add tspToGrams field**

In the `ingredientProfiles` table definition, add after `nutritionPer100g`:

```typescript
// Density-aware teaspoon-to-gram conversion
// (butter=4.7g/tsp, sugar=4.2g/tsp, jam=7g/tsp, etc.)
tspToGrams: v.optional(v.number()),
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(schema): add tspToGrams to ingredientProfiles for density conversions"
```

---

### W0-T03: Add foodFavouriteSlotTags to profiles

**User Story:** US-004

**Files:**

- Modify: `convex/schema.ts:333-358` — add foodFavouriteSlotTags
- Modify: `convex/validators.ts` — add validator

**Step 1: Add validator**

In `convex/validators.ts`:

```typescript
export const mealSlotValidator = v.union(
  v.literal("breakfast"),
  v.literal("lunch"),
  v.literal("dinner"),
  v.literal("snacks"),
);
```

**Step 2: Add field to profiles table**

In `convex/schema.ts`, add after `foodFavourites`:

```typescript
// Auto-learned meal slot associations for favourited foods.
// Key = canonicalName, value = array of meal slots where this food has been logged.
foodFavouriteSlotTags: v.optional(v.record(v.string(), v.array(mealSlotValidator))),
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add convex/schema.ts convex/validators.ts
git commit -m "feat(schema): add foodFavouriteSlotTags to profiles for slot-scoped favourites"
```

---

### W0-T04: Convex mutation to auto-tag favourite slot associations

**User Story:** US-004

**Files:**

- Modify: `convex/profiles.ts` (or wherever patchProfile lives) — add tagFavouriteSlot mutation
- Test: `convex/__tests__/profiles.test.ts`

**Step 1: Write failing test**

```typescript
test("tagFavouriteSlot adds slot to food's tag list", async () => {
  const t = convexTest(schema, modules);
  // Setup: create profile with a favourite food
  // Action: call tagFavouriteSlot("coffee", "breakfast")
  // Assert: foodFavouriteSlotTags["coffee"] includes "breakfast"
});

test("tagFavouriteSlot deduplicates slots", async () => {
  const t = convexTest(schema, modules);
  // Call tagFavouriteSlot("coffee", "breakfast") twice
  // Assert: "breakfast" appears only once
});
```

**Step 2: Run test to verify it fails**

Run: `cd convex && npx vitest run __tests__/profiles.test.ts --reporter=verbose`
Expected: FAIL

**Step 3: Implement tagFavouriteSlot mutation**

Internal mutation that:

1. Gets profile by userId
2. Reads existing `foodFavouriteSlotTags` (default `{}`)
3. Adds slot to the food's array if not already present
4. Patches profile

**Step 4: Run test to verify it passes**

Run: `cd convex && npx vitest run __tests__/profiles.test.ts --reporter=verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/profiles.ts convex/__tests__/profiles.test.ts
git commit -m "feat: add tagFavouriteSlot mutation for auto-learned slot associations"
```

---

## Wave 1: Navigation Restructure

**Purpose:** Transform the 3-tab header nav into a 4-tab bottom nav + header settings. Creates route stubs for new pages.

**User Story:** US-001

### W1-T01: Create page stubs for Home, Food, and Insights

**Files:**

- Create: `src/pages/Home.tsx` — empty page shell
- Create: `src/pages/Food.tsx` — empty page shell
- Create: `src/pages/Insights.tsx` — empty page shell with two sub-tabs (Patterns + Dr. Poo Report)

**Step 1: Create Home page stub**

```typescript
export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-(--text)">Home</h1>
      <p className="text-sm text-(--text-muted)">Quick logging — coming soon.</p>
    </div>
  );
}
```

**Step 2: Create Food page stub**

```typescript
export default function FoodPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-(--text)">Food</h1>
      <p className="text-sm text-(--text-muted)">Food management — coming soon.</p>
    </div>
  );
}
```

**Step 3: Create Insights page stub**

Insights wraps the existing PatternsPage and the Dr. Poo Report (moved later in Wave 2). For now, just render Patterns:

```typescript
import { lazy, Suspense, useState } from "react";

const PatternsPage = lazy(() => import("./Patterns"));

export default function InsightsPage() {
  const [tab, setTab] = useState<"patterns" | "drpoo">("patterns");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-(--text)">Insights</h1>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("patterns")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "patterns" ? "bg-(--surface-2) text-(--text)" : "text-(--text-muted)"}`}
        >
          Patterns
        </button>
        <button
          type="button"
          onClick={() => setTab("drpoo")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "drpoo" ? "bg-(--surface-2) text-(--text)" : "text-(--text-muted)"}`}
        >
          Dr. Poo Report
        </button>
      </div>
      {tab === "patterns" && (
        <Suspense fallback={null}>
          <PatternsPage />
        </Suspense>
      )}
      {tab === "drpoo" && (
        <p className="text-sm text-(--text-muted)">Dr. Poo Report — moved here in Wave 2.</p>
      )}
    </div>
  );
}
```

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Home.tsx src/pages/Food.tsx src/pages/Insights.tsx
git commit -m "feat: create page stubs for Home, Food, and Insights"
```

---

### W1-T02: Restructure route tree to 4-tab layout

**Files:**

- Modify: `src/routeTree.tsx` — change NAV_ITEMS, add routes, update GlobalHeader

**Step 1: Update NAV_ITEMS to 4 bottom tabs**

Replace the existing `NAV_ITEMS` array:

```typescript
import {
  Home,
  NotebookPen,
  UtensilsCrossed,
  BarChart3,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Home",
    icon: Home,
    activeTone: "text-teal-600 dark:text-teal-400",
    activeGlow: "from-teal-500/60 to-teal-400/0",
    activeBorder: "border-b-teal-500 dark:border-b-teal-400",
  },
  {
    to: "/track",
    label: "Track",
    icon: NotebookPen,
    activeTone: "text-sky-600 dark:text-sky-400",
    activeGlow: "from-sky-500/60 to-sky-400/0",
    activeBorder: "border-b-sky-500 dark:border-b-sky-400",
  },
  {
    to: "/food",
    label: "Food",
    icon: UtensilsCrossed,
    activeTone: "text-orange-600 dark:text-orange-400",
    activeGlow: "from-orange-500/60 to-orange-400/0",
    activeBorder: "border-b-orange-500 dark:border-b-orange-400",
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
    activeTone: "text-rose-600 dark:text-rose-400",
    activeGlow: "from-rose-500/60 to-rose-400/0",
    activeBorder: "border-b-rose-500 dark:border-b-rose-400",
  },
] as const;
```

**Step 2: Move Settings to header (gear icon)**

In `GlobalHeader`, after the ModeToggle and before UserButton, add a Settings gear link:

```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <Link
      to="/settings"
      className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-white/6 hover:text-(--text)"
      aria-label="Settings"
    >
      <Settings className="h-4 w-4" />
    </Link>
  </TooltipTrigger>
  <TooltipContent side="bottom">Settings</TooltipContent>
</Tooltip>
```

**Step 3: Update route definitions**

Change the `indexRoute` to render HomePage (lazy) instead of TrackPage. Add new routes:

```typescript
const HomePage = lazy(() => import("./pages/Home"));
const FoodPage = lazy(() => import("./pages/Food"));
const InsightsPage = lazy(() => import("./pages/Insights"));

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: () =>
    withBoundary("Home", <Suspense fallback={null}><HomePage /></Suspense>),
});

const trackRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/track",
  component: () => withBoundary("Track", <TrackPage />),
});

const foodRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/food",
  component: () =>
    withBoundary("Food", <Suspense fallback={null}><FoodPage /></Suspense>),
});

const insightsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/insights",
  component: () =>
    withBoundary("Insights", <Suspense fallback={null}><InsightsPage /></Suspense>),
});
```

**Step 4: Update route tree children**

```typescript
export const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    indexRoute,
    trackRoute,
    foodRoute,
    insightsRoute,
    patternsRoute, // keep for backward compat, redirect later
    settingsRoute,
    archiveRoute,
    menuRoute,
    ...devOnlyRoutes,
  ]),
]);
```

**Step 5: Update SyncedLogsProvider path check**

In `AppLayout`, update `requiresSyncedLogs` to include new paths:

```typescript
const requiresSyncedLogs =
  pathname === "/" ||
  pathname.startsWith("/track") ||
  pathname.startsWith("/food") ||
  pathname.startsWith("/insights") ||
  pathname.startsWith("/patterns") ||
  pathname.startsWith("/settings") ||
  pathname.startsWith("/menu") ||
  pathname.startsWith("/archive");
```

**Step 6: Move navigation from header to bottom bar**

Convert `GlobalHeader`'s inline nav into a fixed bottom tab bar component. The header retains: logo, dark mode toggle, settings gear, user button. The bottom bar renders `NAV_ITEMS` as a mobile-style tab bar with icons + labels.

Create the bottom bar inside `AppLayout`:

```typescript
function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/6 bg-[rgba(255,255,255,0.9)] backdrop-blur-xl dark:bg-[rgba(12,20,32,0.9)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-440 items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium transition-colors",
                isActive ? item.activeTone : "text-(--text-muted)",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Add `<BottomTabBar />` at the end of `AppLayout`'s `<Authenticated>` block. Add `pb-20` to `<main>` to prevent content from being hidden behind the bar.

**Step 7: Remove nav links from GlobalHeader**

Strip the `NavigationMenu` section from `GlobalHeader`. Keep: logo, dark mode toggle, settings gear, user button.

**Step 8: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Run: `bun run build`
Expected: Build succeeds

**Step 9: Browser verification**

Run: `bun run dev`

Verify:

- Bottom bar shows 4 tabs: Home, Track, Food, Insights
- Settings gear icon in header navigates to `/settings`
- Each tab navigates to its route
- Active tab is highlighted
- Deep links work (navigate directly to `/food`)

**Step 10: Commit**

```bash
git add src/routeTree.tsx
git commit -m "feat: restructure navigation to 4-tab bottom bar + header settings (US-001)"
```

---

### W1-T03: Add /patterns → /insights redirect

**Files:**

- Modify: `src/routeTree.tsx` — add redirect from old `/patterns` route

**Step 1: Add redirect**

Update the `patternsRoute` to redirect to `/insights`:

```typescript
const patternsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/patterns",
  beforeLoad: () => {
    throw redirect({ to: "/insights" });
  },
});
```

Import `redirect` from `@tanstack/react-router`.

**Step 2: Verify redirect works**

Navigate to `/patterns` → should land on `/insights`.

**Step 3: Commit**

```bash
git add src/routeTree.tsx
git commit -m "feat: redirect /patterns to /insights for backward compatibility"
```

---

## Wave 2: Track Simplification

**Purpose:** Strip the Track page down to Today's Log only. Move NutritionCard, QuickCapture, and Dr. Poo report to their new homes.

**User Story:** US-011

### W2-T01: Simplify Track page to Today's Log only

**Files:**

- Modify: `src/pages/Track.tsx` — remove 3-column layout, keep only Today's Log column
- Keep: date picker, yesterday/today toggle, log timeline

**Step 1: Identify the Today's Log section**

Read `src/pages/Track.tsx` and identify the right-column component that renders the vertical timeline of log entries. This is the section to keep.

**Step 2: Remove NutritionCard, BowelSection, QuickCapture, AiInsightsSection from Track**

Remove the 3-column grid layout. Replace with a single-column layout containing only:

- Track heading with date/time
- Date picker (yesterday/today toggle)
- Status row (BM count, fluid intake)
- Today's Log timeline (vertical list of all log entries)

Do NOT delete the components themselves — they will be reused by Home (Wave 3) and Insights (Dr. Poo).

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (components are still imported by other files or just not imported here)

**Step 4: Browser verification**

Run: `bun run dev`, navigate to `/track`

Verify:

- Track page shows only the daily log timeline
- No NutritionCard, no Dr. Poo, no QuickCapture
- Yesterday/Today toggle works
- Log entries are tappable to expand

**Step 5: Commit**

```bash
git add src/pages/Track.tsx
git commit -m "feat: simplify Track page to Today's Log only (US-011)"
```

---

### W2-T02: Move Dr. Poo Report into Insights page

**Files:**

- Modify: `src/pages/Insights.tsx` — render AiInsightsSection in the "Dr. Poo Report" tab

**Step 1: Import and render AiInsightsSection**

In Insights.tsx, replace the placeholder for the `drpoo` tab:

```typescript
import AiInsightsSection from "@/components/track/dr-poo/AiInsightsSection";

// In the drpoo tab:
{tab === "drpoo" && <AiInsightsSection />}
```

**Step 2: Verify AiInsightsSection works outside Track context**

Check that AiInsightsSection doesn't depend on Track-specific state (it uses its own hooks). If it requires SyncedLogsProvider, verify that's already wired up for `/insights` in the route tree (done in W1-T02 step 5).

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Browser verification**

Navigate to `/insights` → "Dr. Poo Report" tab → verify report renders correctly.

**Step 5: Commit**

```bash
git add src/pages/Insights.tsx
git commit -m "feat: move Dr. Poo Report into Insights page (US-011)"
```

---

## Wave 3: Home Page

**Purpose:** Build the Home page for lightning-fast food logging. Reuses existing nutrition components.

**User Stories:** US-002 through US-010

### W3-T01: Home page layout with greeting and nutrition summary

**User Story:** US-002

**Files:**

- Modify: `src/pages/Home.tsx` — build full layout
- Reuse: `src/components/track/nutrition/CircularProgressRing.tsx`

**Step 1: Build the greeting section**

Time-of-day greeting: "Good morning", "Good afternoon", "Good evening" with user's first name from Clerk.

**Step 2: Build compact nutrition summary**

Layout matches the PRD ASCII art:

```
┌──────────────────────────────────────────┐
│  ┌──────┐  795 / 1850 kcal  ████████░░  │
│  │ Ring │  1600 / 2000 ml   ██████████░  │
│  └──────┘                                │
└──────────────────────────────────────────┘
```

Reuse `CircularProgressRing` for the ring. Create two horizontal progress bars beside it:

- Orange bar for calories: `{consumed} / {goal} kcal`
- Blue bar for fluids: `{consumed} / {goal} ml`

Data comes from existing hooks: `useTodayNutritionSummary()` (or build from `useSyncedLogs`).
Goals come from `useProfileContext()` → `nutritionGoals`.

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Browser verification**

Navigate to `/` → verify greeting + nutrition summary render with live data.

**Step 5: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: Home page with greeting and nutrition summary (US-002)"
```

---

### W3-T02: Meal slot chips and food sections

**User Stories:** US-003, US-004, US-005, US-006

**Files:**

- Modify: `src/pages/Home.tsx` — add slot chips, favourites, recent, frequent sections
- Reuse: `src/components/track/nutrition/FoodRow.tsx`
- Reuse: `src/hooks/useProfile.ts` → `useFoodFavourites()`
- Modify or create: hook for recent/frequent foods scoped by slot

**Step 1: Add meal slot chips**

Row of tappable chips: Breakfast, Lunch, Dinner, Snack. Auto-detect active slot from time of day (reuse existing `getActiveMealSlot()` from useNutritionStore). Tapping overrides.

**Step 2: Add Favourites section (slot-scoped)**

- Read `foodFavourites` from profile
- Read `foodFavouriteSlotTags` to filter by active slot
- Show up to 7 items as `<FoodRow>` with heart toggle and (+) to stage
- "Show more" button loads next 7
- Empty state: "No favourites for {slot}"

**Step 3: Add Recent section (slot-scoped)**

- Query last 7 unique foods logged in the active slot (from synced logs)
- Same FoodRow format

**Step 4: Add Frequent section (slot-scoped)**

- Count food occurrences per slot from logs
- Sort by count, take top 7
- Same FoodRow format

**Step 5: Add food chips (compact view)**

Above the full sections, render tappable pill/chip buttons for top foods: favourites first, then frequent, then recent. Tapping a chip stages the food with default portion.

**Step 6: Wire up staging**

Initialize `useNutritionStore()` in Home. When (+) is tapped on any FoodRow:

1. Dispatch `ADD_TO_STAGING`
2. Dispatch `OPEN_STAGING_MODAL`
3. LogFoodModal renders for review

**Step 7: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 8: Browser verification**

Navigate to `/` → verify:

- Slot chips show and are tappable
- Favourites section shows heart-toggled foods
- Recent/Frequent sections populated from logs
- (+) button stages and opens LogFoodModal
- Heart toggle works (add/remove favourite)

**Step 9: Commit**

```bash
git add src/pages/Home.tsx src/hooks/useSlotScopedFoods.ts
git commit -m "feat: Home page meal slots, favourites, recent, frequent sections (US-003–006)"
```

---

### W3-T03: Modifier chips and Quick Capture on Home

**User Stories:** US-007, US-007b

**Files:**

- Modify: `src/pages/Home.tsx` — add modifier row and Quick Capture section
- Reuse: `src/components/track/quick-capture/QuickCapture.tsx`

**Step 1: Add modifier chip row**

Row of icon chips: Sleep, Stress, Mood, Activity, Medication, Cigarettes, Supplements. Tapping opens the existing logging flow for each (reuses the existing Track page modifier/habit logging components — QuickCaptureTile or similar).

**Step 2: Move Quick Capture section to Home**

Import and render `<QuickCapture />` on Home. This shows one-click logging tiles for regular items (brush teeth, coffee, tea, sleep). Verify it works outside the Track page context.

**Step 3: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: verify modifier chips and Quick Capture tiles work on Home.

**Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: modifier chips and Quick Capture on Home (US-007, US-007b)"
```

---

### W3-T04: Search bar and water button on Home

**User Stories:** US-008, US-009

**Files:**

- Modify: `src/pages/Home.tsx` — add search bar and water button
- Reuse: `src/components/track/nutrition/useNutritionStore.ts` → `searchFoodRegistry()`
- Reuse: `src/components/track/nutrition/WaterModal.tsx`

**Step 1: Add search bar**

Search bar with placeholder "Search or type a food..." and a "Log Food" button beside it. Typing triggers the existing `searchFoodRegistry()` function (Fuse.js fuzzy search). Results render as FoodRow components with heart toggle and (+) to stage.

This mirrors the existing NutritionCard search UX but placed on Home.

**Step 2: Add water quick-action**

Water droplet icon button near the nutrition summary. Tapping opens `<WaterModal />` (existing component). Logging water updates the fluid bar in real-time via the synced logs subscription.

**Step 3: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: search for a food → see results → tap (+) → staging works. Tap water → modal opens → log fluid → bar updates.

**Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: search bar and water quick-action on Home (US-008, US-009)"
```

---

### W3-T05: Dr. Poo touchpoints on Home

**User Story:** US-010

**Files:**

- Modify: `src/pages/Home.tsx` — add Ask Dr. Poo button and proactive card
- Reuse: `src/components/track/dr-poo/ConversationPanel.tsx`

**Step 1: Add "Ask Dr. Poo" button at top of Home**

Button with Dr. Poo branding. Tapping opens the conversation panel as a slide-out sheet or modal (not full navigation).

**Step 2: Add proactive Dr. Poo card at bottom of Home**

Card showing the latest AI-summarized message (max 150 chars). Two actions:

- "Got it" — dismisses the card (local state, not persisted)
- "Chat with Dr. Poo" — opens conversation panel with topic pre-loaded

The card content comes from the latest `aiAnalyses` insight or a time-based prompt (e.g. "Have you logged lunch?"). Start with a simple implementation: show the latest insight's summary if available, otherwise show a time-based prompt.

**Step 3: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: verify both touchpoints render and connect to the conversation system.

**Step 4: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: Dr. Poo ask button and proactive card on Home (US-010)"
```

---

## Wave 4: Universal Interactions

**Purpose:** Ensure heart toggles and (+) buttons work consistently on every food row across all views.

**User Stories:** US-018, US-019

### W4-T01: Audit and fix heart toggle everywhere

**User Story:** US-018

**Files:**

- Audit: all usages of `<FoodRow>` across `src/`
- Modify: any FoodRow instances missing `onToggleFavourite` prop
- Modify: `src/components/track/nutrition/FoodRow.tsx` — ensure heart always renders

**Step 1: Grep for all FoodRow usages**

Run: `grep -rn "FoodRow" src/ --include="*.tsx"`

For every instance, verify:

- `isFavourite` prop is provided (reads from `useFoodFavourites().isFavourite`)
- `onToggleFavourite` prop is provided (calls `useFoodFavourites().toggleFavourite`)
- Heart icon is not conditionally hidden

**Step 2: Fix FoodRow to always show heart**

If `onToggleFavourite` is optional and heart is conditionally rendered, change FoodRow so:

- Heart always renders (empty outline if not favourite, filled orange if favourite)
- If `onToggleFavourite` is not provided, make FoodRow require it (or provide a default noop that logs a warning in dev)

**Step 3: Wire up favourites in all views**

Ensure every parent that renders FoodRow passes:

- `isFavourite={isFavourite(canonicalName)}`
- `onToggleFavourite={toggleFavourite}`

Views to check:

- Home: favourites section, recent, frequent, search results, food chips
- Food page: search, favourites, filter
- NutritionCard search results
- FoodFilterView tabs

**Step 4: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: check every view where food rows appear → tap heart → verify toggle works → navigate to Favourites view → food appears/disappears.

**Step 5: Commit**

```bash
git add src/components/track/nutrition/FoodRow.tsx src/pages/Home.tsx src/pages/Food.tsx
git commit -m "fix: ensure heart toggle works on every food row (US-018)"
```

---

### W4-T02: Plus button stages and auto-navigates

**User Story:** US-019

**Files:**

- Modify: `src/components/track/nutrition/FoodRow.tsx` — ensure onAdd triggers staging
- Modify: `src/pages/Home.tsx` and `src/pages/Food.tsx` — auto-navigate to staging after add

**Step 1: Verify FoodRow's (+) button calls onAdd**

Already implemented. The `onAdd` prop dispatches `ADD_TO_STAGING`.

**Step 2: After ADD_TO_STAGING, auto-open staging modal**

In every parent that handles `onAdd`, chain the dispatch:

```typescript
const handleAddToStaging = (canonicalName: string) => {
  dispatch({ type: "ADD_TO_STAGING", canonicalName });
  dispatch({ type: "OPEN_STAGING_MODAL" });
};
```

This ensures the LogFoodModal opens immediately showing the staged item with quantities and running totals.

**Step 3: Verify staging area shows correctly**

LogFoodModal should show all staged items with:

- Name, portion, calories
- (+/-) quantity adjusters
- Running calorie/macro totals
- "Log" button to commit

**Step 4: Browser verification**

On Home and Food pages: tap (+) on any food → LogFoodModal opens → shows staged item → adjust quantity → log.

**Step 5: Commit**

```bash
git add src/pages/Home.tsx src/pages/Food.tsx
git commit -m "feat: plus button auto-opens staging modal on all food rows (US-019)"
```

---

## Wave 5: Food Page

**Purpose:** Build the dedicated Food page with search, favourites, filter views, food editing, and backfill logging.

**User Stories:** US-012 through US-017

### W5-T01: Food page shell with view switcher

**User Story:** US-012

**Files:**

- Modify: `src/pages/Food.tsx` — full page layout with view switcher

**Step 1: Build view switcher**

Four view buttons (icon tabs): Search (magnifying glass), Favourites (heart), Filter (funnel), All (list). Clicking a view replaces the entire content area (primary views, not accordion).

State: `activeView: "search" | "favourites" | "filter"`

When search query is empty and view is "search", show all foods (this replaces the "All" concept).

**Step 2: Initialize useNutritionStore for staging**

Food page uses its own `useNutritionStore()` instance for staging. LogFoodModal renders here too.

**Step 3: Add date/time picker for backfill logging (US-017)**

At the top of the Food page:

- "Logging for: [date] [meal slot]" with date picker and slot selector
- Defaults to current time and auto-detected slot
- User can change to earlier today or previous days
- This timestamp is used when staging items are logged

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Food.tsx
git commit -m "feat: Food page shell with view switcher and backfill date picker (US-012, US-017)"
```

---

### W5-T02: Food page search view (no cap)

**User Story:** US-013

**Files:**

- Modify: `src/pages/Food.tsx` — search view implementation
- Modify: `src/components/track/nutrition/useNutritionStore.ts` — remove 50-item cap from `searchFoodRegistry()`

**Step 1: Remove search result cap**

In `useNutritionStore.ts`, find the `searchFoodRegistry()` function. The current 50-item cap is a UX guardrail. With ~300-400 foods, querying all is fine. Remove the cap or raise to 500.

**Step 2: Build search view**

Renders when `activeView === "search"`:

- Search input at top
- Results as FoodRow list: name, zone badge, portion, kcal, heart toggle, (+) to stage
- Empty search shows all foods (alphabetical)

**Step 3: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: type in search → results appear → empty search shows all foods → (+) stages → heart toggles.

**Step 4: Commit**

```bash
git add src/pages/Food.tsx src/components/track/nutrition/useNutritionStore.ts
git commit -m "feat: Food page search view with no cap on results (US-013)"
```

---

### W5-T03: Food page favourites view

**User Story:** US-014

**Files:**

- Modify: `src/pages/Food.tsx` — favourites view
- Reuse: `src/components/track/nutrition/FavouritesView.tsx` patterns

**Step 1: Build favourites view**

Renders when `activeView === "favourites"`:

- Optional slot chips at top to filter by meal slot (uses `foodFavouriteSlotTags`)
- All favourited foods as FoodRow list
- Heart icon filled (tappable to unfavourite)
- (+) to stage
- Empty state: "No favourites yet — tap the heart on any food to add it"

Can reuse patterns from existing `FavouritesView.tsx` but render inline in the Food page content area (not as a sub-panel).

**Step 2: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: switch to Favourites view → see favourited foods → tap heart to remove → food disappears from list.

**Step 3: Commit**

```bash
git add src/pages/Food.tsx
git commit -m "feat: Food page favourites view with slot filtering (US-014)"
```

---

### W5-T04: Food page filter view

**User Story:** US-015

**Files:**

- Modify: `src/pages/Food.tsx` — filter view
- Reuse: `src/components/track/nutrition/FoodFilterView.tsx` patterns

**Step 1: Build filter view**

Renders when `activeView === "filter"`:

- Sub-filter chips: Recent, Frequent, Zone
- Recent: foods logged in last 7 days, sorted by last-logged
- Frequent: foods by total log count, descending
- Zone: zone chip toggles (Z1, Z2, Z3, Z4) — filter by food zone
- Filters can combine (e.g. Recent + Z1)
- Results as FoodRow list

**Step 2: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: switch to Filter view → toggle Recent → see recent foods → toggle Z1 → filtered results.

**Step 3: Commit**

```bash
git add src/pages/Food.tsx
git commit -m "feat: Food page filter view with recent/frequent/zone filters (US-015)"
```

---

### W5-T05: Food detail editing modal

**User Story:** US-016

**Files:**

- Create: `src/components/food/FoodDetailModal.tsx` — editing modal
- Modify: `src/pages/Food.tsx` — wire up modal on food name tap

**Step 1: Create FoodDetailModal**

Modal/sheet that opens when tapping a food name (not the heart or + button). Shows editable fields:

- Name (display name)
- Default portion size + unit
- kcal per 100g
- Protein, fat, carbs, fibre, sugar, salt per 100g

Save writes to `ingredientProfiles` table via a Convex mutation. Cancel discards changes.

**Step 2: Wire up in Food page**

When a food row's name is tapped (not heart or +), open `<FoodDetailModal canonicalName={...} />`.

May need to add an `onNameClick` prop to FoodRow, or wrap the name in a button.

**Step 3: Create/modify Convex mutation for updating ingredient profile**

If not already existing, create an `updateIngredientProfile` mutation that patches `ingredientProfiles` for the given user+canonicalName.

**Step 4: Run typecheck and verify**

Run: `bun run typecheck`
Expected: PASS

Browser: tap food name → modal opens → edit kcal → save → verify data persisted.

**Step 5: Commit**

```bash
git add src/components/food/FoodDetailModal.tsx src/pages/Food.tsx convex/ingredientProfiles.ts
git commit -m "feat: food detail editing modal on Food page (US-016)"
```

---

## Wave 6: Seed Data

**Purpose:** Pre-populate the user's food registry with ~30 known foods and accurate nutrition data.

**User Story:** US-027

### W6-T01: Populate foodPortionData with user's ~30 foods

**Files:**

- Modify: `shared/foodPortionData.ts` — add/verify entries for all ~30 foods
- Modify: `shared/foodRegistryData.ts` — add/verify registry entries

**Step 1: Audit existing entries**

Read `shared/foodPortionData.ts` and check which of the ~30 foods from the PRD already exist. The PRD lists:

**Bread & carbs:** toast, plain pasta, rice, wraps, breadsticks, tostadas, chaelitos, bread snacks
**Protein:** lean meat, lean fish, chicken broth, eggs, grated cheddar, sliced cheddar
**Fruit & veg:** banana, mashed pumpkin, mashed potato
**Spreads & fats:** butter, jam, peanut butter, cream cheese, olive oil
**Seasoning:** salt, pepper, fine herbs
**Drinks:** coffee (espresso), milk, sugar, tea, diluted juice, carbonated drink

**Step 2: Add missing entries with accurate nutrition data**

For each missing food, add to `FOOD_PORTION_DATA`:

```typescript
"food-name": {
  defaultPortionG: X,
  naturalUnit: "unit name",
  unitWeightG: Y,
  kcalPer100g: Z,
  proteinG100: ...,
  carbsG100: ...,
  fatG100: ...,
  sugarsG100: ...,
  fiberG100: ...,
},
```

Source nutrition data from McCance & Widdowson / USDA / Open Food Facts.

Also add corresponding entries to `FOOD_REGISTRY` in `foodRegistryData.ts` if missing.

**Step 3: Add teaspoon-to-gram data**

For density-varying ingredients (butter, jam, peanut butter, cream cheese, olive oil, sugar), add `tspToGrams` values. This data lives in the `FOOD_PORTION_DATA` structure for now (client-side). The Convex `ingredientProfiles.tspToGrams` field stores per-user overrides.

Standard values:

- butter: 4.7g/tsp
- jam: 7g/tsp
- peanut butter: 5.4g/tsp
- cream cheese: 5g/tsp (tbsp = 15g)
- olive oil: 4.5g/tsp (4.5ml)
- sugar: 4.2g/tsp
- salt: 6g/tsp

**Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/foodPortionData.ts shared/foodRegistryData.ts
git commit -m "feat: pre-populate food registry with 30 post-surgery foods and nutrition data (US-027)"
```

---

### W6-T02: Create Coffee and Toast meal templates (seed)

**User Story:** US-027 (last two acceptance criteria)

**Files:**

- Create: `convex/seedMealTemplates.ts` — one-time seed script or internal mutation

**Step 1: Write seed mutation**

Create an internal mutation that inserts two `foodLibrary` entries with `type: "composite"`:

**Coffee (250ml):**

```typescript
{
  userId, // resolved from auth
  canonicalName: "coffee-250ml",
  type: "composite",
  ingredients: ["espresso", "water", "milk"],
  structuredIngredients: [
    { canonicalName: "espresso", quantity: 1, unit: "shot" },
    { canonicalName: "water", quantity: 200, unit: "ml" },
    { canonicalName: "milk", quantity: 50, unit: "ml" },
  ],
  modifiers: [
    { canonicalName: "sugar", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "espresso", quantity: 1, unit: "shot", isDefault: false },
  ],
  sizes: [
    { name: "250ml cup", adjustments: [] },
    { name: "450ml cup", adjustments: [{ canonicalName: "water", quantity: 350, unit: "ml" }] },
  ],
  createdAt: Date.now(),
}
```

**Toast (2 slices):**

```typescript
{
  userId,
  canonicalName: "toast-2-slices",
  type: "composite",
  ingredients: ["toast"],
  structuredIngredients: [
    { canonicalName: "toast", quantity: 2, unit: "slice" },
  ],
  modifiers: [
    { canonicalName: "butter", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "jam", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "peanut butter", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "cream cheese", quantity: 10, unit: "g", isDefault: false },
  ],
  sizes: [],
  createdAt: Date.now(),
}
```

**Step 2: Run the seed**

Run via Convex dashboard or `npx convex run seedMealTemplates:seed`.

**Step 3: Verify templates exist in DB**

Query `foodLibrary` for the two composites.

**Step 4: Commit**

```bash
git add convex/seedMealTemplates.ts
git commit -m "feat: seed Coffee and Toast meal templates (US-027)"
```

---

## Deferred Waves (Not in This Plan)

### Wave 7: Meal System (P7) — DEFERRED

**User Stories:** US-020 (UI), US-021, US-022, US-023
**Why deferred:** User needs to establish baseline weights and recipes manually before the app can model them. Schema fields are already added in Wave 0.
**Scope:** Meal template builder UI, meal ordering flow (McDonald's model), "Save as Meal" from logging history.

### Wave 8: AI Text Parser (P8) — DEFERRED

**User Stories:** US-024, US-025
**Why deferred:** Depends on Wave 7 (meal templates must exist for parser to match against).
**Scope:** Convex action calling Claude API, filler word stripping, self-correction handling, confirmation step.

### Wave 9: Voice Capture (P9) — DEFERRED

**User Story:** US-026
**Why deferred:** Keyboard speech-to-text is the interim solution.
**Scope:** Whisper integration, mic button, AI cleanup pipeline.

---

## Verification Checklist (Per Wave)

After each wave is complete, run all of these:

```bash
# Type safety
bun run typecheck

# Lint + format
bun run lint:fix && bun run format

# Build
bun run build

# Unit tests
cd convex && npx vitest run

# Dev server smoke test
bun run dev
# Manually verify in browser at localhost:3005
```

---

## File Impact Summary

### New Files

| File                                      | Wave | Purpose                                   |
| ----------------------------------------- | ---- | ----------------------------------------- |
| `src/pages/Home.tsx`                      | W1   | Home page (quick logging)                 |
| `src/pages/Food.tsx`                      | W1   | Food page (deep management)               |
| `src/pages/Insights.tsx`                  | W1   | Insights page (Patterns + Dr. Poo Report) |
| `src/components/food/FoodDetailModal.tsx` | W5   | Food editing modal                        |
| `src/hooks/useSlotScopedFoods.ts`         | W3   | Recent/frequent foods scoped by meal slot |
| `convex/seedMealTemplates.ts`             | W6   | One-time seed for Coffee/Toast templates  |
| `convex/__tests__/profiles.test.ts`       | W0   | Tests for slot tagging mutation           |

### Modified Files

| File                                                  | Waves | Changes                                              |
| ----------------------------------------------------- | ----- | ---------------------------------------------------- |
| `convex/schema.ts`                                    | W0    | Extend foodLibrary, ingredientProfiles, profiles     |
| `convex/validators.ts`                                | W0    | Add structured ingredient, modifier, size validators |
| `convex/profiles.ts`                                  | W0    | Add tagFavouriteSlot mutation                        |
| `src/routeTree.tsx`                                   | W1    | 4-tab bottom nav, header settings, new routes        |
| `src/pages/Track.tsx`                                 | W2    | Strip to Today's Log only                            |
| `src/components/track/nutrition/FoodRow.tsx`          | W4    | Ensure heart always renders                          |
| `src/components/track/nutrition/useNutritionStore.ts` | W5    | Remove 50-item search cap                            |
| `shared/foodPortionData.ts`                           | W6    | Add ~30 foods with nutrition data                    |
| `shared/foodRegistryData.ts`                          | W6    | Add ~30 food registry entries                        |

---

## Sub-Agent Dispatch Strategy

For subagent-driven development, these waves can be parallelized:

**Batch 1 (sequential):** Wave 0 (schema) → Wave 1 (navigation)
**Batch 2 (parallel after Wave 1):**

- Agent A: Wave 2 (Track simplification)
- Agent B: Wave 3 (Home page — tasks T01–T05 sequential)
- Agent C: Wave 5 (Food page — tasks T01–T05 sequential)

**Batch 3 (after Waves 3+5):** Wave 4 (universal interactions — cross-cutting audit)
**Batch 4 (after Wave 5):** Wave 6 (seed data)

Each agent should:

1. Read this plan document first
2. Read the PRD for their assigned user stories
3. Read CLAUDE.md for project conventions
4. Read `convex/_generated/ai/guidelines.md` for Convex patterns
5. Run `bun run typecheck` and `bun run build` after each task
6. Commit after each task with descriptive message
