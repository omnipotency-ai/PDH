# Agent 03 — Performance & Maintainability: WaterModal.tsx

## Summary

WaterModal.tsx is a clean, well-structured component with good accessibility foundations. The main concerns are: two redundant `keydown` event listeners on `window`, a stale `amountRef` pattern that is unnecessary given how `handleLogWater` is used, `useCallback` applied to setters where stable identity already exists, and the ring SVG being inlined rather than extracted. Nothing is critical, but there are a handful of patterns worth tidying before this is considered production-stable.

---

## Findings

### Important: Two window `keydown` listeners mounted simultaneously

- **File**: `src/components/track/nutrition/WaterModal.tsx:80-127`
- **Issue**: The Escape handler (lines 80–92) and the focus-trap handler (lines 95–127) are two separate `useEffect` calls, each calling `window.addEventListener("keydown", ...)`. When the modal is open, both listeners fire on every keydown event. They are independent, so the overhead is small, but they could (and should) be collapsed into one listener or, better, a single `useEffect` that handles both cases.
- **Impact**: Minor CPU waste; more importantly it makes the event handling harder to reason about. If a third keyboard behaviour were added, the pattern would compound.
- **Suggestion**: Merge the two `keydown` effects into one `useEffect` with a single listener that checks `e.key` for both `Escape` and `Tab`. This reduces mounts/unmounts and makes keyboard logic easy to read in one place.

---

### Important: Unnecessary `amountRef` / stale-closure workaround

- **File**: `src/components/track/nutrition/WaterModal.tsx:54,66,137-140`
- **Issue**: `amountRef` is kept in sync with `amount` on every render (line 66) and then read inside `handleLogWater` (line 138) to avoid a stale-closure problem. However, `handleLogWater` can simply read `amount` directly from state — `useCallback` with `[onLogWater, amount]` as deps is the correct, idiomatic pattern here. The ref/callback split adds complexity without benefit and could mislead readers into thinking there is an intentional design reason for the ref.
- **Impact**: Readability and future-maintainability: the next developer may not understand why the ref exists and either copy the pattern needlessly or delete it incorrectly.
- **Suggestion**: Remove `amountRef` entirely. Change `handleLogWater` to close over `amount` directly with `[onLogWater, amount]` deps:
  ```ts
  const handleLogWater = useCallback(() => {
    if (amount <= 0) return;
    onLogWater(amount);
  }, [onLogWater, amount]);
  ```

---

### Important: `useCallback` on increment/decrement passes `setAmountState` in deps unnecessarily

- **File**: `src/components/track/nutrition/WaterModal.tsx:129-135`
- **Issue**: `handleDecrement` and `handleIncrement` list `setAmountState` as a dependency. React guarantees that the `setState` function returned by `useState` is stable across renders — it will never change identity. Including it in the dep array is harmless but signals a misunderstanding of the React model, and it will cause linter confusion in stricter exhaustive-deps configurations.
- **Impact**: Low risk today; teaches incorrect patterns to future maintainers.
- **Suggestion**: Remove `setAmountState` from both dependency arrays. The `useCallback` wrappers will then be `[]`-dep and correctly memoised for the lifetime of the component instance.

---

### Minor: SVG ring is inlined in the parent component, not extracted

- **File**: `src/components/track/nutrition/WaterModal.tsx:211-255`
- **Issue**: The circular progress ring (background circle + progress arc + centred text overlay) is 45+ lines of JSX embedded directly in `WaterModal`. The ring takes five props that are all derived from parent state (`projectedTotal`, `goalMl`, `strokeDashoffset`, `percentOfGoal`, `goalReached`). It has no internal state or side effects.
- **Impact**: Testability is poor — unit tests for ring rendering require mounting the entire modal with all its focus-trap and Convex wiring. Reusability is zero — if another screen needs a progress ring (e.g. calories, activity) the pattern cannot be shared. The SVG math constants (`RING_SIZE`, `RING_RADIUS`, `RING_CIRCUMFERENCE`) are also in the same file as modal keyboard logic.
- **Suggestion**: Extract a `<CircularProgressRing>` component (or `<WaterRing>` if water-specific) that accepts `projectedTotal`, `goalMl`, and `color` as props and owns the SVG. This is the most high-value maintainability improvement in the file.

---

### Minor: SVG `transition` is an inline style, not a Tailwind utility

- **File**: `src/components/track/nutrition/WaterModal.tsx:240`
- **Issue**: `style={{ transition: "stroke-dashoffset 0.4s ease" }}` is applied directly to the SVG `<circle>`. The rest of the file uses Tailwind utilities for transitions (e.g. `transition-colors` on buttons). SVG CSS properties like `stroke-dashoffset` are not animatable via Tailwind's `transition` utilities by default, so the inline style is technically necessary — but this asymmetry is worth documenting.
- **Impact**: No functional problem. Slightly inconsistent with the rest of the file's style approach. A future Tailwind upgrade or purge could cause surprise if someone tries to move this to a class.
- **Suggestion**: Add a brief comment: `{/* stroke-dashoffset is not a standard Tailwind transition target — inline style required */}` so future maintainers do not attempt to move it needlessly.

---

### Minor: Modal uses `if (!open) return null` (render-on-mount) rather than CSS visibility

- **File**: `src/components/track/nutrition/WaterModal.tsx:152`
- **Issue**: The component fully unmounts when `open` is false (early return `null`). This means every open incurs full DOM creation, focus-trap initialisation, and the 50ms focus timer. On most devices this is imperceptible, but it also means there is no CSS entry animation — the modal just appears.
- **Impact**: No meaningful performance problem at current scale. However, if an entry/exit animation is added later (which the decision docs hint at with "prefill animation: A"), this pattern will need to change to a visibility/opacity approach rather than mount/unmount, otherwise exit animations are impossible.
- **Suggestion**: No immediate action needed, but document the constraint: if animated entry/exit is added in a future wave, switch to a CSS `opacity`/`transform` approach with the modal always mounted and visually hidden when `open` is false (or use a library like Framer Motion's `AnimatePresence`).

---

### Minor: Focus trap queries the DOM on every keydown

- **File**: `src/components/track/nutrition/WaterModal.tsx:104-110`
- **Issue**: Inside `handleFocusTrap`, `dialog.querySelectorAll(...)` is called on every `Tab` keypress. For a small, fixed modal this is negligible, but the focusable node list never changes while the modal is open, making repeated DOM queries wasteful.
- **Impact**: Essentially zero for a ~5-element modal. Worth noting as a pattern to avoid when this is scaled or copy-pasted into larger components.
- **Suggestion**: Cache the focusable list in a `useRef` populated once when the modal opens, rather than querying on every keypress.

---

### Nice-to-have: Magic number `50` (ms focus delay) is unexplained

- **File**: `src/components/track/nutrition/WaterModal.tsx:72`
- **Issue**: `setTimeout(() => closeButtonRef.current?.focus(), 50)` uses an undocumented 50ms delay. The comment says "ensure the modal is rendered" but this is a heuristic, not a guaranteed mechanism.
- **Impact**: Fragile — on slow devices or under load, 50ms may not be enough; on fast devices it is unnecessary. `requestAnimationFrame` after a single paint flush would be more correct and self-documenting.
- **Suggestion**: Replace with `requestAnimationFrame(() => closeButtonRef.current?.focus())` and remove the comment. This guarantees focus happens after paint without an arbitrary timer.

---

### Nice-to-have: `WATER_COLOR` is defined locally rather than consumed from a design token

- **File**: `src/components/track/nutrition/WaterModal.tsx:21`
- **Issue**: `const WATER_COLOR = "#42BCB8"` is a hard-coded hex value at the top of this one file. The same value likely needs to be consistent across the nutrition card, the ring, the modal, and any future water-related charts. If the brand colour changes, every file must be updated manually.
- **Impact**: Low risk today (single file), higher risk as the water colour is referenced in more places.
- **Suggestion**: Define `--color-water` as a CSS custom property in the Tailwind v4 theme config and reference it here via `var(--color-water)` for consistency with the rest of the design token system.

---

### Nice-to-have: `setAmountState` dependency in reset `useEffect` is redundant

- **File**: `src/components/track/nutrition/WaterModal.tsx:59-64`
- **Issue**: `useEffect(() => { if (open) setAmountState(STEP_ML); }, [open, setAmountState])` lists `setAmountState` as a dependency. As noted above, `setState` functions are stable by React contract. The linter may flag this as correct but it teaches an incorrect mental model.
- **Impact**: None functional; minor noise.
- **Suggestion**: Remove `setAmountState` from the dep array.
