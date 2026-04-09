# Responsive Layout Rework

> **Ref:** `docs/plans/responsive-layout-rework.md`
> **Created:** 2026-04-09
> **Status:** Draft
> **Branch:** TBD (after food-platform merges)
> **Visual ref:** User's Excalidraw mockup (April 2026), production screenshots

---

## 1. Summary

Restructure the app shell to match the Excalidraw mockup: top navigation with icons, single unified date header, two-column desktop layout with logging + log timeline side by side, and mobile-first pages that split into Home (logging) and Track (timeline).

---

## 2. Navigation — Restore Top Nav

**Source:** Grab the production `GlobalHeader.tsx` from `main` (pre food-platform branch) and adjust.

- Top-left: PDH logo + "Peter's Digestive Health"
- Centre: **Home, Track, Food, Insights** — icons with labels, coloured per-section, underline on active
  - Home = teal, Track = sky, Food = orange, Insights = rose
- Top-right: Settings gear, theme toggle, user avatar
- **Remove** the bottom tab bar from `AppLayout.tsx`
- Mobile: same top nav, icons only (no labels) below ~640px

---

## 3. Unified Date System

### 3.1 Date Context Store

Single Zustand store or React context that owns the "active date":

```typescript
interface DateContextState {
  activeDate: Date; // the date being viewed/edited
  setActiveDate: (d: Date) => void;
  goToToday: () => void;
  goBack: () => void; // previous day
  goForward: () => void; // next day (max: today)
}
```

Every component that displays or edits date-scoped data reads from this store. No local date selectors anywhere.

### 3.2 Date Pill Header Component

Horizontal scrollable row of date pills below the nav:

```
TODAY    THU APR 9    WED APR 8    TUE APR 7    ...
         ═══════
```

- Active pill is highlighted/underlined
- Tapping a pill sets `activeDate`
- Below pills: summary strip — "BMs: 0 | Fluids: 1000 ml (water: 500 ml) | Last BM: 17h 19m ago"
- Shows on Home and Track pages

### 3.3 Time Handling

When logging an item, the time defaults to "now" but must be adjustable:

- BM already has time editing
- Food intake already has time editing
- Quick Capture habits need time adjustment (currently logs at tap time)
- Nutrition card food logging needs time adjustment
- New mood tracker needs time input

Implementation: shared `TimePickerInline` component — a simple HH:MM input that appears on long-press or edit of any log entry.

---

## 4. Responsive Home Page

### Desktop (≥1024px) — Two Columns

```
┌──────────────────┬──────────────────┐
│  Left Column     │  Right Column    │
│                  │                  │
│  Nutrition Card  │  LOGS  THU APR 9 │
│  (calorie ring,  │  Fluids    1.3L  │
│   fluid bar,     │  Tina        5   │
│   food search,   │  Cigarettes  5   │
│   Log Food btn)  │  BM    Long sm.  │
│                  │  Food intake  3  │
│  Meal Slot       │  Activity   30m  │
│  Toggles         │  Medication  ✓   │
│                  │  Brush Teeth ✓   │
│  Macro Breakdown │  Sleep      5h   │
│                  │  BM    Cracked   │
│  Bristol Scale   │                  │
│                  │                  │
│  Quick Capture   │                  │
│  Grid            │                  │
│                  │                  │
│  Mood Tracker    │                  │
│                  │                  │
│  BMs Today +     │                  │
│  Trend           │                  │
│                  │                  │
│  Ask Dr Poo      │                  │
│                  │                  │
│  Latest Dr Poo   │                  │
│  Message         │                  │
└──────────────────┴──────────────────┘
```

Right column uses `hidden lg:block`. Same TodayLog component from Track page.

### Mobile (<1024px) — Home Page Only Shows Left Column

Track page (separate route) shows only the right column content.

---

## 5. Home Page Components

### 5.1 Existing (keep/adjust)

- **Nutrition Card** — calorie ring, fluid bar, food search with camera+mic, Log Food button, meal slot toggles, macro breakdown
- **Bristol Scale Selector** — horizontal row of 7 types
- **Quick Capture Grid** — habit tiles (see 5.3)
- **Ask Dr Poo** — conversational AI panel
- **BMs Today + Trend** — summary card
- **Latest Proactive Dr Poo Message** — last AI insight snippet

### 5.2 New: Mood Tracker

A quick-log card for subjective state:

- **Mood**: 5-point scale (1=awful to 5=great) — emoji or coloured dot selector
- **Stress Level**: 5-point scale (1=calm to 5=overwhelmed)
- **Notes**: freeform text field for context
- **Time**: adjustable, defaults to now
- Logs to the `logs` table as type `"mood"` (new type needed in schema)

### 5.3 New: ADHD Daily Check-in

3-4 quick questions, each a 1-5 scale or yes/no:

1. **Hyperfocus** — "How locked-in were you today?" (1=scattered → 5=tunnel vision)
2. **Analysis Paralysis** — "Did decisions feel stuck?" (1=no → 5=completely frozen)
3. **Perfectionism** — "Were you re-doing things unnecessarily?" (1=no → 5=couldn't stop)
4. **Time Blindness** — "Did time disappear on you?" (1=tracked well → 5=lost hours)
5. **Masking** — "How much effort to appear 'normal'?" (1=none → 5=exhausting)

Stored as a single log entry, type `"adhd_checkin"` (new type).
One entry per day. If already filled, shows as a summary with edit option.

### 5.4 Quick Capture Simplification

Remove the configurable settings system. Hard-code the pills that matter:

| Pill        | Type           | Display                             |
| ----------- | -------------- | ----------------------------------- |
| Sleep       | hours / goal   | "5 / 7 hrs"                         |
| Brush Teeth | done/not       | "Done ✓"                            |
| Medication  | done/not       | "Done ✓"                            |
| Water       | ml / goal      | "500 ml /"                          |
| Coffee      | ml + count     | "750 ml · 2" (with warning if high) |
| Tea         | ml             | "0 ml"                              |
| Weigh-in    | kg             | "106.3 kg"                          |
| Walking     | minutes / goal | "30 / 30 min"                       |
| Tina        | count / limit  | "5 left"                            |
| Cigarettes  | count / limit  | "3 left"                            |
| + Add habit | action         | opens inline add                    |

---

## 6. Track Page (Mobile) / Right Column (Desktop)

The `TodayLog` component — already exists. Shows chronological log entries for the active date.

- Reads `activeDate` from shared date context
- Each entry: icon, title, timestamp, detail/badge, expand chevron
- Entries are grouped and sorted by timestamp (newest first)
- Editable inline — expand to edit, delete, adjust time

---

## 7. Implementation Phases

### Phase 1: Shell + Date Context

- Restore top nav from production `GlobalHeader.tsx`, adjust menu items
- Remove bottom tab bar
- Create `useDateContext` store
- Create `DatePillHeader` component
- Wire into Home and Track pages

### Phase 2: Responsive Home

- Two-column layout with `lg:grid-cols-2`
- Right column: embed TodayLog (hidden on mobile)
- Left column: existing logging components

### Phase 3: New Components

- Mood Tracker card + schema addition
- ADHD Daily Check-in card + schema addition
- Quick Capture simplification (remove settings, hard-code pills)

### Phase 4: Time Unification

- Shared `TimePickerInline` component
- Wire into Quick Capture, Nutrition card, Mood tracker
- Ensure all log mutations accept a timestamp parameter

---

## 8. Non-Goals

- No changes to Food page or Insights page content (only nav integration)
- No offline support
- No multi-user configuration — this is Peter's app
- No redesign of Dr Poo conversation UI (just placement)
