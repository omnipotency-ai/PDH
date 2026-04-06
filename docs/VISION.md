> **Ref:** `docs/VISION.md`
> **Updated:** 2026-04-05
> **Version:** 1.0
> **History:** v1.0 (2026-04-05) — standardized doc header, transit map removed, nutrition card progress noted

# PDH — Vision & v1.0 Scope

## Purpose

PDH is a digestive recovery tracker for Peter James Blizzard who has undergone
reconnective surgery (ostomy reversal). See [text](<research/In 2019 I had my first colostomy where they cut ou.md>) for more information. 

During recovery, he needs to systematically identify which foods his body can tolerate by logging
meals, fluids, habits, and bowel movements, then correlating inputs with
digestive outcomes over time. This process is tedious and easy to abandon.
PDH makes it manageable by providing structured logging, automated
food-digestion correlation, and AI-generated coaching insights — all
designed to be usable by him while recovering, fatigued, and
dealing with ADHD-adjacent executive function challenges.

## Target User

The primary user is Peter recovering from reconnective surgery.
He needs to track what he eats and how his body responds, ideally
multiple times per day, over months or years. He is not a clinician
or data analyst. He wants answers to simple questions: "Is this food
safe for me?" and "Am I getting better?"

The interface is designed for personal use, not multi-user or clinical
settings. It prioritises speed of data entry, forgiveness for missed
entries, and clear visual feedback over comprehensive medical charting.
ADHD-friendliness means: minimal steps to log, no guilt for gaps, and
AI that surfaces patterns the user might not notice themselves.

## Core Features (v1.0)

### Logging

Daily logging of food, fluid intake, weight, habits, activities, and
bowel movements. Food is entered via a NutritionCard component with
search, staging area, portion controls (50g/50ml increments with
editable amounts), 5-macro tracking (protein, carbs, fat, sugars,
fibre), and meal slot auto-detection. Water has its own modal with a
3-segment progress ring. Non-water liquids are logged through the food
search with ml units. Habits and activities are tracked via the Quick Capture modal.

### Bristol Stool Scale

Bowel movements are classified using the Bristol Stool Scale (types 1-7).
This is the primary outcome metric. Every correlation and AI insight
flows from mapping food/habit inputs to Bristol Scale outputs over time.

### Food-Digestion Correlation

The app correlates logged foods with subsequent bowel movement outcomes
using a food trial system. Each food goes through repeated trials —
the app tracks how many times a food was eaten and what the digestive
outcome was each time, building confidence over repeated exposures.
Foods progress through statuses from untested to safe or problematic.
This trial data feeds the Patterns page, which visualises the results
via a searchable database of all food trials.

### AI Insights

Two-tier AI model strategy: a background model handles food parsing and
routine analysis, while a higher-capability model generates daily
coaching reports. The AI coaching personality ("Dr. Poo") provides
daily summaries, identifies trends, and offers practical dietary
suggestions. Reports are generated on-demand and cached locally.

### Authentication and Data Privacy

Clerk handles authentication. His data is scoped to an authenticated
account. GDPR-compliant deletion is supported. Input sanitisation is
applied to all user-entered text.

### Settings and Health Profile

He currently has a health profile (surgery date, dietary restrictions,
tracking preferences), manages his AI API keys, and controls data sync.
The settings surface also provides data export and account deletion. 

*Note: The plan is to write much of this in a more structured way in the coming weeks to form part of the reimagined dr poo prompt.*

### Testing

Comprehensive test coverage across Convex backend tests for data
integrity (food pipeline mutations and LLM matching), shared utility
unit tests (food canonicalization, normalization, registry, evidence
scoring, pipeline display), and Playwright E2E specs covering daily
tracking, food pipeline branches, patterns food trials, settings, and
destructive operations (18 spec files, 1414 tests as of 2026-04-05).

## Feature-Gated / Deferred

### In the codebase but not finished yet

### Planned

- **Photo food parsing**: camera-based meal logging via vision AI models.
- **Gamification expansion**: basic streaks and confetti celebrations
  ship in v1.0; the broader system (badges, challenges, the
  miniChallenge engine) exists but is being migrated and stabilised.
- **Meal plan table**: structured meal planning based on safe food data.


- Periodic backup/export to file
- Wearable device integration
- Medication tracking
- PDF report export

## Key Technical Decisions

**Cloud-only architecture (ADR-0001).** Convex is the sole source of
truth for all persisted domain data. There is no offline write capability.
Zustand holds ephemeral UI state only (no persist middleware). IndexedDB
stores only the user's OpenAI API key via `idb-keyval`. If the network
is unavailable, the UI fails explicitly rather than pretending data was
saved.

**Convex as backend.** Convex provides real-time queries, server
functions (mutations and actions), and schema-enforced storage. It
replaces a traditional REST API layer. All AI calls route through
Convex actions — the API key is sent transiently and never stored
server-side.

**Two-tier AI models (ADR-007).** Background tasks (food parsing, routine
analysis) use a cheaper, faster model. Insight generation (daily reports,
trend analysis) uses a more capable model. The user's API key is stored
in IndexedDB and passed to Convex actions per-call.

**Bristol Stool Scale as the core metric.** Rather than tracking
subjective "how do I feel" scores, the app anchors on Bristol Scale
types, which are clinically validated and give consistent, comparable
data points over time.

**React 19 + Vite + Tailwind CSS 4.** Standard modern frontend stack.
No SSR — the app is a client-side SPA deployed to Vercel.

## What Success Looks Like

Peter installs PDH, logs his meals and bowel
movements daily with minimal friction, and within two to four weeks
has a clear picture of which foods are safe, which are risky, and
which to avoid. The AI coaching reinforces patterns he might miss
and keeps him motivated to continue tracking during a difficult
recovery period.

The app does not replace medical advice. It gives the patient data
and confidence to have informed conversations with their surgeon or
dietitian about what is and is not working during recovery.
