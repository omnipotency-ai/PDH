# Round 2 Agent Comparison — Overview Report

> Compiled from browser testing (clicking every interactive element across all 4 implementations) and source code analysis of each worktree.

---

## At a Glance

| Aspect                  | A (Coral/Dark)  | B (Yellow/Light)   | C (Blue/Light)     | D (Orange/Dark)         |
| ----------------------- | --------------- | ------------------ | ------------------ | ----------------------- |
| **Total lines**         | 2,360 (9 files) | 1,830 (7 files)    | 2,388 (6 files)    | 2,683 (7 files)         |
| **Largest file**        | 656 (Card)      | 588 (Card)         | 779 (Card)         | 1,001 (Card)            |
| **State mgmt**          | useReducer      | useState           | useState           | useState+useCallback    |
| **Fuzzy search**        | Fuse.js         | Custom             | Custom             | Fuse.js                 |
| **Live search**         | No              | Yes                | Partial            | Yes (on submit)         |
| **Block text**          | Yes (comma)     | No                 | No                 | Yes (comma+and+newline) |
| **Staging aggregation** | Yes             | No                 | Yes                | Yes                     |
| **Staging persists**    | Yes             | No (lost on close) | Yes                | Yes                     |
| **Global escape**       | No              | No                 | No                 | Yes                     |
| **Dark mode correct**   | Yes             | No (light only)    | No (light in dark) | Partial                 |
| **Modal position**      | Centered        | Not found          | Unknown            | Not found               |
| **Accessibility**       | Good            | Basic              | Basic              | Excellent               |

---

## Component-by-Component Comparison

### 1. Collapsed Card

**A** presents the most compact collapsed state: calorie ring (63%), macro pills, search bar, 3 icon buttons. Uses existing glass-card CSS. Dark mode correct.

**B** has the most polished visual: SVG calorie ring with "left" count, warm amber tones, 4 icon buttons in a neat row, plus a water progress bar visible at all times. Light mode only.

**C** is the simplest: horizontal progress bar (not ring), blue accent, clean and calming. But shows light theme even when dark mode is active.

**D** has the most information: calorie ring, progress bar, macro pills, AND a "Logging to: Snack" indicator below the search bar showing auto-detected meal slot. Dark mode mostly works.

**Key difference:** B and D both show more information at a glance without expanding. A is the most space-efficient. C is simplest.

### 2. Search

**A** — No live search. Typing in the box + clicking "Log Food" sends text directly to staging as custom food. Supports comma-separated block text ("200g chicken, 150g rice"). The weakest search UX.

**B** — Best search UX. Clicking search opens a full expanded view with meal slot tabs, live fuzzy search (type "toast" → instant "Sourdough Toast" result), RECENT section, SAVED MEALS section. Each result has + to add. Staging counter appears inline as green bar.

**C** — Search input on collapsed card. Custom search in state hook but less polished than B. Results appear in expanded area.

**D** — Fuse.js fuzzy search with block text parsing (commas, "and", newlines). Most sophisticated parsing but not tested as live autocomplete. Results appear inline.

**Key difference:** B has the best search-to-stage flow. D has the best input parsing. A and C lack live results.

### 3. Staging Area

**A** — Centered modal overlay (best positioning). Shows food rows with −/+ portion controls, meal slot dropdown, macro totals. Accumulates items from multiple sources (search, favourites, filter). Aggregates same food into one row.

**B** — Inline staging counter ("2 items staged 403 kcal") visible during search. No way found to open a full staging modal with portion controls. Staging lost when search view closes. No aggregation. Weakest staging.

**C** — Separate `StagingModal.tsx` component. Listed rows with portion controls. Aggregates same food. But positioning/reachability was unclear during testing (card appeared dimmed when water was clicked).

**D** — `StagingModal.tsx` (320 lines, most detailed). Orange-accented modal with per-row controls. Differentiates portion increments for solid (50g) vs liquid (50ml). Aggregates same food with explicit portion addition. Best code quality in staging.

**Key difference:** A has the best modal positioning (centered). D has the best staging code (solid/liquid differentiation, aggregation). B's staging is essentially broken (lost on close).

### 4. Water Modal

**A** — Centered modal with cyan ring (450/1000ml), −/+ at 50ml, Cancel/Log Water. User praised: centered positioning, ring preview as you adjust amount. Best overall water UX.

**B** — Water button highlighted on click but modal didn't appear during browser testing. May have rendering or wiring issue. Code exists (150 lines).

**C** — Uses cyan (`#06b6d4`) instead of blue — user praised this distinction. Colored text throughout (not white). 218 lines of water modal code (most detailed). But modal may have positioning issues (card appeared faded, modal not visible).

**D** — Blue accent (`#38bdf8`). Code has `role="dialog"` + `aria-modal`. Best accessibility. But modal didn't appear to render during browser testing — likely a wiring issue.

**Key difference:** A is the only one where the water modal reliably appeared and was properly positioned. C has the best color choice (cyan). D has the best accessibility markup. B and D may have bugs preventing the modal from rendering.

### 5. Filter / Meal Slot

All 4 agents implemented filter as **meal slot tabs** (Breakfast/Lunch/Dinner/Snack) showing foods previously logged at that time of day. The user explicitly stated this doesn't match their mental model:

- Default should show recently logged foods for the current time's meal slot (no filter active)
- When filter is opened, it should NOT be limited to meal slots
- Filter should be by macros (carbs, protein, fat, drinks), not by meal
- Food doesn't belong to a specific meal (rice can be any meal)
- The meal slot for logging ("Logging to: X") is a separate concern from filtering

None of the 4 implementations got this right. The spec was unclear on this point.

**C** was noted by the user as the clearest visual execution among the 4.

### 6. Favourites

**A** — Cleanest execution. Vertical list with heart icons, portions, calories, + to add. Items go to staging when clicked.

**B** — Heart icon present. Opens within search view context.

**C** — Heart icon present. All inline in NutritionCard (no separate component).

**D** — Heart icon present. Vertical list with quick-add buttons and empty state.

**Key difference:** A's favourites is the most polished with the clearest add-to-staging flow.

### 7. Calorie Detail

**A** — Stacked horizontal bar color-coded by meal slot. Legend with calories per slot. "659 remaining" in green. Grouped food entries. Most informative.

**B** — "Detail >" link in header. Expandable sections per meal slot with per-entry delete.

**C** — Inline in NutritionCard. Less distinct from other views.

**D** — Segmented bar by slot. Total vs goal. Delete per entry.

**Key difference:** A provides the clearest at-a-glance calorie breakdown. B's "Detail >" link is the most discoverable trigger.

### 8. Keyboard & Escape

**D** is the only agent with a **global escape handler** (window-level keydown listener). Pressing Escape from anywhere closes any open modal or expanded state.

A, B, C only handle Escape on the search input element — pressing Escape elsewhere does nothing.

### 9. Theme / Dark Mode

**A** — Correctly renders both light and dark mode. Uses existing CSS custom properties. Only agent that handles both properly.

**B** — Light mode only. Changed `main.tsx` default from "dark" to "light". No dark mode support.

**C** — Shows light theme even when system dark mode is active. User explicitly flagged this.

**D** — Dark mode mostly works but user noted some views still show light in dark. Partial compliance.

### 10. Accessibility

**D** — Most thorough. `role="dialog"`, `aria-modal`, `aria-labels` on all buttons, `aria-hidden` on decorative SVGs, focus management, keyboard navigation.

**A** — Good. Aria-labels throughout. Semantic elements.

**B** — Basic. Standard HTML semantics.

**C** — Basic. Standard HTML semantics.

---

## Known Issues Found During Testing

1. **B staging lost on close** — Adding items, then closing search view, loses all staged items
2. **B and D water modal not rendering** — Both have water modal code but clicking the water icon didn't produce a visible modal during browser testing
3. **C card fading** — Clicking water/filter on C seemed to dim the card rather than opening a modal
4. **A search not live** — No autocomplete or live results; text goes directly to staging
5. **All 4 filter wrong** — Filter by meal slot doesn't match user's mental model of macro-based filtering
6. **C and D dark mode broken** — Both show light theme elements in dark mode

---

## Summary Table: Best Feature per Component

| Component               | Winner                  | Why                                              |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| Architecture            | A                       | Most modular, useReducer, reuses CSS             |
| Collapsed card          | B                       | Best visual design, calorie ring, water bar      |
| Search                  | B                       | Live fuzzy results, clear categories             |
| Staging                 | A (position) + D (code) | A centered modal, D solid/liquid differentiation |
| Water modal             | A (working) + C (color) | A reliably renders centered, C uses cyan         |
| Calorie detail          | A                       | Stacked bar, remaining count, grouped entries    |
| Favourites              | A                       | Clean list, direct add-to-staging                |
| Filter                  | None                    | All mismatched user's mental model               |
| Escape                  | D                       | Only global handler                              |
| Accessibility           | D                       | Most thorough aria/focus implementation          |
| Theme                   | A                       | Only one correct in both modes                   |
| Block text              | D                       | Comma + "and" + newline parsing                  |
| Inline staging feedback | B                       | Green "N items staged" bar during search         |
