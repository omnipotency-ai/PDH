## Water Modal Winners (per feature)

- **A (3010)**: Centered modal (others put it at bottom of page — terrible UX). Ring preview fills as you adjust amount before committing. Correct light/dark theme handling. Correct water button color on homepage.
- **D (3013)**: Escape to close modal. Shows remaining ml before goal. Shows "goal reached" message.
- **C (3012)**: Cyan color (not blue). Uses colored text throughout modal instead of white.
- **B (3011)**: Icon beside the "Log Water" button.

**Why:** A wins overall architecture (centered modal, preview-before-commit, theme handling). Cherry-pick escape/remaining from D, cyan/colored-text from C, icon from B.

## Filter Component — Needs Fundamental Rethink

All 4 agents executed filter poorly. User's actual mental model:

1. **Default view (no filter)**: Show most recently logged foods for the current time-of-day meal slot (e.g., 7am = recent breakfast items)
2. **When filter opened**: Remove the time-of-day constraint, show the full food library
3. **Filter options**: carbs, proteins, fats, drinks — NOT meal slots
4. **Meal slots don't belong in filter**: rice could be breakfast, lunch, dinner, or snack. Food isn't tied to a specific meal.
5. **Meal slot selector for logging** (which meal to LOG TO) is a completely separate concern from filtering (which foods to SHOW)
6. The database filter (planned for Patterns page) will be the resource for meal planning / Dr Poo meal planning. The nutrition card filter is simpler — just macro-based filtering of the food library.

**How to apply:** When building the final version, separate: (a) time-aware default display, (b) macro-based food library filter, (c) meal slot selector for logging destination. These are three independent concerns.

## Staging Area Issues

- Hard to reach in some implementations — no clear path to get to staging
- Must aggregate: clicking chicken breast 4 times should be ONE row with summed weight, not 4 rows
- Natural units: toast by slice, eggs by count (not grams), butter by grams
- Scrambled eggs = 1 egg (unit), not 120g

## Light/Dark Theme

C and D both showed light theme even when in dark mode. A was the only one that correctly handled both themes.

**How to apply:** Always test both light and dark mode. Use existing CSS custom properties (glass-card system) rather than hardcoded colors.
