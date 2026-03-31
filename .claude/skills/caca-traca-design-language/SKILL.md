---
name: caca-traca-design-language
description: >
  Design language guide for the Caca Traca digestive health tracking app (React Native + Expo).
  This skill is the source of design truth — it captures the visual language, component patterns,
  interaction flows, and progressive disclosure principles that make every screen feel cohesive.
  Use this skill whenever building, modifying, or reviewing ANY UI screen or component for Caca Traca.
  Also use it when the user asks about design decisions, component styling, color usage, layout patterns,
  or information architecture for the app. If you're about to write JSX/TSX for a screen and you haven't
  read this skill, stop and read it first.
---

# Caca Traca Design Language

This is your design bible for building Caca Traca. It doesn't tell you exactly what to put on every screen — it teaches you the visual language, the rhythms, and the principles so you can make good decisions on any screen and have it feel like it belongs.

The app is for people recovering from bowel reconnection surgery. They may be anxious, fatigued, or symptomatic when using it. Every design decision flows from that reality.

## The Three Sources

Our design language draws from three sources, in priority order:

1. **Our design tokens and color system** (prescriptive — follow exactly)
2. **Flare Care reference app** (descriptive — learn patterns from it, don't copy its look)
3. **Existing Caca Traca web app** (descriptive — proven UX flows and data models to carry forward)

When sources conflict: tokens win, then our own proven UX, then Flare Care patterns adapted to our visual language.

---

## Critical Product Constraint: Not a Medical Device

This app is a personal tracking tool, not a medical device. The AI never initiates medical advice, diagnoses, or prescribes. Everything flows from the user's actions — the AI assists and responds but does not lead.

**What this means in practice:**
- The AI Coach only speaks when the user opens it or taps "Ask more" — it does not push unsolicited medical advice
- Food suggestions are framed as "based on your tolerance history" not "you should eat this"
- Insights are presented as patterns in the user's own data, not clinical recommendations
- The "Coach says" card on Home shows observations and reflective questions, not directives
- Export reports are labeled "for discussion with your health team" — never "diagnosis" or "treatment plan"
- All AI-generated content is clearly labeled as AI-generated and confidence levels are shown

**Language guidelines:**
- Say "your data shows" not "you should"
- Say "you might consider" not "we recommend"
- Say "talk to your doctor about" not "this means"
- Frame everything as the user's own journey of discovery

---

## Core Principle: Calm Progressive Disclosure

The single most important design principle. Every screen should feel calm at first glance, then reveal depth on demand. The user in distress should be able to do the essential action in under 10 seconds. The curious user should be able to drill into rich detail without leaving context.

**How this works in practice:**

- **Level 1 — The Glance** (0-3 seconds): The primary action or most important information is immediately visible. No scrolling needed. One clear CTA or selection. Big touch targets, clear visual hierarchy.
- **Level 2 — The Scan** (3-10 seconds): Secondary information and options become apparent. Quick-add shortcuts, status summaries, recent items. The user can complete their task at this level.
- **Level 3 — The Deep Dive** (10+ seconds): Full detail panels, history, notes, voice input, custom entries. Hidden behind "Add Details", "Show More", or a drawer/modal expansion. Never blocks the fast path.

**Anti-patterns to avoid:**
- Cramming everything onto one screen at once (information overload)
- Empty screens with just one input and nothing else (feels broken)
- Requiring the user to fill in all fields to save (partial logging is always valid)
- Hiding the primary action behind navigation steps
- AI appearing to give medical advice or push unsolicited recommendations

---

## Color System

### Semantic Rainbow

We use 7 semantic domain colors plus 3 status colors. This is **prescriptive** — always use these exact tokens, never ad-hoc hex values.

Each domain color has two variants:
- **Full**: Used for icons, active states, badges, accent borders, chart elements
- **Soft**: Used for backgrounds, subtle fills, hover states, card tints

| Domain | Token prefix | Purpose | Dark full | Light full |
|--------|-------------|---------|-----------|------------|
| Output/BMs | `cat-output` | Bowel movements, Bristol scale, stool logs | `#2DD4BF` (teal) | `#0D9488` |
| Food & Drink | `cat-food` | Food logging, drink tracking, nutrition | `#38BDF8` (sky) | `#0284C7` |
| Activity | `cat-activity` | Exercise, movement, physical activity | `#34D399` (emerald) | `#059669` |
| Wellness | `cat-wellness` | Sleep, symptoms, pain, mood | `#A78BFA` (violet) | `#7C3AED` |
| Habits | `cat-habit` | Stimulants, stress, custom habits | `#FACC15` (yellow) | `#CA8A04` |
| AI Coach | `cat-ai` | AI conversation, insights, generated content | `#818CF8` (indigo) | `#4338CA` |
| Experiments | `cat-experiment` | Food testing, reintroduction trials | `#60A5FA` (navy/blue) | `#1E3A5F` |

**Status colors** (used for tolerance, safety, warnings):

| Status | Token prefix | Meaning |
|--------|-------------|---------|
| Safe | `status-safe` | Tolerated foods, ideal Bristol (3-5), positive outcomes |
| Caution | `status-caution` | Moderate risk, Bristol 2 or 6, needs monitoring |
| Danger | `status-danger` | Problem foods, Bristol 1 or 7, urgent symptoms |
| Untested | `status-untested` | No data yet — greyed out, not negative |

### Color Application Rules

- **Never use domain colors for status meaning.** Teal is always "output/BM domain", never "good" or "safe". Green status badge on a teal BM card is correct.
- **Cards get soft backgrounds, not full-intensity floods.** A food logging card uses `cat-food-soft` background, with `cat-food` for the icon and accent.
- **Dark mode colors are brighter, not just lighter.** Dark mode lifts the saturation so colors pop against dark surfaces. Light mode uses deeper, more muted versions.
- **Untested is neutral, not negative.** A food with no data shows grey/untested styling, never danger styling. Unknown ≠ risky.

### Surface & Text Tokens

Beyond domain colors, use these for all backgrounds and text:

- `surface-base`: Page background
- `surface-card`: Card/container backgrounds
- `surface-raised`: Elevated elements, dropdown backgrounds
- `surface-overlay`: Modal/drawer backdrops
- `text-primary`: Headings, important content
- `text-secondary`: Body text, descriptions
- `text-tertiary`: Labels, hints, timestamps
- `border-default`: Subtle card borders
- `border-strong`: Active borders, focus rings

---

## Component Patterns

These patterns describe how components should feel, not pixel-perfect specs. Learn the rhythm and apply it consistently.

### Cards

Cards are the primary content container. They follow a consistent structure:

```
┌─────────────────────────────────┐
│ [icon] Title          [action]  │  ← Header: domain-colored icon, clear title, optional action
│                                 │
│  Primary content / value        │  ← Body: the most important information, visually prominent
│  Supporting detail              │  ← Detail: secondary text in text-secondary
│                                 │
│  [chip] [chip] [chip]           │  ← Footer (optional): tags, status chips, timestamps
└─────────────────────────────────┘
```

**Key patterns from Flare Care worth adopting:**
- The "Flare Factor" card: a single metric made prominent (number in large text, colored), with context text smaller below it. Good for daily summaries.
- The "Weekly Insights" compact info row: icon + label + value, stacked vertically in a small rounded container. Good for dashboard stats.
- Poop log timeline entries: type badge (Bristol illustration + "Type 4"), timestamp, symptom tags inline, edit/delete actions aligned right. Scannable.

**Anti-patterns:**
- Cards that are all the same visual weight (nothing stands out)
- Cards with too many nested cards inside them
- Cards without clear boundaries in light mode (use `border-default`)

### Chips & Badges

**Chips** are interactive selection elements (tappable, toggleable):
- Used for: urgency levels, effort levels, symptom selection, filter categories, stage selection
- Selected state: filled with domain color, white text
- Unselected state: outlined with `border-default`, `text-secondary`
- Always large enough for thumb tapping (minimum 44px height on mobile)

**Badges** are passive status indicators (not tappable):
- Used for: tolerance status (safe/caution/danger/untested), Bristol type number, symptom count
- Small, rounded, using status colors
- Often appear on food cards, log entries, experiment results

**Pattern from Flare Care:** Symptom chips as a multi-select — "Bowel Symptoms" section with chips like "Urgency ✓" and "Incomplete Evacuation ✓" that toggle on/off. The checked ones use the domain color fill. Simple and fast.

### Buttons

Three tiers:
1. **Primary**: Filled with the relevant domain color. One per screen maximum. Used for the primary action ("Quick Save", "Log", "Start Recording").
2. **Secondary**: Outlined or ghost style. For alternative actions ("Add Details", "Show More Options", "Cancel").
3. **Destructive**: Red/danger colored. Only for delete/clear actions. Always requires confirmation.

**The Flare Care "+250 mL / +500 mL" quick-add pattern** is excellent — large, tappable shortcut buttons that let the user log common amounts in one tap. Apply this to water, common foods, repeat meals.

### Bottom Drawers / Sheets

The primary interaction pattern for logging. A drawer slides up from the bottom, covers ~85% of the screen, and contains the full logging flow.

**Structure:**
1. Drag handle at top (visual affordance for dismissing)
2. Title + close button
3. Primary selection area (e.g., Bristol type grid, food search)
4. Optional expanded details below a divider (hidden behind "Add Details" toggle)
5. Save button pinned at bottom

**The drawer is where progressive disclosure shines most.** The user opens the BM drawer, taps Bristol Type 4, and can immediately save. OR they can expand details to add urgency, effort, volume, notes, voice memo, timestamp override — all optional, none required.

### Navigation

**4 tabs, no FAB:**

```
[ 🏠 HOME ]  [ 📋 TRACK ]  [ 🍽 FOOD ]  [ 📊 INSIGHTS ]
```

- **HOME**: The command center. Greeting, BM quick-log (Bristol row), food logging shortcut, Quick Capture grid (sleep, water, coffee, tea, brush teeth, medication), modifier access (stress, mood, activity, smoking, stimulants, weight, alcohol), streak, Coach nudge card, food suggestions
- **TRACK**: Daily Log timeline. All logged events for the selected day in collapsible sections (food intake, fluids, activity, weigh-in, cigarettes, bowel movements, medication). Inline editing. Day navigation (Saturday ← Sun, Mar 22, 2026 → Monday). Entry count badge.
- **FOOD**: The food hub — food library with stage filters and tolerance badges, food detail views with nutritional info and AI insights, plus actual food logs. The Home page has a shortcut to food logging, but FOOD tab is the full experience.
- **INSIGHTS**: Analysis and reporting — approximately 7 sub-screens accessed via tabs/segments within the page. Includes health overview, bowel trends, food tolerance analysis, problem/safe foods, baseline tracking, pattern correlations, and a **report export for sharing with doctor/health team/family**.

**AI Coach is NOT a tab.** It's accessed from:
1. The "AI Coach" button in the Home screen header area
2. The "Ask more" chip at the bottom of the "Coach says" card on Home
3. Opens as a full-screen overlay or pushed screen, not a tab

**Header structure:**
- Left: App logo/name ("CACA TRACA" with teal icon) — tapping logo when signed out shows landing page
- Right: Settings cog (⚙) → app preferences and configuration; Theme toggle (☀/🌙); Clerk avatar → billing, profile, sign out

**AI Coach screen structure:**
- "Choose Personality & Style" selector at top: persona (Coach/Motivator/Nutrition) × response style (Concise with Headings & Bullets / Normal with Short Prose & Bullets / Lengthy with Prose & Bullets)
- Mobile sidebar with chat history (swipe or hamburger)
- Persistent single-thread conversation
- Model selector (e.g. Opus 4.6)
- Suggested action chips below chat input
- "What can I eat today?" food suggestion cards can appear as AI responses

### Illustrations & Visual Assets

**Bristol Scale**: Use procedural SVG illustrations, not photos or emoji. Each type has a distinct shape and color that matches its status meaning (types 1-2: danger/caution reds/oranges, types 3-5: safe greens, types 6-7: caution/danger). See `references/bristol-illustrations.md` for the shape definitions.

**Poop Color Picker** (learned from Flare Care): A separate selection step after Bristol type. Shows ~8 color swatches of realistic stool colors (light brown, brown, dark brown, yellow, green-tinged, black, red-streaked, clay/pale). Each is a small rounded square icon. This is medically relevant data.

**Food illustrations**: For the food library, prefer simple, clean iconography over realistic photos. Icons should be recognizable at small sizes. Consider emoji or flat illustration style for food category headers.

**Water tracking**: A visual fill metaphor (glass or bottle shape filling up) is highly effective for water intake. Show current amount, goal, and percentage. Quick-add buttons for common volumes.

---

## Screen-by-Screen Patterns

Read `references/screen-patterns.md` for detailed analysis of how each major screen should be structured, with examples of what to adopt from Flare Care and what to do differently.

### Tab 1: HOME
The command center and primary entry point. Sections from top to bottom:
1. **Header** — Logo, settings cog, theme toggle, Clerk avatar
2. **Greeting + AI Coach button** — "Hello Peter" with "AI Coach" button top-right
3. **Health Tracking / BM Quick-Log** — Camera icon (photo of BM to AI + optional notes), Bristol scale row (1-7 with colored illustrations, tappable → opens detail panel)
4. **Nutrition / Food Quick-Log** — Icons row (favorites ❤, search 🔍, filters ⚙, droplet 💧), voice/camera input bar + "Log Food" primary button
5. **Quick Capture grid** — Compact cards for: Sleep (0/7 hrs), Brush Teeth (To Do), Medication (To Do), Water (0ml/1000ml), Coffee (0ml · 1 left), Tea (0ml). Each shows current value + target.
6. **Quick Access Modifiers** — Text links/chips for: Sleep, Stress, Mood, Activity, Smoking, Stimulants, Medication, Weight, Alcohol
7. **Streak card** — "5-day check-in rhythm" with day-dot progress bar
8. **Coach says card** — AI observations, reflective questions, encouragement, results. Action chips: "Got it" / "Ask more". This is the user-initiated entry point to the AI — the coach card shows passive observations, user taps "Ask more" to engage.

### Tab 2: TRACK (Daily Log)
A comprehensive timeline of everything logged for the selected day:
- **Day navigator** — Saturday ← Sun, Mar 22, 2026 → Monday (swipeable)
- **Entry count** — "38 entries" badge
- **Collapsible category sections**, each with icon, label, summary value, and expand chevron:
  - 🍽 Food intake (count) — expandable to individual items with times and details
  - 💧 Fluids (total L) — expandable to individual drinks with times and amounts
  - 🏃 Activity (total minutes) — expandable to individual activities
  - ⚖ Weigh-in (kg) — single value with timestamp
  - 🚬 Cigarettes (count) — with timestamp
  - 💩 Bowel movement — expandable with full inline editor (When/date/time, Bristol 1-7 chips, Episodes counter, Accident toggle, Urgency/Effort/Volume chips, notes textarea, Save/Delete buttons)
  - 💊 Medication — with check/complete toggle
- **Compact BM summary line** at bottom: "Long smooth" badge + "B4 · Volume: Med · Urgency: Low · Effort: Easy"

### Tab 3: FOOD
The food hub with three concerns:
1. **Food Library** — Browse/search all foods with stage filters, tolerance badges (safe/caution/danger/untested)
2. **Food Details** — Tap into any food for nutritional info, tolerance score, AI insights, "Generate Doctor Summary"
3. **Food Logs** — Actual food log entries (the teal Food Logs screen with search, recents, quick chips for Breakfast/Lunch/Dinner/Snacks, radial entry options: Voice/AI/Image/Barcode/Custom)

### Tab 4: INSIGHTS
Analysis and reporting with ~7 sub-screens (tab/segment navigation within the page):
- Health Overview (pain level, daily BMs, tracking consistency)
- Bowel Movement Trends (7-day / 1-month charts)
- Food Tolerance Analysis (problem foods, safe foods)
- Baseline Tracker (pain and symptom trends)
- Pattern Correlations (food → BM timing, sleep → symptoms, etc.)
- Weekly/Monthly Summary
- **Report Export** — Generate and share reports with doctor, health team, or family ("Uncle Scott")

### AI Coach (overlay, not a tab)
Accessed from Home via "AI Coach" button or "Ask more" chip. See Navigation section above for full structure.

### Settings (from header cog)
A comprehensive configuration screen with these major sections (see `references/screen-patterns.md` for full wireframe):
- **Units of Measurement** — Metric/US/UK segment toggle
- **Data Management** — Export (full backup JSON, logs CSV), import, reset, delete account (danger)
- **Artificial Intelligence** — API key input (stored securely), model selector (GPT-5.4 recommended)
- **Active Habits** — Toggleable card grid (max 10 active), drag-to-reorder. These drive what appears in Quick Capture on Home. Includes: Sleep, Brush Teeth, Medication, Water, Coffee, Tea, Cigarettes, Weigh-in, Walking, Tray
- **Hidden Habits** — Inactive habits with "Restore" buttons (Stretching, Sweets, Alcohol, Dressing changes, Bebida, Electrolyte drink)
- **About You** — Age, sex, height, weight, BMI calculation, surgery baseline tracking
- **AI Personalisation** — Text areas for coach personality, dos/don'ts, tone preferences
- **Digestive Conditions** — Text area for medical context
- **Medications, Supplements** — Text area
- **Lifestyle Factors** — Smoking description + input, special context/preferences
- **Dietary History** — Surgery changes, food habits, consistency changes

The habit management pattern is important: the Quick Capture grid on Home is dynamically populated from the Active Habits in Settings. Users control which habits they track.

### Logging Detail Panels
Opened from Home quick-log or Track inline edit:
- **BM Detail** — Type 4 header, urgency chips (Low/Med/High/Now!), effort chips (Easy/Some/Hard/Boom), volume chips (Sm/Med/Lg/Juice), accident toggle, trips counter, notes with voice, "Change time" link, "Log BM" button
- **Walking** — Minutes input, daily target (30 min), weekly target (6/wk)
- **Sleep** — Duration (hours/minutes), daily target (6.5 hrs), nudge time, sleep nudge toggle
- **Food suggestions** — "What can I eat today?" card with 3 gentle options based on tolerance + 1 experiment suggestion. Each shows food name, reason, confidence (High/Medium), and Log/Start button

---

## Information Density Guidelines

One of the trickiest aspects. Too sparse feels broken; too dense feels overwhelming.

**The Flare Care balance is a good model:**
- Dashboard: 4-5 distinct content blocks visible without scrolling, each with 2-3 data points max
- Log entries: One line for the main info (type + timestamp), one line for symptoms, action icons right-aligned
- Detail views: Sections with clear headers, but content within sections is compact (label: value pairs, not full paragraphs)
- Settings: Simple list with icons, labels, and chevrons. Grouped by category with colored section headers.

**Our modifications:**
- We add more color variety (Flare Care is monochrome teal; we use the semantic rainbow)
- Our experiment/reintroduction cards are unique to us — they should feel like a mini-dashboard within the Today screen
- AI insights should be visually distinct (indigo domain color) so the user always knows what's AI-generated vs factual

---

## Typography Hierarchy

- **Screen title**: 20-24px, bold, `text-primary`
- **Section header**: 14-16px, semibold, `text-primary`
- **Card title**: 14-16px, medium, `text-primary`
- **Body text**: 14px, regular, `text-secondary`
- **Metric/number**: 24-32px, bold, domain color (for emphasis values like "3.5" or "14%")
- **Label/caption**: 11-12px, regular or medium, `text-tertiary`
- **Chip text**: 12-13px, medium

Don't use more than 3 font weights on a single screen. The hierarchy should be obvious from size and color alone.

---

## Interaction Patterns

### Fast Logging (< 10 seconds)

The critical path. Every logging type must support a fast path from the Home screen:

- **BM**: Home → Tap Bristol type in the scale row → opens detail panel → "Log BM" (or Quick Save if we add it). Camera shortcut: snap a photo → AI analyzes → one-screen confirmation with optional notes.
- **Food**: Home → Tap "Log Food" button → tap from recents/suggestions → Save. Or voice: tap mic → speak → parsed items → confirm.
- **Water**: Home → Tap Water in Quick Capture grid → +250mL / +500mL quick-add → Done.
- **Sleep**: Home → Tap Sleep in Quick Capture grid → enter duration → Save.
- **Modifiers** (stress, mood, activity, etc.): Home → Tap modifier name → compact logging widget → Save.

The expanded detail view is always optional and never blocks saving. Quick Capture items on Home should be loggable in 1-2 taps.

### Voice Input

A microphone icon/button should be present on any text entry (food logging, notes, AI chat). Shows a pulsing recording indicator, then transcribes. Voice is especially important for this user base (tired, symptomatic, one-handed).

### Confirmation & Feedback

- **Save success**: Brief toast or success checkmark animation, then auto-dismiss (1.5 seconds). Like Flare Care's green checkmark "Success! Log saved successfully!" overlay — but more subtle. Don't block the whole screen.
- **Delete confirmation**: Always a confirmation dialog. "Delete this log entry?" with Cancel (secondary) and Delete (destructive red).
- **Empty states**: Never just blank space. Show an illustration or icon, a short message explaining what will appear here, and a CTA to add the first item.

### Time Adjustment

Every log entry defaults to "now" but includes a timestamp override. This is important for post-hoc logging (user logs a BM from 2 hours ago). Show the current time prominently, with a "Change time" link that opens a time picker.

---

## What NOT to Copy from Flare Care

- **The all-teal monotone look.** Their app is entirely teal/white. We use a semantic rainbow — that's our differentiator.
- **The "Carna Nutrition" AI coach branding.** Our AI coach is integrated, not a branded third-party feel.
- **The 6-tab bottom nav with separate Home/Track.** We use 4 tabs: HOME, TRACK, FOOD, INSIGHTS.
- **The calorie/macro focus.** We track foods for tolerance and transit correlation, not for diet/weight management.
- **The "Pro Membership" upsell modals.** Our app should feel generous, not gated.
- **Photo-realistic poop illustrations.** We use clean procedural SVGs that are medical yet approachable.
- **AI that pushes unsolicited medical advice.** Our AI is reactive and user-initiated. The "Coach says" card shows observations, not prescriptions. The user must tap "Ask more" to engage.

## What TO Learn from Flare Care

- **The logging timeline** (Today/This Week toggle with inline Bristol illustrations, timestamps, symptom badges) — extremely scannable
- **The chip-based symptom selection** (Bowel Symptoms, Other Symptoms, Custom Symptoms as grouped chip sets) — fast and accessible
- **The quick-add pattern** for water (+250mL, +500mL buttons) — low friction
- **The food detail view structure** (nutrition info → recommendation → risk level → safety tips → triggers → source) — comprehensive without overwhelming
- **The medication management** (type chips, frequency chips, time scheduling, adherence ring) — clean form design
- **The problem/safe foods analysis** (tabbed, with risk score, reaction %, frequency, symptom correlation) — great data presentation
- **The "Generate Summary for Doctor" button** on food details — excellent feature for medical appointments
- **The empty state pattern** ("No data available for the past week" with chart placeholder + "Add Symptom Entry" CTA) — clear and encouraging
- **The weekly summary layout** (total logs, daily average, most common type, time patterns) — dashboard done right

---

## Accessibility Requirements

These are not optional polish — they're core requirements.

- Minimum touch target: 44×44px on all interactive elements
- Color is never the only indicator — always pair with icon, text, or pattern
- All images/illustrations have descriptive alt text
- Screen reader support for all navigation and interactive elements
- Sufficient contrast ratios (WCAG AA minimum, AAA preferred for text)
- Support for system font size preferences
- Loading and error states for every async operation (skeleton screens, not spinners)

---

## Using This Skill

When you're about to build or modify a screen:

1. Check the color system — are you using the correct domain color for this feature area?
2. Check the component patterns — are you using cards, chips, and buttons consistently?
3. Check progressive disclosure — can the user complete the primary action in <10 seconds?
4. Check information density — is this screen calm at first glance but rich on demand?
5. Check the anti-patterns — are you avoiding the things listed in "What NOT to Copy"?
6. Read `references/screen-patterns.md` for the specific screen you're building

If something doesn't have a clear pattern established, make a decision that's consistent with the principles here and document it so future screens can follow suit.
