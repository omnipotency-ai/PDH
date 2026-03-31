# Screen Patterns Reference

Detailed patterns for each screen, based on the latest Excalidraw wireframes (March 2026). For each screen: what it does, its structure, key component patterns, and design rationale.

---

## Tab 1: HOME

**Purpose:** The command center. Everything the user needs to log or check in a single scrollable screen. The Home screen answers: "What do I need to log?" and "What can I eat?"

**Structure (top to bottom):**

```
┌─ Header ──────────────────────────────┐
│ 🧠 CACA TRACA        [⚙] [☀] [👤]   │  ← Logo (landing when signed out), settings, theme, Clerk avatar
├───────────────────────────────────────┤
│ Hello Peter,          [🤖 AI Coach]   │  ← Greeting + AI Coach entry point
│                                       │
│ ✨ Health Tracking ──────────────────  │  ← Section divider with icon
│ ┌─ BM Quick-Log ──────────────────┐   │
│ │ [📷]  Photo of BM to AI plus    │   │  ← Camera shortcut: photo → AI analysis → one screen
│ │       one screen of optional     │   │     with optional notes
│ │       notes                      │   │
│ │ [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ]│  ← Bristol row, colored, tappable → detail panel
│ └──────────────────────────────────┘   │
│                                       │
│ 🍽 Nutrition ────────────────────────  │
│ ┌─ Food Quick-Log ────────────────┐   │
│ │ Quick Access to logging Food     │   │
│ │ (and liquids)                    │   │
│ │ [❤][🔍][⚙][💧]                  │   │  ← Favorites, search, filters, water
│ │ [🎤][📷]_______________[Log Food]│   │  ← Voice/camera + text + primary button
│ └──────────────────────────────────┘   │
│                                       │
│ ⚡ QUICK CAPTURE ────────────────────  │
│ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│ │🌙 0/7hrs │ │☐ Brush   │ │💊 To Do│  │  ← Compact logging cards
│ │ Sleep    │ │  Teeth   │ │  Meds  │  │     Each shows current/target
│ ├──────────┤ ├──────────┤ ├────────┤  │     Tappable → opens logging widget
│ │💧0/1000ml│ │☕0ml·1lft│ │🍵 0ml  │  │
│ │ Water    │ │ Coffee   │ │  Tea   │  │
│ └──────────┘ └──────────┘ └────────┘  │
│                                       │
│ Quick Access to logging Modifiers:    │
│ SLEEP, STRESS, MOOD, ACTIVITY,        │
│ SMOKING, STIMULANTS, MEDICATION,      │
│ WEIGHT, ALCOHOL                       │  ← Text chips/links, each opens compact widget
│                                       │
│ ┌─ Streak Card ───────────────────┐   │
│ │ 🔥 5-day check-in rhythm        │   │
│ │ Building a great picture of...   │   │
│ │ ████████░░░░                     │   │  ← Day-dot progress bar
│ └──────────────────────────────────┘   │
│                                       │
│ ┌─ Coach Says Card ───────────────┐   │
│ │ 💡 Coach says                    │   │  ← AI observations (passive, user-initiated)
│ │ Observations, Reflective         │   │
│ │ Questions, Encouragement,        │   │
│ │ Results                          │   │
│ │ [Got it] [Ask more]              │   │  ← "Ask more" opens AI Coach
│ └──────────────────────────────────┘   │
│                                       │
│ ┌─ Food Suggestions ──────────────┐   │
│ │ What can I eat today?            │   │
│ │ 3 gentle options based on your   │   │
│ │ tolerance history                │   │
│ │                                  │   │
│ │ 🍳 Scrambled eggs on white toast │   │
│ │   Tolerated 4 times · go-to     │   │
│ │   High confidence        [Log]   │   │
│ │                                  │   │
│ │ 🍌 Banana with yogurt            │   │
│ │   Gentle, binding · good for     │   │
│ │   your tendency  High    [Log]   │   │
│ │                                  │   │
│ │ 🍜 Chicken noodle soup           │   │
│ │   Soft protein + hydration       │   │
│ │   Stage 2     Medium     [Log]   │   │
│ │                                  │   │
│ │ 🥕 Ready to test?                │   │  ← Experiment suggestion (navy/experiment color)
│ │   Cooked carrots                 │   │
│ │   Stage 2 · Low gas      [Start]│   │
│ └──────────────────────────────────┘   │
│                                       │
├─ Tab Bar ─────────────────────────────┤
│ [🏠 HOME] [📋 TRACK] [🍽 FOOD] [📊 INSIGHTS] │
└───────────────────────────────────────┘
```

**Design notes:**
- The Home screen is dense but organized through clear section dividers and cards
- BM logging is the first action — Bristol row is always visible without scrolling
- The camera shortcut for BM is a key innovation: snap a photo → AI classifies → user confirms with one screen
- Quick Capture grid uses compact cards with current/target values — loggable in 1-2 taps
- Food suggestions appear lower in the scroll — they're not urgent, they're helpful when the user gets there
- "Coach says" card is passive — observations and reflective questions, NOT directives. User taps "Ask more" to engage the full AI Coach
- Modifiers list (sleep, stress, mood, etc.) gives quick access to everything else

**Critical: Medical device constraint.** The "Coach says" card must only show observations about the user's own data, reflective questions, and encouragement. Never directives, diagnoses, or prescriptions. The "What can I eat today?" cards are framed as "based on your tolerance history" — personal data reflection, not medical advice.

---

## Tab 2: TRACK (Daily Log)

**Purpose:** A comprehensive timeline of everything logged for a selected day. The place to review, edit, and complete logs.

**Structure:**

```
┌─ Header ──────────────────────────────┐
│ 🧠 CACA TRACA        [⚙] [☀] [👤]   │
├───────────────────────────────────────┤
│ 📋 DAILY LOG                38 entries│  ← Icon + title + count badge
│                                       │
│ Saturday  [Sun, Mar 22, 2026]  Monday │  ← Day navigator (swipeable)
│                                       │
│ ┌─ Food Intake ──────────── 2 ∧ ──┐  │  ← Collapsible, count badge, expand chevron
│ │ 19:40                            │  │
│ │  ✅ toasted bread snacks (krispy) │  │
│ │  ✅ 50 g ham                      │  │
│ │  ✅ 125 g greek yogurt (plain)    │  │
│ │                                  │  │
│ │ 06:11                            │  │
│ │  ✅ 2 toast                       │  │
│ │  ✅ 1 banana (ripe banana)        │  │
│ │  ✅ 1 tsp peanut butter (smooth)  │  │
│ │  ✅ 1 tsp jam                     │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Fluids ─────────────── 1.8L ∧ ─┐  │  ← Total volume badge
│ │ 19:39  Water 100 ml              │  │
│ │ 19:39  Water 100 ml              │  │
│ │ 19:39  Coffee 250 ml             │  │
│ │ 08:11  Water 300 ml              │  │
│ │ 08:11  Coffee 250 ml             │  │
│ │ ...                              │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Activity ───────── 30m ∨ ──────┐  │  ← Collapsed summary
│ │ 19:39  Walk 30m                  │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Weigh-in ──────── 104.2 kg ∨ ─┐  │
│ │ 19:39                            │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Cigarettes ──────── 8 ∨ ──────┐  │
│ │ 19:39                            │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Bowel Movement ────────── ∧ ──┐   │  ← Expanded with full inline editor
│ │ When  22/03/2026  📅              │  │
│ │       18:00       🕐              │  │
│ │                                  │  │
│ │ Bristol  [1][2][3][4][⑤][6][7]  │  │  ← Chip row, 5 selected
│ │ Episodes [2]    ⚠ Accident      │  │
│ │ Urgency  [Low] Med  High  Now!  │  │  ← Chip selection
│ │ Effort   [Easy] Some Hard Boom  │  │
│ │ Volume   Sm  Med  [Lg]  Juice   │  │
│ │                                  │  │
│ │ "another douche another enema    │  │  ← Free text notes
│ │  twice the pool came out very    │  │
│ │  formed, so that was good..."    │  │
│ │                                  │  │
│ │ [Save]  🗑 Delete                │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Medication ─────────── ✅ ∨ ──┐   │  ← Green check = taken
│ │ 08:00                            │  │
│ └──────────────────────────────────┘  │
│                                       │
│ ┌─ Bowel Movement Summary ────────┐   │  ← Compact summary line for other BMs
│ │ 💩 Long smooth  🟢              │  │
│ │ 02:25 · B4 · Volume: Med        │  │
│ │ Urgency: Low · Effort: Easy     │  │
│ └──────────────────────────────────┘  │
│                                       │
├─ Tab Bar ─────────────────────────────┤
│ [🏠 HOME] [📋 TRACK] [🍽 FOOD] [📊 INSIGHTS] │
└───────────────────────────────────────┘
```

**Design notes:**
- Each category section is collapsible with an expand/collapse chevron
- Summary values appear in the section header (1.8L for fluids, 30m for activity, etc.)
- Individual items within expanded sections show timestamp + item details
- BM sections support **full inline editing** — date/time pickers, Bristol chip row, all fields
- The compact BM summary line ("Long smooth · B4 · Volume: Med...") is excellent for showing previous BMs without expanding
- Food items show green checkmarks and include specific details (quantities, brand names in grey)
- This screen replaces the separate "POOP Details" modal from Flare Care with inline editing

---

## Tab 3: FOOD

**Purpose:** The food hub — browse foods, see food details, and view food logs. Home page has a shortcut for quick food logging, but this tab is the full experience.

**Three sub-views (likely tab/segment navigation within the page):**

### Food Library
- Search bar with autocomplete
- Stage filters (All / Stage 0 / Stage 1 / Stage 2 / Stage 3 / Stage 4)
- Food cards with tolerance badges (🟢 Safe / 🟡 Caution / 🔴 Danger / ⬜ Untested)
- Each card: food icon/emoji + name + stage + category + test count

### Food Details
- Expanded view when tapping a food
- Tabs: Summary / Nutrients / AI Insights
- Tolerance score, times eaten, reaction window
- Risk level, safety tips, common symptoms
- Nutritional breakdown (calories, protein, fat, carbs, micronutrients)
- AI insights (clearly labeled as AI-generated, indigo domain color)
- "Generate Doctor Summary" button
- Action buttons: Delete / Relog / Edit

### Food Logs
The teal "Food Logs" screen (from Flare Care pattern, adapted):
- Date header (25 March 2026)
- Search field with autocomplete + recent items below
- Quick chips: Breakfast / Lunch / Dinner / Snacks
- Entry methods via radial/expanded options:
  - 🎤 Voice ("Tell Us What You Ate" → voice transcription)
  - 🤖 AI (AI-assisted food entry)
  - 📷 Image (photo → AI food recognition)
  - 📊 Barcode (barcode scan → food lookup)
  - ✏️ Custom (manual food name + notes entry)
- Recent foods list with icons and portion sizes

---

## Tab 4: INSIGHTS

**Purpose:** Analysis, trends, and reporting. Approximately 7 sub-screens accessed via horizontal tab/segment navigation.

**Sub-screens:**

1. **Health Overview** — Average pain level, daily BMs, tracking consistency streak with day dots
2. **Bowel Movement Trends** — 7-day and 1-month chart views, Bristol type distribution
3. **Food Tolerance Analysis** — Problem foods (tabbed with Safe foods), risk scores, reaction %, frequency, symptom correlations
4. **Baseline Tracker** — Pain and symptom trends over time with rolling average
5. **Pattern Correlations** — Food → BM timing, sleep → symptoms, activity → outcomes
6. **Weekly/Monthly Summary** — Aggregate stats: total logs, daily average, most common type, time patterns
7. **Report Export** — Generate shareable reports for doctor, health team, or family. "For discussion with your health team" framing (not medical advice).

**Empty states:** Chart placeholder with wave/trend icon + "No data available for the past week" + "Add Symptom Entry" or relevant CTA button.

---

## AI Coach (Overlay)

**Purpose:** Persistent AI assistant for answering questions about food, patterns, and recovery. User-initiated only.

**Access points:**
- "AI Coach" button on Home screen header
- "Ask more" chip on the "Coach says" card

**Structure:**
```
┌─ Choose Personality & Style ──────────┐
│ Coach       Concise (Headings & Bullets) │
│ Motivator   Normal (Short Prose & Bullets) │
│ Nutrition   Lengthy (Prose & Bullets)     │
└───────────────────────────────────────┘

┌─ Chat ────────────────────────────────┐
│ [≡] Mobile sidebar with chat history  │
│                                       │
│         🧠 Peter returns!             │
│                                       │
│ ┌──────────────────────────────────┐  │
│ │ How can I help you today?       │  │
│ └──────────────────────────────────┘  │
│                                       │
│ Suggested action chips:               │
│ [What can I eat?] [How am I doing?]   │
│ [Explain my patterns] [Food tips]     │
│                                       │
│ [+] [Type message...] [Opus 4.6 ∨] 🎤│  ← Attachments, input, model selector, voice
└───────────────────────────────────────┘
```

**Key design decisions:**
- Personality selector: 3 personas × 3 response styles = 9 combinations. This is novel and lets the user control how the AI communicates.
- Mobile sidebar (hamburger or swipe) for chat history
- Model selector in the input bar (Opus 4.6, etc.) — power user feature
- Suggested action chips below the chat — these are the user-initiated prompts
- The AI never initiates the conversation — it responds when the user opens the screen or taps a chip

---

## Logging Detail Panels

These open from Home (BM quick-log, Quick Capture, Modifiers) or from inline editing in Track.

### BM Detail Panel
From tapping a Bristol type on Home, or expanding a BM entry in Track:
```
Type 4 - Smooth, soft sausage or snake    ← Type header with description

URGENCY                    EFFORT
[Low] [Med] [High] [Now!]  [Easy] [Some] [Hard] [Boom]

VOLUME              ACCIDENT      TRIPS
[Sm] [Med] [Lg] [Juice]  [⚠]     [- 1 +]

NOTES (OPTIONAL)
[How did it feel? Any observations?    ] 🎤

⏰ Just now  Change time

                    [ Log BM ]
```

### Walking Widget
```
🏃 Walking
0 / 30 minutes  ────────────────

        Enter minutes, press Enter.
        Minutes: [10]

Settings
Daily target    Weekly target
[30] ↕ minutes  [6]        /wk
                This week: 0 / 6
```

### Sleep Widget
```
🌙 Sleep
0 / 7 hours  ──────────────────

        Enter duration, press Enter.
        Hours    Minutes
        [1]      [0]

Settings
Daily target
[6.5]  ↕  hrs

Nudge time
[15:30]    🕐    Sleep nudge  ☑
```

---

## Settings (from Header Cog)

Accessed via the settings cog (⚙) in the header. A scrollable dark-mode-first screen with clearly grouped sections. This screen is where all configuration, personalisation, and data management lives.

**Structure (top to bottom):**

```
┌─ Header ──────────────────────────────┐
│ 🧠 CACA TRACA        [⚙] [☀] [👤]   │
├───────────────────────────────────────┤
│                                       │
│ UNITS OF MEASUREMENT                  │
│ Used across tracking and reports.     │
│ [ Metric ] [ US ] [ UK ]             │  ← Segment toggle, Metric default
│                                       │
│ DATA MANAGEMENT                       │
│ EDIT - records available for export   │
│ [📦 Export Full Backup] [📋 Export Logs CSV] │
│ [📥 Import Backup] [🔄 Reset Factory Settings] │
│                                       │
│ [🗑 Delete My Account Data]           │  ← Red danger button
│ Backup JSON includes your personal    │
│ recovery data and excludes the local  │
│ only OpenAI API key...                │
│                                       │
│ ARTIFICIAL INTELLIGENCE               │
│ Make my intelligent                   │
│ OPENAI_API_KEY                        │
│ [________________________________]    │  ← Secure input field
│ Your API key is stored securely on    │
│ our servers and used to make requests │
│ on your behalf. You can delete it     │
│ at any time.                          │
│ [GPT-5.4 (recommended) ∨]            │  ← Model selector dropdown
│                                       │
│ ──────────────────────────────────    │
│                                       │
│ ACTIVE HABITS                         │
│ Set 10 of these on Track. Tap to      │
│ toggle, drag to reorder. Track        │
│ details underneath.                   │
│                                       │
│ ┌─────┐ ┌─────┐ ┌──────┐ ┌─────┐    │
│ │🌙   │ │☐    │ │💊    │ │💧   │    │  ← Toggleable habit cards
│ │Sleep │ │Brush│ │Meds  │ │Water│    │    in a responsive grid
│ │  🟢  │ │Teeth│ │  🟢  │ │ 🟢  │    │    Green dot = active
│ ├─────┤ ├─────┤ ├──────┤ ├─────┤    │
│ │☕   │ │🍵   │ │🚬   │ │⚖   │    │
│ │Coffee│ │Tea  │ │Cigs  │ │Weigh│    │
│ │  🟢  │ │  🟢  │ │  🟢  │ │  🟢 │    │
│ ├─────┤ ├─────┤                      │
│ │🚶   │ │🍽   │                      │
│ │Walk │ │Tray │                      │
│ │  🟢  │ │  🟢  │                      │
│ └─────┘ └─────┘                      │
│                                       │
│ HIDDEN HABITS (tap Restore to show)   │
│ Stretching (minutes)    [Restore]     │
│ Sweets (minutes)        [Restore]     │
│ Alcohol (minutes)       [Restore]     │
│ Dressing changes (mins) [Restore]     │
│ Bebida (minutes)        [Restore]     │
│ Electrolyte drink (mins)[Restore]     │
│                                       │
│ ──────────────────────────────────    │
│                                       │
│ ABOUT YOU                             │
│ Age, sex, height, and weight help     │
│ personalise calories, protein,        │
│ hydration, and BMI context.           │
│                                       │
│ Sex: [___]    Age (years): [___]      │
│ Height (cm): [___]                    │
│                                       │
│ BMI: 30.6 · Latest weight: 105 kg    │
│ Changes from surgery start +1 kg     │
│ (↑1%). Output: weight vs baseline... │
│                                       │
│ AI PERSONALISATION                    │
│ What should this chat act like?       │
│ What are your dos/don'ts for the      │
│ AI to use as its tone and style?      │
│ [________________________________]    │  ← Multiline text area
│ [________________________________]    │
│                                       │
│ DIGESTIVE CONDITIONS                  │
│ [________________________________]    │  ← Text area for conditions
│                                       │
│ MEDICATIONS, SUPPLEMENTS              │
│ Medications:                          │
│ [________________________________]    │
│                                       │
│ LIFESTYLE FACTORS                     │
│ Smoking                               │
│ Smoking can affect gut motility and   │
│ tissue healing. We can use this to    │
│ understand your baseline and track    │
│ any relationship to food/symptoms.    │
│ [________________________________]    │
│                                       │
│ Special context/preferences:          │
│ [________________________________]    │
│                                       │
│ DIETARY HISTORY                       │
│ Surgery changes, food intake habits,  │
│ and any recent consistency changes... │
│ [________________________________]    │
│                                       │
├─ Tab Bar ─────────────────────────────┤
│ [🏠 HOME] [📋 TRACK] [🍽 FOOD] [📊 INSIGHTS] │
└───────────────────────────────────────┘
```

**Design notes:**
- Settings is a **dark-mode-first** design — looks native and clean on dark surfaces
- Sections are separated by horizontal dividers, not cards (simpler, more settings-like)
- Section headers use colored uppercase text (teal for primary sections, pink/magenta for labels)
- **Active Habits grid** is a key UX pattern: toggleable cards in a grid, drag-to-reorder, maximum 10 active. This drives what appears in the Quick Capture section on Home.
- **Hidden Habits** with "Restore" buttons let users show/hide habits they don't track — progressive disclosure for settings too
- **About You** feeds into AI personalisation and BMI/weight calculations
- **AI Personalisation** text areas let the user set the coach's tone and boundaries — critical for the reactive-AI-only model
- All personal text fields (conditions, medications, lifestyle, dietary history) feed into the AI Coach's context
- **Data management is prominent** with export/import/backup/delete — transparency and data ownership
- API key storage is local-only with clear security messaging
- Model selector (GPT-5.4) suggests the AI backend is configurable

**Clerk avatar menu (from header avatar):**
- Profile
- Billing
- Sign Out

---

## General Layout Principles

### Spacing
- Card padding: 16px
- Card gap (between cards): 12px
- Section gap (between major sections): 24px
- Screen horizontal padding: 16px
- Bottom safe area: 80px+ (above tab bar)

### Border Radius
- Cards: 12-16px
- Chips/badges: 8-12px (fully rounded for small badges)
- Buttons: 8-12px
- Input fields: 8px
- Bottom drawer: 20px top corners

### Shadows
- Cards in light mode: subtle shadow (0 1px 3px rgba(0,0,0,0.08))
- Cards in dark mode: no shadow, rely on surface color differentiation
- Elevated elements (drawers, modals): stronger shadow in light mode

### Safe Areas
- Always account for device notch/status bar at top
- Always account for home indicator at bottom
- Tab bar sits above home indicator
- Drawer content doesn't go behind tab bar

### Section Dividers
- Use icon + colored label + horizontal line pattern: "✨ Health Tracking ──────"
- Section labels use the domain color for that category
- Keep labels short and scannable
