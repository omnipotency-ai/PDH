# PDH — Vision & v1.0 Scope

## Purpose

PDH is a digestive recovery tracker for patients who have undergone
reconnective surgery (ostomy reversal). During recovery, patients must
systematically identify which foods their body can tolerate by logging
meals, fluids, habits, and bowel movements, then correlating inputs with
digestive outcomes over time. This process is tedious and easy to abandon.
PDH makes it manageable by providing structured logging, automated
food-digestion correlation, and AI-generated coaching insights — all
designed to be usable by someone who is recovering, fatigued, and likely
dealing with ADHD-adjacent executive function challenges.

## Target User

The primary user is a single person recovering from reconnective surgery.
They need to track what they eat and how their body responds, ideally
multiple times per day, over weeks or months. They are not a clinician
or data analyst. They want answers to simple questions: "Is this food
safe for me?" and "Am I getting better?"

The interface is designed for personal use, not multi-user or clinical
settings. It prioritises speed of data entry, forgiveness for missed
entries, and clear visual feedback over comprehensive medical charting.
ADHD-friendliness means: minimal steps to log, no guilt for gaps, and
AI that surfaces patterns the user might not notice themselves.

## Core Features (v1.0)

### Logging

Daily logging of food, fluid intake, weight, habits, activities, and
bowel movements. Food can be entered via natural language and parsed
by AI into structured items with portion estimates. Fluid intake is
tracked with configurable units. Habits and activities are tracked via
a template-based system with customisable categories.

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
via a transit map, food safety grid, hero metrics, and a searchable
database of all food trials.

### AI Insights

Two-tier AI model strategy: a background model handles food parsing and
routine analysis, while a higher-capability model generates daily
coaching reports. The AI coaching personality ("Dr. Poo") provides
daily summaries, identifies trends, and offers practical dietary
suggestions. Reports are generated on-demand and cached locally.
Scheduled insight generation also runs at set times (morning and
evening) to proactively surface patterns without user prompting.

### Authentication and Data Privacy

Clerk handles authentication. All user data is scoped to authenticated
accounts. GDPR-compliant deletion is supported. Input sanitisation is
applied to all user-entered text.

### Settings and Health Profile

Users configure their health profile (surgery date, dietary restrictions,
tracking preferences), manage AI API keys, and control data sync.
The settings surface also provides data export and account deletion.

### Testing

Comprehensive test coverage across Convex backend tests for data
integrity (food pipeline mutations and LLM matching), shared utility
unit tests (food canonicalization, normalization, registry, evidence
scoring, pipeline display), and Playwright E2E specs covering daily
tracking, food pipeline branches, patterns food trials, settings, and
destructive operations (11 spec files, 75+ tests as of 2026-03-15).

## Feature-Gated / Deferred

### In the codebase but not ready for v1.0

- **Reproductive health tracking**: descoped for v1 per ADR-0008.
  Feature flag gating required but not yet implemented. Currently still discoverable via Settings.
- **Food safety database on Patterns page**: partially functional but
  has known issues with data reliability. Shipping in limited form.
- **Dr. Poo report deduplication**: reports can generate duplicates under
  certain timing conditions. Known issue, not a launch blocker.
- **Transit map**: IN scope for v1. Server pipeline complete (11/11 tasks),
  Phase 5 UI work in progress.

### Planned for v1.1+

- **Photo food parsing**: camera-based meal logging via vision AI models.
- **Onboarding wizard**: guided setup flow for new users.
- **Gamification expansion**: basic streaks and confetti celebrations
  ship in v1.0; the broader system (badges, challenges, the
  miniChallenge engine) exists but is being migrated and stabilised.
- **Meal plan table**: structured meal planning based on safe food data.
- **Server-side API routing**: move AI API calls behind a server to
  eliminate client-side key exposure.
- **Patterns page reimagining**: richer visualisation of food-outcome
  correlations.

### Parking lot (no timeline)

- Periodic backup/export to file
- Multi-user or family support
- Wearable device integration
- Medication tracking
- PDF report export
- End-to-end encryption

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

A recovering patient installs PDH, logs their meals and bowel
movements daily with minimal friction, and within two to four weeks
has a clear picture of which foods are safe, which are risky, and
which to avoid. The AI coaching reinforces patterns they might miss
and keeps them motivated to continue tracking during a difficult
recovery period.

The app does not replace medical advice. It gives the patient data
and confidence to have informed conversations with their surgeon or
dietitian about what is and is not working during recovery.
