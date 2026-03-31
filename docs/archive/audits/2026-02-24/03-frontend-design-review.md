# Frontend Design Review: Caca Traca

**Date:** 2026-02-24
**Reviewer:** Senior Frontend Design & UI/UX Expert
**Scope:** Comprehensive review of all source files under `src/`
**Stack:** React 19, TypeScript, Tailwind CSS 4, Vite, Zustand, Convex

---

## Executive Summary

Caca Traca is a health tracking application for post-ostomy-reconnection recovery. The frontend demonstrates a **strong visual identity** with its "Aurora Glass" design system -- a cohesive dark-mode glassmorphism aesthetic with section-specific color coding. The CSS token architecture is thorough, the animation system is tasteful, and the component hierarchy is well-structured for the domain.

However, the review identifies several areas requiring attention: **critical accessibility gaps** (missing focus management, missing form labels, inadequate keyboard navigation), **responsive design breakdowns** on medium viewports, **inconsistent styling approaches** (mixing inline styles, CSS custom properties, and Tailwind classes in unpredictable ways), and **high data-entry friction** in the fluid and health input sections. The Settings page is also excessively long for a mobile device.

**Overall Grade: B+** -- Visually impressive with strong domain-specific UX ideas, but held back by accessibility debt and inconsistent implementation patterns.

---

## Strengths

### S1. Exceptional Color Token Architecture

**Location:** `/src/index.css` (lines 67-230, 235-381)

The dual-theme token system is remarkably thorough. Each section (food, bowel, activity, etc.) has a complete set of four tokens (`--section-*`, `--section-*-muted`, `--section-*-border`, `--section-*-glow`), and the light-mode counterparts are carefully tuned for readability. This enables strong visual wayfinding throughout the app -- users can immediately identify which section they are in by color alone.

### S2. Aurora Glass Aesthetic is Cohesive

**Location:** `/src/index.css` (lines 386-468, 542-748)

The noise texture overlay, aurora gradient mesh, and glass card system create a visually distinctive and premium feel. The `body::before` and `body::after` pseudo-elements layer nicely, and the 12-second aurora animation is subtle enough not to distract. The section-specific glass cards (`glass-card-food`, `glass-card-bowel`, etc.) with colored top borders and inset glows provide excellent visual grouping.

### S3. Section Header Pattern is Consistent

**Location:** `/src/index.css` (lines 753-775), used across all section components

The `.section-header` / `.section-icon` / `.section-title` pattern is applied uniformly across every section component. This creates a predictable and learnable interface pattern.

### S4. Bristol Stool Scale UI is Thoughtful

**Location:** `/src/components/BristolScale.tsx`, `/src/components/track/BowelSection.tsx`

The Bristol scale implementation with inline SVG illustrations, a color-coded spectrum bar with an animated dot indicator, and progressive disclosure (detail fields appear only after selecting a type) is a well-considered domain-specific UI pattern. The `aria-label` attributes on the SVGs and `aria-pressed` on buttons are good accessibility starting points.

### S5. Observation Window is an Excellent UX Innovation

**Location:** `/src/components/track/ObservationWindow.tsx`

The concept of showing foods currently "in transit" with real-time progress bars is a genuinely novel and useful feature for this domain. The transit vs. testing window distinction, color-coded progress, and elapsed time display create high situational awareness.

### S6. Error Boundary per Route

**Location:** `/src/App.tsx` (lines 45-98)

The `RouteErrorBoundary` wrapping each route with a recovery button is a solid resilience pattern. The error UI is appropriately styled and provides clear recovery options.

### S7. Staggered Reveal Animation

**Location:** `/src/index.css` (lines 911-936)

The CSS-only staggered animation system (`.stagger-reveal > *:nth-child(n)`) provides pleasant entrance animations without JavaScript overhead. The 70ms stagger interval is well-calibrated.

---

## Findings

### Critical Severity

#### C1. Modal Lacks Focus Trap and Escape Key Handling

**Location:** `/src/components/PreSyncCheckInModal.tsx` (lines 66-242)
**Impact:** Users relying on keyboard navigation or screen readers cannot interact with the modal correctly. Focus can escape behind the modal, and there is no focus restoration when it closes.

The modal has `role="dialog"` and `aria-modal="true"` (good), but:

- No focus trap implementation -- Tab will escape the modal into the background page.
- Clicking the backdrop calls `handleSkip` but keyboard Escape is not handled.
- No `autoFocus` on the first interactive element when the modal opens.
- Focus is not restored to the trigger element on close.

**Recommendation:** Implement a focus trap (e.g., using `@base-ui/react` Dialog or a minimal `useFocusTrap` hook). Add `onKeyDown` handler for Escape. Auto-focus the first pill button on open.

#### C2. No Keyboard Navigation for Bristol Scale Picker

**Location:** `/src/components/track/BowelSection.tsx` (lines 360-403)
**Impact:** The 7 Bristol type buttons are individually focusable but lack arrow-key navigation. Screen reader users have no way to understand this is a radio-group-like control. There is no `role="radiogroup"` or `role="radio"`.

**Recommendation:** Wrap in `role="radiogroup"` with `aria-label="Bristol stool type"`. Individual buttons should have `role="radio"` with `aria-checked`. Implement arrow key navigation to move between options.

#### C3. Severity/Volume Scales Lack Group Semantics

**Location:** `/src/components/track/BowelSection.tsx` (lines 135-265)
**Impact:** The `SeverityScale` and `VolumeScale` components render groups of toggle buttons without `role="radiogroup"`. While `aria-pressed` is used, these behave as single-select groups, not toggles. Screen readers will not communicate the mutual exclusivity.

**Recommendation:** Use `role="radiogroup"` with `role="radio"` and `aria-checked` instead of `aria-pressed`.

#### C4. Inline Style Hover Handlers Create Accessibility Barriers

**Location:** `/src/components/track/FluidSection.tsx` (lines 93-98, 117-126), `/src/components/track/QuickFactors.tsx` (lines 77-84)
**Impact:** Hover styles are applied via JavaScript `onMouseEnter`/`onMouseLeave` handlers using `e.currentTarget.style`. These styles are not triggered by keyboard focus, creating invisible focus states for keyboard users. Additionally, this pattern is fragile -- if the component re-renders during hover, styles can get stuck.

**Recommendation:** Replace all inline style hover handlers with Tailwind hover/focus utilities: `hover:bg-[var(--section-fluid-muted)] focus-visible:bg-[var(--section-fluid-muted)]`. This is both more maintainable and accessible.

---

### High Severity

#### H1. FluidSection Presets Are Not Sourced from User Settings

**Location:** `/src/components/track/FluidSection.tsx` (line 6)
**Impact:** `FLUID_PRESETS` is hardcoded as `["Aquarius", "Coffee", "Coke", "Juice"]`, yet the Settings page (`/src/pages/Settings.tsx` lines 719-763) allows users to configure custom fluid presets stored in the Zustand store. The FluidSection ignores these settings entirely.

**Recommendation:** Replace the hardcoded `FLUID_PRESETS` with the user's configured `fluidPresets` from the store: `const fluidPresets = useStore(state => state.fluidPresets)`.

#### H2. Health Section Inputs Lack Visible Labels

**Location:** `/src/components/track/ActivitySection.tsx` (lines 100-175)
**Impact:** The Walk, Sleep, and Weight inputs have label text rendered as inline `<span>` elements, not proper `<label>` elements. Screen readers cannot associate the inputs with their labels. The `placeholder` prop ("mins", "hrs", "kg") is the only hint, which disappears on input.

**Recommendation:** Wrap each input with an associated `<label>`, or use `aria-label` as a minimum. Consider adding visible persistent labels above or beside each input.

#### H3. Three-Column Desktop Layout Lacks Medium Breakpoint

**Location:** `/src/pages/Track.tsx` (line 365)
**Impact:** The Track page uses `grid-cols-1 xl:grid-cols-[3fr_4fr_3fr]`. Between `md` (768px) and `xl` (1280px), the entire page is a single column, which wastes significant horizontal space on tablets and medium laptops. At 1024px, the single-column layout forces excessive scrolling.

**Recommendation:** Add a `lg:grid-cols-2` breakpoint to create a 2-column intermediate layout, e.g., `grid-cols-1 lg:grid-cols-[1fr_1fr] xl:grid-cols-[3fr_4fr_3fr]`.

#### H4. Settings Page is Excessively Long on Mobile

**Location:** `/src/pages/Settings.tsx` (207-993)
**Impact:** The Settings page renders 7 collapsible card sections in a single scroll. On mobile, even with sections collapsed, this is a very long page. There is no navigation aid or jump-to-section mechanism. Users looking for a specific setting must scroll and scan.

**Recommendation:** Add anchor links at the top of the page, or implement a tabbed/accordion navigation pattern that only shows one section at a time on mobile.

#### H5. `any` Type in Error Handlers Masks Error Information

**Location:** `/src/pages/Track.tsx` (lines 330, 339, 343), `/src/components/track/FluidSection.tsx` (line 32), `/src/components/track/FoodSection.tsx` (line 32)
**Impact:** Multiple `catch (err: any)` patterns mask TypeScript type safety. While this is primarily a code quality issue, it impacts UX when error messages are generic ("Failed to log food.") because the actual error type is not properly inspected.

**Recommendation:** Use `catch (err: unknown)` with proper type narrowing: `const message = err instanceof Error ? err.message : "Unknown error"`.

#### H6. No Loading State for AI Analysis History

**Location:** `/src/components/patterns/MealPlanSection.tsx`, `/src/components/patterns/NextFoodCard.tsx`, `/src/components/patterns/ReportArchive.tsx`
**Impact:** These components show "No meal plan yet" / "No recommendation yet" / "No reports yet" immediately on mount, even while the Convex query for `useAiAnalysisHistory` is still loading. This creates a flash of empty state before data appears, which feels like a missing feature rather than a loading state.

**Recommendation:** Check if `aiHistory === undefined` (loading) vs. empty array (loaded but no data) and show a skeleton or spinner during loading.

#### H7. Toaster Configuration Uses Defaults

**Location:** `/src/App.tsx` (line 225)
**Impact:** The `<Toaster />` component from `sonner` is used with default positioning and styling. In the dark "Aurora Glass" theme, the default toast styling may not match the app's design language. Toast position defaults to bottom-right, which on mobile may overlap with content.

**Recommendation:** Configure the Toaster with theme-appropriate styling: `<Toaster position="top-center" toastOptions={{ className: "glass-card" }} />`. Test toast appearance against both light and dark themes.

---

### Medium Severity

#### M1. Inconsistent Styling Approaches Across Components

**Location:** Multiple files
**Impact:** The codebase mixes three styling approaches inconsistently:

1. **Tailwind utility classes** (most components): `className="text-[var(--section-food)]"`
2. **Inline `style` objects** (BowelSection, FluidSection, QuickFactors): `style={{ color: "var(--section-food)" }}`
3. **CSS classes** (index.css): `.glass-card-food`, `.section-header`

Some components use all three simultaneously. For example, `FoodSection.tsx` line 67-72 uses an inline `style` on the Button that sets `background`, `color`, and `boxShadow` with hardcoded hex values (`#f97068`, `#f0ddd8`) instead of design tokens.

**Recommendation:** Establish a clear hierarchy: use CSS classes for reusable patterns, Tailwind utilities for one-off styles, and inline styles only for truly dynamic values (computed at runtime). Audit all hardcoded hex values and replace with token references.

#### M2. Hardcoded Colors in FoodSection Button

**Location:** `/src/components/track/FoodSection.tsx` (lines 68-72)
**Impact:** The "Log Food" button uses hardcoded hex colors `#f97068` and `#f0ddd8` instead of the `--section-food` token. This means the button will not adapt to light theme changes and diverges from the design system.

```tsx
style={{
  border: "none",
  background: "#f97068",
  color: "#f0ddd8",
  boxShadow: "0 0 12px var(--section-food-glow)",
}}
```

**Recommendation:** Replace with `background: "var(--section-food)"` and `color: "#ffffff"` or a proper foreground token.

#### M3. Navigation Items Hidden on Mobile Without Alternative

**Location:** `/src/App.tsx` (line 165)
**Impact:** Navigation labels are hidden below `md` breakpoint (`className="hidden md:inline"`), showing only icons. While the icons have visual meaning, there is no tooltip or `aria-label` on the Link to explain what each icon means to new users or screen reader users.

**Recommendation:** Add `aria-label` to each navigation Link and consider adding a tooltip on hover/focus for icon-only display.

#### M4. Select Dropdown Arrow Only Visible in Dark Theme

**Location:** `/src/index.css` (lines 1055-1065)
**Impact:** The custom select arrow SVG uses `stroke='%232dd4bf'` (teal), which is hardcoded and does not adapt to light theme. On the light cream background, the teal arrow will be visible but may have insufficient contrast against certain field background colors.

**Recommendation:** Use `currentColor` in the SVG or provide separate light/dark theme arrow SVGs.

#### M5. Fluid Input Width Too Narrow for 4-Digit Milliliters

**Location:** `/src/components/track/FluidSection.tsx` (line 75)
**Impact:** The fluid ml input is `w-16` (64px) wide. When entering 4-digit values like "1500" (common for daily fluid intake), the text overflows or is hard to read. The `text-center text-xs` combination makes this worse.

**Recommendation:** Increase to `w-20` or `w-24` and use `text-sm` for better readability.

#### M6. Logo Image Dimensions Mismatch

**Location:** `/src/App.tsx` (lines 119-124)
**Impact:** The logo `<img>` specifies `width={36} height={36}` but applies CSS classes `h-16 w-16`. This creates a layout shift as the browser initially reserves space for 36x36 then expands to 64x64. The image loads as `header-logo-72.webp` (72px source), adding a third size mismatch.

**Recommendation:** Align the HTML `width`/`height` attributes with the CSS dimensions to prevent layout shift: `width={64} height={64}` with `className="h-16 w-16"`.

#### M7. `dark:` Tailwind Prefix Used Inconsistently

**Location:** Various components (e.g., `BristolScale.tsx` lines 18-68, `TodayLog.tsx` line 249)
**Impact:** Some components use `dark:` prefixed classes (e.g., `text-red-600 dark:text-red-400`) while the app uses `data-theme="dark"` for theming (defined via `@custom-variant dark` in CSS). The `dark:` variant maps to `[data-theme="dark"]` via the custom variant definition, so it works -- but some components bypass this entirely using `var(--section-*)` tokens. The inconsistency makes it harder to reason about which approach applies where.

**Recommendation:** Standardize on the CSS custom property approach (`var(--section-*)`) for all theme-aware colors. Reserve `dark:` prefix only for UI component library primitives that came with it pre-configured.

#### M8. Form Validation is Toast-Only

**Location:** `/src/components/track/FoodSection.tsx` (line 24), `/src/components/track/FluidSection.tsx` (line 22)
**Impact:** Validation errors (empty food name, invalid ml) are communicated only via toast notifications. There is no inline validation message, no red border on the invalid field, and no `aria-invalid` attribute. Users must read the toast to understand what went wrong.

**Recommendation:** Add inline error states: border color change to `var(--red)`, an error message beneath the input, and `aria-invalid="true"` on the field. Keep the toast as a supplementary notification.

#### M9. Confetti Particles Use Absolute Positioning Without Cleanup Guard

**Location:** `/src/components/Confetti.tsx` (lines 61-73)
**Impact:** If the component unmounts before the 2-second timeout completes, `setParticles([])` and `onComplete()` will fire on an unmounted component. While React 19 may silently handle this, it can cause unexpected state updates in parent components.

**Recommendation:** Guard the timeout callback with a mounted ref, or use the cleanup function return from `useEffect` to clear the timeout (which is partially done, but `setParticles` may still fire).

#### M10. ScrollArea Used in TodayLog But Not Configured with MaxHeight

**Location:** `/src/components/track/TodayLog.tsx` (imported at line 21)
**Impact:** The `ScrollArea` import suggests scrollable content, but without a defined max-height on the container, the scroll area may expand indefinitely on the desktop sticky sidebar (`xl:sticky xl:top-4`), potentially pushing it beyond the viewport.

**Recommendation:** Add a `max-h-[calc(100vh-6rem)]` (or similar) to the TodayLog wrapper on desktop to ensure it scrolls within the viewport bounds when sticky.

---

### Low Severity

#### L1. Unused Component: `FoodDrinkSection.tsx`

**Location:** `/src/components/track/FoodDrinkSection.tsx`
**Impact:** This component is a combined food+drink section that appears to be an older version replaced by the separate `FoodSection.tsx` and `FluidSection.tsx`. It is not imported anywhere in the codebase.

**Recommendation:** Remove the file to reduce codebase surface area and avoid confusion.

#### L2. Unused Components: `SummaryCard.tsx`, `BadgeShowcase.tsx`, `StreakBadge.tsx`, `DailyProgress.tsx`

**Location:** `/src/components/SummaryCard.tsx`, `/src/components/BadgeShowcase.tsx`, `/src/components/StreakBadge.tsx`, `/src/components/DailyProgress.tsx`
**Impact:** These components are defined but appear to be unused or replaced by the patterns page components. `SummaryCard` was likely superseded by `DaySummaryCard` on the Patterns page.

**Recommendation:** Verify these are truly unused (search for imports) and remove if so.

#### L3. Backtick Characters in UI Text

**Location:** `/src/pages/Settings.tsx` (lines 946-949)
**Impact:** The help text uses backtick characters in user-facing text: "Goal `0` means track-only" and "Choose `Cap` for scarcity habits". Backticks are a developer convention and look odd in a consumer UI.

**Recommendation:** Replace with proper typographic quotes or bold formatting.

#### L4. Duplicate Fluid and Meals Section Colors

**Location:** `/src/index.css` (lines 207-217, 358-368)
**Impact:** `--section-fluid` and `--section-meals` use identical color values (`#38bdf8` dark, `#0284c7` light). While intentional (both are sky blue), having separate token sets that are identical increases maintenance burden without visual benefit.

**Recommendation:** Consider whether these truly need to be separate. If they should differ in the future, keep them; otherwise, alias one to the other.

#### L5. Font Loading Without `font-display` Fallback

**Location:** `/index.html` (lines 9-12)
**Impact:** Google Fonts are loaded with `display=swap`, which is good. However, three font families (Nunito, Bricolage Grotesque, JetBrains Mono) with multiple weights create a significant initial download. This may cause visible FOIT/FOUT on slower connections.

**Recommendation:** Consider subsetting fonts or using `font-display: optional` for the mono font. Preload the primary font (Nunito) for faster initial render.

#### L6. `WeightSection.tsx` Uses `glass-card-weight` Class Not Defined in CSS

**Location:** `/src/components/track/WeightSection.tsx` (line 48)
**Impact:** The class `glass-card-weight` does not exist in `index.css`. The `.glass-card` base will still apply, but the weight section will not get its themed top border and inset glow like other sections.

**Recommendation:** Add the `glass-card-weight` definition to `index.css` following the same pattern as other section cards, or use `glass-card-activity` if weight should share the lavender theme.

#### L7. Error Boundary Background Color is Destructive Color

**Location:** `/src/App.tsx` (line 70)
**Impact:** The error boundary uses `bg-[var(--red)]` as the background color, making the entire card bright red. This is visually alarming. The text on this red background may also have contrast issues.

**Recommendation:** Use `bg-[var(--red)]/10` or `bg-[var(--color-status-risky-bg)]` for the background, with `border-[var(--red)]` for the border. Use `text-[var(--red)]` for the heading.

#### L8. Motion Library Animations Not Reduced for prefers-reduced-motion

**Location:** `/src/components/track/BowelSection.tsx` (lines 437-520), `/src/components/Confetti.tsx`
**Impact:** The `motion/react` (Framer Motion) animations for the bowel detail reveal and confetti burst do not check `prefers-reduced-motion`. Users who have requested reduced motion in their OS settings will still see sliding, scaling, and particle animations.

**Recommendation:** Use Motion's `useReducedMotion()` hook and conditionally disable animations, or set `transition={{ duration: 0 }}` when reduced motion is preferred.

---

## Design System Consistency Assessment

| Aspect            | Rating    | Notes                                                                |
| ----------------- | --------- | -------------------------------------------------------------------- |
| Color tokens      | Excellent | Comprehensive dual-theme system with section accents                 |
| Typography        | Good      | Display + sans + mono fonts used consistently for headings/body/data |
| Spacing           | Good      | Consistent use of `space-y-3`, `space-y-5`, `gap-2`, `gap-3`         |
| Border radius     | Good      | Token-based (`--radius-*`) used via glass cards                      |
| Shadows           | Good      | Shadow tokens defined and used for glass cards                       |
| Icons             | Excellent | Lucide icons used consistently with appropriate sizing               |
| Animations        | Good      | CSS + Motion library, generally smooth and purposeful                |
| Glass card system | Excellent | Well-structured base + variant pattern                               |
| Section headers   | Excellent | Uniform pattern across all sections                                  |
| Button styles     | Fair      | Mix of shadcn Button variants and custom inline-styled buttons       |
| Input styles      | Fair      | shadcn Input used sometimes, raw inputs other times                  |
| Form patterns     | Poor      | No consistent validation UI, mixed label approaches                  |

---

## Health App UX Assessment

| Aspect                       | Rating    | Notes                                                                  |
| ---------------------------- | --------- | ---------------------------------------------------------------------- |
| Data entry friction (food)   | Good      | Single input + Enter to log is fast                                    |
| Data entry friction (fluid)  | Good      | Preset buttons reduce taps                                             |
| Data entry friction (bowel)  | Excellent | Progressive disclosure, visual Bristol picker                          |
| Data entry friction (habits) | Excellent | One-tap Quick Capture is very low friction                             |
| Data entry friction (health) | Fair      | Walk/Sleep/Weight crammed into one row, Enter-to-log is undiscoverable |
| Observation window           | Excellent | Novel and genuinely useful real-time tracking                          |
| AI integration               | Good      | Progress overlay, collapsible reports, reply input                     |
| Food safety database         | Good      | Sortable, filterable, responsive mobile cards                          |
| Celebration/gamification     | Good      | Confetti + sound + badges, configurable                                |
| Offline support              | Good      | IndexedDB persistence via Zustand + Convex sync                        |

---

## Recommendations Summary (Prioritized)

1. **Implement focus trapping** in PreSyncCheckInModal (C1)
2. **Add proper ARIA roles** to Bristol scale and severity selectors (C2, C3)
3. **Replace inline style hover handlers** with CSS-based hover/focus states (C4)
4. **Connect FluidSection to user's configured presets** from store (H1)
5. **Add proper form labels** to all inputs, especially Health section (H2)
6. **Add responsive intermediate breakpoint** for Track page (H3)
7. **Add loading states** for AI history queries (H6)
8. **Standardize styling approach** -- prefer tokens over hardcoded hex (M1, M2)
9. **Add inline validation states** to form inputs (M8)
10. **Add `prefers-reduced-motion` support** to animations (L8)
11. **Remove unused components** (L1, L2)
12. **Add missing `glass-card-weight` CSS class** (L6)

---

## File Index

Key files reviewed:

- `/src/index.css` -- Design token system, glass card system, animations
- `/src/App.tsx` -- Global header, navigation, routing, error boundary
- `/src/main.tsx` -- App entry point, providers
- `/src/pages/Track.tsx` -- Main tracking page layout
- `/src/pages/Patterns.tsx` -- Patterns/analytics page layout
- `/src/pages/Settings.tsx` -- Settings page with 7 collapsible sections
- `/src/components/track/FoodSection.tsx` -- Food input component
- `/src/components/track/FluidSection.tsx` -- Fluid input with presets
- `/src/components/track/BowelSection.tsx` -- Bristol scale picker with detail form
- `/src/components/track/ActivitySection.tsx` -- Walk/Sleep/Weight combined input
- `/src/components/track/QuickFactors.tsx` -- One-tap habit tracker
- `/src/components/track/TodayLog.tsx` -- Grouped log stream with edit/delete
- `/src/components/track/ObservationWindow.tsx` -- Real-time food transit tracker
- `/src/components/track/WeightSection.tsx` -- Standalone weight input
- `/src/components/track/WeightTrendCard.tsx` -- Weight trend display
- `/src/components/track/FoodDrinkSection.tsx` -- Legacy combined food/drink (unused)
- `/src/components/AiInsightsSection.tsx` -- AI analysis display with reply
- `/src/components/BristolScale.tsx` -- Bristol scale definitions and SVG illustrations
- `/src/components/Confetti.tsx` -- Celebration particles
- `/src/components/DailyProgress.tsx` -- Habit progress ring (unused)
- `/src/components/SummaryCard.tsx` -- Summary metrics (unused)
- `/src/components/MetricTile.tsx` -- Reusable metric display tile
- `/src/components/PreSyncCheckInModal.tsx` -- Pre-analysis check-in modal
- `/src/components/mode-toggle.tsx` -- Theme switcher dropdown
- `/src/components/theme-provider.tsx` -- Theme context provider
- `/src/components/patterns/DaySummaryCard.tsx` -- Day/week summary metrics
- `/src/components/patterns/FoodSafetyDatabase.tsx` -- Food safety table/cards
- `/src/components/patterns/HabitsStreaksWeight.tsx` -- Habits, streaks, weight overview
- `/src/components/patterns/MealPlanSection.tsx` -- AI meal plan accordion
- `/src/components/patterns/NextFoodCard.tsx` -- Next food recommendation
- `/src/components/patterns/ReportArchive.tsx` -- Historical AI reports
- `/src/components/ui/button.tsx` -- CVA-based button component
- `/src/components/ui/input.tsx` -- Input component
- `/src/components/ui/card.tsx` -- Card component system
- `/index.html` -- HTML entry with font loading
