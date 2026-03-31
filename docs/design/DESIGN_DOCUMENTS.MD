These are all very precise and consistent design preferences. Let me capture them cleanly across both documents.

***

# DOCUMENT 1 — UI Design Bible
## Section: Global Design Tokens & Standards

***

### Typography

**Heading Font:** A narrow/condensed variant — e.g. `Inter Tight`, `DM Sans`, or `Outfit`. Must be visually distinct from body text. Title case. All headings use this font.

**Body Font:** `Inter` — medium spacing, sentence case.

**Subheadings:** `Inter`, ALL CAPS, slightly reduced size from heading.

**Hierarchy example:**
```
Heading      → Outfit 600, Title Case, condensed
Subheading   → Inter 500, ALL CAPS, tracking-wide
Body         → Inter 400, Sentence case
Label/Chip   → Inter 500, Sentence case
```

**Never use:** Serif fonts, Times New Roman, fonts with curly R's or T's, decorative typefaces.

***

### Colour Philosophy

- **No pure black.** Maximum dark = `[colour]-800` (charcoal). `900` is acceptable only for shadows, never text.
- **No pure white.** Minimum light = `[colour]-50` or `[colour]-100` for backgrounds.
- **All colours tokenised.** No hex codes in component code. No inline colour values. All values reference design tokens.

**Token naming convention:**
```
--color-bg-primary
--color-bg-surface
--color-text-primary
--color-text-secondary
--color-border-default
--color-ai-surface
--color-ai-text
-- etc.
```

**Core palette:**
| Token | Light Mode | Dark Mode |
|---|---|---|
| App primary | Teal | Teal |
| AI layer | Indigo-100 bg / Indigo-700 text | Indigo-700 bg / Indigo-300 text |
| Background | Neutral-100 | Neutral-900 (not black) |
| Surface/Card | Neutral-50 | Neutral-800 |
| Text primary | Neutral-800 | Neutral-200 |
| Text secondary | Neutral-600 | Neutral-400 |
| Border | Same colour as text, -700/800 | None (invisible in dark mode) |

***

### Button & Pill Design

**Border radius:** `6px` or `8px` — squircle-style rounded corners. Never full pill/semicircle (no `rounded-full`).

**Aspect ratio:** Minimum `4.5:1` width-to-height. Pills are wide and slim, never square or squat.

**Padding:** Compact vertical padding. Generous horizontal padding to maintain the ratio.

**Icon + text sizing:**
- If text is `14px`, icon is `16px`
- If text is `12px`, icon is `14px`
- Icon always 2px larger than accompanying text
- Icon and text vertically centred, with consistent gap between them

**Light mode button (primary):**
- Background: `[colour]-100`
- Border: `1px solid [colour]-700`
- Text: `[colour]-800`
- Icon: `[colour]-700`

**Dark mode button (primary):**
- Background: `[colour]-700`
- Border: none
- Text: `[colour]-200`
- Icon: `[colour]-300`

**Ghost button (light mode):**
- Background: transparent
- Border: `1px solid [colour]-700`
- Text: `[colour]-800`

**Ghost button (dark mode):**
- Background: transparent
- Border: `1px solid [colour]-400`
- Text: `[colour]-300`

**Never use:** Full semicircle pill radius (`rounded-full`). Excessive vertical padding. Emojis as button content or icons.

***

### Icons

**Dr. Poo / AI Coach icon:** Stethoscope. Primary choice. Never a robot face.

**AI-generated content indicator:** Sparkle icon — used sparingly. Maximum once or twice per screen. Never as a repeated pattern element.

**Icon library:** Consistent single library throughout (e.g. Lucide or Phosphor — to be confirmed). Never mix icon sets.

**Emojis:** Never used as icons or interactive elements. Acceptable only within body text content where contextually appropriate (e.g. a daily tip that uses ✓ or ✗ in prose).

***

### Spacing System

**Two-tier spacing model:**

| Context | Density | Description |
|---|---|---|
| Between components/sections | Normal | Standard gap — breathing room between distinct UI blocks |
| Inside components | Compact | Tight internal padding — no wasted vertical space |

**Principles:**
- Vertical space is premium real estate — never generous
- No stacked margins creating double/triple gaps between heading → subheading → content
- Progressive disclosure preferred over showing everything at once
- Components themselves are compact; the page layout gives them room to breathe between each other

**Avoid:**
- Excessive top/bottom padding inside cards
- Multiple nested vertical spacers
- Min-height constraints that force empty space
- Padding + margin + gap all applied simultaneously to the same element

***

### Modals & Overlays

**Border radius:** Consistent with button radius — `8px` or slightly larger (`12px`) for modal containers.

**Background:** Surface token (off-white in light, dark neutral in dark mode) — never pure white or black.

**No excessive internal padding.** Content starts close to the modal edge with compact internal spacing.

***

### General Rules

1. No black (`#000000`) anywhere in the UI
2. No white (`#ffffff`) anywhere in the UI
3. No serif fonts, no decorative fonts
4. No emoji icons or emoji used as UI controls
5. No robot icons for AI features
6. No hard-coded hex colours in code — tokens only
7. No full-radius pills (`rounded-full`)
8. No generous spacing — compact inside, normal between
9. Sparkle icon used maximum 1–2 times per screen
10. Icon always 2px larger than its accompanying text label

***

# DOCUMENT 2 — Feature & Behaviour Spec
## Section: AI Coach — Token Tracking & Cost Transparency

***

### Token Usage Tracking

**Purpose:** Give users full visibility into their API spend since they supply their own API key.

**What to track per API call:**
- Timestamp
- Call type: `chat` or `background`
- Model used
- Input token count
- Output token count
- Calculated cost (input tokens × rate + output tokens × rate)

**Storage:** All calls logged to Convex with the above fields. Aggregated on demand for the modal display — not pre-computed.

**Cost calculation:**
```
call_cost = (input_tokens / 1_000_000 × input_rate)
          + (output_tokens / 1_000_000 × output_rate)
```
Rates stored as config tokens per model — updatable without code changes.

**Monthly aggregation:** Rolling calendar month. Reset on the 1st or configurable by user.

***

### Usage Modal — Data Contract

**Section A: Dr. Poo Chat**
- Total input tokens (month)
- Total output tokens (month)
- Active model name
- Input rate (per 1M tokens)
- Output rate (per 1M tokens)
- Estimated chat cost (month)

**Section B: Background Processes**
- Total background calls (month)
- Total tokens consumed (month)
- Estimated background cost (month)

**Footer:** Static disclaimer — estimates only, actual billing via API provider dashboard.

***

### AI Personality Threads

**Each personality = one persistent thread per user.**

**Recommended personalities (3 confirmed, 4th optional):**

| ID | Name | Type | System Prompt Focus |
|---|---|---|---|
| `clinical` | Dr. Poo | Clinical | Evidence-based, precise, references research |
| `motivational` | Coach | Motivational | Progress-focused, encouraging, accountability |
| `nutritional` | Nourish | Nutritional | Food-first, meal planning, ingredient guidance |
| `casual` *(optional)* | Buddy | Friendly | Conversational, low-pressure, daily check-ins |

**Thread persistence:**
- Each thread stored separately in Convex
- Switching personality pauses current thread, opens selected thread
- Memory vector search scopes to active thread by default
- Shared factual memories (diagnoses, known triggers) optionally retrievable across all threads

**Decision to make:** Whether to launch with 3 or 4 personalities. Recommendation: launch with 3, add Buddy in a later release.

***

### Proactive Chat Behaviour

**Dr. Poo is proactive, not just reactive.**

**On chat open:**
- Check time of day → generate contextual greeting
- Check last log timestamp → if recent, reference it
- Check last chat timestamp → if returning user, acknowledge gap

**Greeting examples (generated, not hardcoded):**
- *"Good morning, [Name]. How's the gut feeling today?"*
- *"Welcome back. You logged lunch an hour ago — want me to take a look?"*
- *"Evening, [Name]. How did today go?"*

**Quick-prompt chips:**
- Displayed above input bar, horizontally scrollable
- Indigo-tinted pill shape (`6–8px` radius)
- Tap fires prompt directly into chat

| Chip | Prompt fired |
|---|---|
| Analyse my week | "Can you analyse my gut health data from this week?" |
| Build a meal plan | "Can you suggest a meal plan based on my safe foods?" |
| I need support | "I'm struggling today, can we talk?" |
| Generate GP report | "Please generate a summary report for my doctor." |

***

### Artifact Generation

Artifacts are structured outputs generated within the chat thread. They are visually distinct from messages.

**Types:**
- GP Summary Report
- Meal Plan
- Safe Foods List
- Suspected Culprits List
- Trend Summary

**Behaviour:**
- Generated inline in chat thread
- Rendered as a card with title, content preview, and action buttons
- Actions: Copy, Save to Convex, Share
- Saved artifacts retrievable from a dedicated section (TBD — possibly within the chat thread history or a separate artifacts view)

**AI indicator:** Single sparkle icon on artifact card header to indicate AI-generated content.

***

Both documents are now seeded with everything discussed. The next logical section to document would be the Home Screen layout — the greeting, the Dr. Poo pill placement, the Flare Factor tracker, and the nutrition logging buttons — since that's the next part of the image you mentioned moving on to.