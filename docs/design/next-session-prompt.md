# Next Session: Merge PR + 4 Parallel UI Implementations

## Step 1: Create 4 worktrees for parallel UI implementations

Spawn 4 agents using `isolation: "worktree"`, each implementing the meal logging PRD (`docs/design/meal-logging.md`). All 4 get the identical prompt. The value is in seeing how they independently interpret the same spec — layout choices, component structure, interaction details, visual treatment will naturally vary.

### Agent prompt (identical for all 4)

> You are implementing the Food Logging page for PDH, a post-surgical food reintroduction tracker.
>
> **Read these files first:**
>
> - `docs/design/meal-logging.md` — the full PRD (this is your spec, follow it closely)
> - All reference images in `docs/design/food-trackers/` — especially `pdh-light-mode-reference.png` (primary style reference) and `pdh-dark-mode-reference.png` (dark mode reference)
> - `CLAUDE.md` — project engineering principles
> - `src/routeTree.tsx` — current route structure
> - `src/components/Track.tsx` — current Track page (the food input section is what you're replacing)
> - `src/components/ui/` — existing component library
>
> **What to build:**
> Create a new `/food` route with the meal builder UI described in the PRD. The page must:
>
> - Follow the chip-based meal builder flow (input bar → meal slot chips → recipe/food chips → staging area → Log button)
> - Support dark mode using the existing theme system
> - Be mobile-responsive and ADHD-friendly (taps over dropdowns, progressive disclosure, calm and scannable)
> - Use the existing design tokens and component library where possible
>
> **What to mock:**
> You can mock the Convex backend with static data for now. Create a Zustand store for the staging area state. Use hardcoded recipe/food data that matches the examples in the PRD (scrambled eggs on toast, toast with toppings, coffee, kaleitos, etc.).
>
> **What NOT to do:**
>
> - Don't modify existing pages or routes (create new files only)
> - Don't build the nutrition label capture or barcode scanning flows (just show the icons)
> - Don't build recipe management UI
> - Don't implement the "What can I eat today?" section (future scope)

### What to review after

Show Peter each of the versions so he can have a look and get a feel for whats right. He will Compare the 4 implementations side by side: and tell you which he likes best.

1. Which layout feels best for quick logging (5 taps or less)?
2. Which works best on mobile vs desktop?
3. Which handles the staging area most intuitively?
4. Which would you actually use on a bad day?

then you will take thiose bits he liked best and combine into the final implementation.

you must show peter the agernts work and get his feedback before proceeding to the final implementation.