# Caca Traca — Strategic Overview

> Generated 2026-03-06 from an 8-agent deep scan of the entire codebase.
>
> **Staleness note (2026-03-15):** This document predates the food system rebuild (Phases 1–4 complete as of 2026-03-14). References to `TransitMap.tsx`, `StationDetailPanel.tsx`, `TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`, `foodCategoryMapping.ts`, `LineCategory`, and `TransitLine` are outdated — these files/types were deleted or replaced in Phase 2.5. The "No E2E tests" entry in Section 4 is no longer accurate — an E2E suite of 75+ tests now exists across 11 Playwright spec files. See [ADR-0002](adrs/0002-food-registry-and-canonicalization.md) for current food system state.

---

## Table of Contents

1. [What the App Is](#1-what-the-app-is)
2. [What Exists Today](#2-what-exists-today)
3. [Contradictions & Inconsistencies](#3-contradictions--inconsistencies)
4. [Missing Pieces](#4-missing-pieces)
5. [Data Portability & Sync Gaps](#5-data-portability--sync-gaps)
6. [Security Posture](#6-security-posture)
7. [Performance & Bundle](#7-performance--bundle)
8. [Component Health](#8-component-health)
9. [Strategic Recommendations](#9-strategic-recommendations)
10. [E2E Test Strategy](#10-e2e-test-strategy)

---

## 1. What the App Is

An ADHD-friendly ostomy recovery tracker for post-reconnective surgery patients. Core purpose:

- **Track** food intake (with preparation state), fluid, bowel movements (Bristol 1-7), habits, activity, weight, reproductive health
- **Correlate** foods with digestive outcomes using transit time windows and Bristol scores
- **Coach** via Dr. Poo (AI nutritionist) — gamified, reward-based, no punishment
- **Visualize** food safety journey via a transit map (metro cartography metaphor)

Stack: React 19 + Vite + Convex + Zustand + Tailwind CSS 4 + Clerk auth

---

## 2. What Exists Today

### Pages (5 authenticated + 4 public)

| Page         | Route           | Status   | Purpose                                                                |
| ------------ | --------------- | -------- | ---------------------------------------------------------------------- |
| Track        | `/`             | Working  | Daily logging hub: food, fluid, bowel, habits, activity, weight, repro |
| Patterns     | `/patterns`     | Working  | Transit map + database table + hero metrics + correlations             |
| Settings     | `/settings`     | Working  | Health profile, AI config, habits, fluid presets, personalization      |
| Archive      | `/archive`      | Working  | Historical Dr. Poo reports with star/filter                            |
| Menu         | `/menu`         | Skeleton | Meal slots with safe foods by category — minimal implementation        |
| Landing      | `/home`         | Working  | Marketing page with pricing, waitlist, API key guide                   |
| Terms        | `/terms`        | Working  | Legal                                                                  |
| Privacy      | `/privacy`      | Working  | Legal                                                                  |
| Transit Test | `/transit-test` | Dev only | TransitMap component testing                                           |

### Core Engines

| Engine              | Files                                       | Status  | Notes                                                                   |
| ------------------- | ------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| Food parsing (AI)   | `foodParsing.ts`, `useFoodParsing.ts`       | Working | GPT-5-mini parses free text + photos into canonical ingredients         |
| Transit correlation | `analysis.ts`                               | Working | 55min-18h windows, Bristol classification, factor analysis              |
| Dr. Poo reports     | `aiAnalysis.ts` (1807 lines)                | Working | Full diagnostic with lifestyle experiments, mini challenges, meal plans |
| Food trial system   | `trialEngine.ts`, `foodStatusThresholds.ts` | Working | 8 statuses, 3 zones, 12h gap enforcement, point-based gamification      |
| Habit tracking      | `habitTemplates.ts`, `habitAggregates.ts`   | Working | 23 templates, streaks, good-day logic                                   |

### Data Model (18 Convex tables)

logs, ingredientExposures, ingredientOverrides, ingredientProfiles, aiAnalyses, conversations, foodAssessments, reportSuggestions, foodTrialSummary, weeklyDigest, weeklySummaries, profiles, foodLibrary, waitlistEntries, trialSessions, stationDefinitions, gameState, ingredientTemplates

### Component Count: ~144 files

- Track domain: ~30 components (sections, sub-rows, drawers, popovers)
- Settings domain: ~25 components (4 main forms, ~20 sub-sections)
- Patterns domain: ~20 components (hero tiles, transit map, database table, filters)
- AI insights: 6 components
- UI primitives: 32 files
- Landing: 16 components

---

## 3. Contradictions & Inconsistencies

### CRITICAL: Transit Time — Three Different Sources Disagree

| Source               | Values                                                                | Implication                                        |
| -------------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| `analysis.ts` (code) | 55min start, 0-8h normal, 8-14h slow, 14-18h very slow, 18h+ abnormal | Hardcoded windows drive food status classification |
| Dr. Poo prompt (AI)  | "Detective, not calculator" — NO hardcoded windows, clinical judgment | AI explicitly told to OVERRIDE hardcoded windows   |
| Medical literature   | Highly variable: 12-36h typical post-surgery, depends on anatomy      | Neither source calibrated to user                  |

**Impact**: The code classifies a food as "bad" at 14h+ transit, but Dr. Poo might call the same food "safe" because clinical context says 14h is normal for this patient. The food database and AI report will disagree.

**Your toast example**: Toast flagged as "risky" by the code engine (because a diarrhea event happened within the transit window), but Dr. Poo should have said "toast is safe with 26/27 good trials" — the code doesn't have enough weighting to override a single bad correlation.

### CRITICAL: Food Status — Code vs AI Disagree on Thresholds

| System               | Threshold                                                         | Status                            |
| -------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Code (`analysis.ts`) | MIN_RESOLVED_TRIALS = 2, RISKY_BAD_COUNT = 2, WATCH_BAD_COUNT = 1 | 1 bad trial = "watch" immediately |
| Dr. Poo prompt       | 3-trial rolling window, database is primary reference             | More forgiving, considers context |

**Impact**: With only 2 trials needed to graduate from "testing", a food can become "watch" with just 1 bad event out of 2. This is too aggressive — your toast (1 bad out of 27) should never be "watch" let alone "risky".

### MODERATE: Food Status Types — 6 vs 8

| Location                 | Statuses                                               |
| ------------------------ | ------------------------------------------------------ |
| Frontend `FoodStatus`    | safe, safe-loose, safe-hard, testing, watch, risky (6) |
| Convex `FoodTrialStatus` | + culprit, cleared (8)                                 |
| Dr. Poo prompt           | References all 8                                       |

**Impact**: The frontend can't display "culprit" or "cleared" foods. If Dr. Poo marks something as "culprit", it has no UI representation.

### MODERATE: No Trust Scoring / Confidence Weighting

The code counts resolved trials (`resolvedTransits`) but doesn't weight them. 27 safe trials should massively outweigh 1 bad trial, but the current system treats them equally in the status algorithm. There's no decay, no confidence interval, no Bayesian updating.

### MINOR: Half-Week Boundary Mismatch

| Location              | Boundary                         |
| --------------------- | -------------------------------- |
| Code / store comments | Sunday 18:00 <-> Wednesday 18:00 |
| ConversationPanel.tsx | Sunday 21:00 <-> Wednesday 21:00 |

### MINOR: Fluid Preset Sync is Lossy

- IndexedDB stores `FluidPreset[]` (name + defaultMl)
- Convex profiles stores `string[]` (names only)
- Round-trip loses `defaultMl` values

---

## 4. Missing Pieces

### From Your Vision (described in conversation)

| Feature                                                                   | Status  | Gap                                                                                    |
| ------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| Pre-populated 100+ foods by preparation state                             | Partial | ~50 stations in transitData.ts, but no comprehensive food+prep library                 |
| Food = state + preparation (raw carrot vs boiled carrot)                  | Partial | `preparation` field exists on FoodItem, but not enforced in parsing/display            |
| Subcategories (carbs -> veg/salad/fruit/grain, fats -> healthy/unhealthy) | Partial | 6 LineCategories exist, some subcategories in transitData, but not systematic          |
| Trust scoring (27 safe trials should counter 1 bad)                       | Missing | No weighting algorithm — just counts                                                   |
| Dr. Poo's assessment weighting vs trial record weighting                  | Missing | No mechanism to reconcile AI verdict with statistical evidence                         |
| Configurable transit time (calibrated to user)                            | Missing | Hardcoded constants in analysis.ts                                                     |
| Environmental factors override food blame                                 | Partial | Factor analysis exists (walk, smoking, sleep, fluid) but doesn't influence food status |
| ADHD-friendly gamification on every surface                               | Partial | Gamification exists but limited to streaks/confetti, not deeply integrated             |

### Technical Gaps

| Gap                               | Impact                                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| No offline queue for log creation | Logs lost if network fails during creation                                  |
| No real-time multi-device sync    | Manual "Load Profile" required on second device                             |
| No data import                    | Can't restore from export                                                   |
| No data export (full)             | Only raw logs exportable, no settings/profiles/AI history                   |
| Habit logs never sync to Convex   | Lost on browser clear or new device                                         |
| E2E tests exist but many failing  | 75+ E2E tests across 11 Playwright spec files; selector/timing fixes needed |

---

## 5. Data Portability & Sync Gaps

### What Survives What

| Data                            | Same Browser       | New Browser       | Browser Clear     |
| ------------------------------- | ------------------ | ----------------- | ----------------- |
| Logs (food, bowel, fluid, etc.) | Yes (Convex)       | Yes (Convex)      | Yes (Convex)      |
| Health Profile                  | Yes (IDB + Convex) | Yes (manual load) | Yes (manual load) |
| AI Preferences                  | Yes (IDB + Convex) | Yes (manual load) | Yes (manual load) |
| Habits (config)                 | Yes (IDB + Convex) | Yes (manual load) | Yes (manual load) |
| Gamification                    | Yes (IDB + Convex) | Yes (manual load) | Yes (manual load) |
| AI Reports                      | Yes (Convex)       | Yes (Convex)      | Yes (Convex)      |
| Conversations                   | Yes (Convex)       | Yes (Convex)      | Yes (Convex)      |
| Game State                      | Yes (Convex)       | Yes (Convex)      | Yes (Convex)      |
| **OpenAI API Key**              | **Yes (IDB)**      | **LOST**          | **LOST**          |
| **Habit Logs**                  | **Yes (IDB)**      | **LOST**          | **LOST**          |
| **Dr. Poo Draft Replies**       | **Yes (IDB)**      | **LOST**          | **LOST**          |
| **Food Personalisation**        | **Yes (IDB)**      | **LOST**          | **LOST**          |
| **Pane Summary Cache**          | **Yes (IDB)**      | **LOST**          | **LOST**          |
| **Baseline Averages**           | **Yes (IDB)**      | **Recomputed**    | **Recomputed**    |

### Sync Architecture Issues

1. **No automatic profile sync** — user must manually save/load profile
2. **Last-write-wins** — no conflict detection between devices
3. **Habit logs are local-only** — the most valuable longitudinal data (90 days of daily habit counts) never reaches the cloud
4. **Fluid preset defaultMl lost on sync** — Convex only stores names

---

## 6. Security Posture

### Overall: Strong foundation, 3 actionable items

| Area                  | Status | Notes                                                                        |
| --------------------- | ------ | ---------------------------------------------------------------------------- |
| Auth (Clerk + Convex) | GREEN  | All mutations check userId, proper JWT flow                                  |
| Input sanitization    | GREEN  | Control chars, Unicode normalization, length limits                          |
| XSS protection        | GREEN  | React escaping, no dangerouslySetInnerHTML                                   |
| Convex authorization  | GREEN  | Every mutation verifies userId ownership                                     |
| Service worker        | GREEN  | No sensitive data cached                                                     |
| Dependencies          | GREEN  | No known vulnerabilities                                                     |
| API key storage       | YELLOW | Browser IndexedDB (plaintext) — intentional but high-value target            |
| Prompt injection      | YELLOW | Health profile fields interpolated into AI prompts without injection defense |
| Data deletion         | YELLOW | Convex cleared on delete, but IndexedDB may persist                          |
| CSP headers           | YELLOW | Not configured (Vite defaults)                                               |

---

## 7. Performance & Bundle

### Estimated Bundle: ~700-1000 KB gzipped

| Heavy Dependency         | Size Est.  | Used For                |
| ------------------------ | ---------- | ----------------------- |
| Recharts + D3            | 150-200 KB | Charts on Patterns page |
| Motion (Framer)          | 80-100 KB  | Animations              |
| @xyflow/react            | 100-150 KB | Transit map             |
| Radix UI (18 components) | 80-120 KB  | Headless UI primitives  |
| Convex client            | 60-70 KB   | Cloud sync              |
| OpenAI client            | 40-50 KB   | AI calls                |

### Performance Issues Found

1. **No React.memo() anywhere** — all children re-render when parent state changes
2. **Track page re-renders every 60s** — header `now` state triggers full tree re-render
3. **No useShallow() on store selectors** — each selector is a separate subscription
4. **useBaselineAverages** likely recomputes 90-day aggregation on every render
5. **No virtual scrolling** for long log lists
6. **AI analysis runs on main thread** — blocks UI during report generation
7. **Recharts renders full D3** on every prop change

### What's Working Well

- Lazy-loaded pages (Patterns, Settings, Archive, Menu)
- PWA with offline caching
- Manual code split chunks (vendor, openai, convex, router)
- Zustand + IndexedDB is lightweight

---

## 8. Component Health

### Well-Structured Areas

- Track page: Clean section-based composition (FoodSection, BowelSection, etc.)
- Settings: Proper form decomposition (4 main forms, ~20 sub-sections)
- Today log: Good grouping pattern (GroupRow -> SubRow -> editors)

### Problem Areas

| Issue                    | Location                                                                  | Impact                              |
| ------------------------ | ------------------------------------------------------------------------- | ----------------------------------- |
| Orphaned components      | `AICoachStrip.tsx`, `DailyProgress.tsx`, `Reasuring.tsx` (typo duplicate) | Dead code                           |
| TransitMap.tsx is 30KB   | Single file                                                               | Hard to maintain/test               |
| TrackingForm.tsx is 21KB | Single settings form                                                      | Should split into sub-sections      |
| No memoization anywhere  | All components                                                            | Unnecessary re-renders              |
| Radix UI still used      | 18 UI components                                                          | Should be Base UI per project rules |

---

## 9. Strategic Recommendations

### Phase 1: Fix the Core Engine (The "Toast Problem")

This is the most important thing. The food status algorithm is too simplistic and disagrees with the AI. Fix this first:

1. **Implement confidence-weighted food scoring**
   - Score = (safe_trials / total_trials) with Bayesian prior
   - 27/28 safe = 96% confidence -> stays "safe" even with 1 bad
   - 2/3 bad = low confidence -> "watch"
   - Weight Dr. Poo's verdict as equivalent to N trials (e.g., 3)

2. **Make transit time configurable per user**
   - Default windows as starting point
   - Learn from user's actual transit data (median transit time)
   - Allow manual override in settings

3. **Reconcile code engine with AI engine**
   - Single source of truth: Dr. Poo's `foodTrialDatabase` assessment
   - Code engine provides data; AI engine provides verdict
   - Display AI verdict as primary, code stats as secondary

4. **Add environmental factor weighting**
   - If stress + smoking + dehydration are present, don't blame food
   - Factor signals should modify food status confidence, not just display

### Phase 2: Data Integrity & Portability

5. **Sync habit logs to Convex** — this is the most valuable longitudinal data
6. **Auto-sync profile on every change** (debounced, not manual)
7. **Sync foodPersonalisation and API key** (encrypted) to Convex
8. **Fix fluid preset lossy sync** — store full FluidPreset objects in Convex
9. **Add full data export** (JSON with all settings, logs, AI history)
10. **Add data import** from exported JSON

### Phase 3: Food Database & Pre-population

11. **Build comprehensive food+preparation library** (100+ foods)
    - Each food has preparation variants (raw, boiled, grilled, fried, mashed, pureed)
    - Each variant is a separate station on the transit map
    - Pre-categorized: carbs (veg/fruit/grain), proteins (meat/dairy/plant), fats (healthy/unhealthy), seasoning

12. **Zone progression system**
    - Zone 1: BRAT + simple soft foods (starter kit, ~20 foods)
    - Zone 2: Expanded soft/cooked foods (~40 foods)
    - Zone 3: Full variety (~40+ foods)
    - User progresses by clearing zones

### Phase 4: Performance & Quality

13. **Add React.memo() to expensive components** (TransitMap, TodayLog, AiInsightsSection)
14. **Extract header timer** to isolated context (stop 60s full-tree re-renders)
15. **Lazy-load Recharts** only on Patterns page
16. **Add useShallow()** to Zustand selectors
17. **Split TransitMap.tsx** (30KB) into sub-components

### Phase 5: Security Hardening

18. **Add prompt injection defense** to health profile fields before AI prompt inclusion
19. **Clear IndexedDB on account deletion** (`del("ostomy-tracker-storage")`)
20. **Add CSP headers** to deployment config

---

## 10. E2E Test Strategy

### What to Test with Playwright

Based on the codebase analysis, here are the critical user flows that need E2E coverage:

#### Tier 1: Core Tracking (Must Have)

| Test                                    | What It Verifies                                   |
| --------------------------------------- | -------------------------------------------------- |
| Log a food entry via natural language   | Food parsing AI works, entry appears in TodayLog   |
| Log a bowel movement with Bristol score | BowelSection saves correctly, triggers AI analysis |
| Log fluid intake                        | FluidSection saves, updates daily total            |
| Quick capture habit tap                 | Habit counter increments, gamification updates     |
| View today's log entries                | TodayLog renders all entry types correctly         |
| Delete a log entry                      | Entry removed from TodayLog and Convex             |
| Edit a log entry inline                 | Sub-row editor saves changes                       |

#### Tier 2: AI & Analysis (High Value)

| Test                                         | What It Verifies                                         |
| -------------------------------------------- | -------------------------------------------------------- |
| Trigger Dr. Poo analysis                     | Real OpenAI call, response rendered in AiInsightsBody    |
| Dr. Poo report sections render               | All sections present (culprits, safe, suggestions, etc.) |
| Food parsing returns correct canonical names | "jam sandwich" -> bread + jam components                 |
| Scheduled insight appears                    | 14:00/20:00 insight generated and displayed              |
| Conversation follow-up                       | User reply sent, Dr. Poo responds                        |

#### Tier 3: Patterns & Transit Map

| Test                             | What It Verifies                            |
| -------------------------------- | ------------------------------------------- |
| Transit map renders stations     | SVG stations visible with correct colors    |
| Click station shows detail panel | StationDetailPanel opens with trial history |
| Database table filters work      | SmartViews, FilterSheet, column sorting     |
| Hero metrics display             | Bristol trend, BM frequency, transit score  |

#### Tier 4: Settings & Configuration

| Test                     | What It Verifies                                  |
| ------------------------ | ------------------------------------------------- |
| Set OpenAI API key       | Key saved to store, AI features unlock            |
| Edit health profile      | All fields save correctly                         |
| Configure AI preferences | Preset selection updates approach/register/format |
| Add custom fluid preset  | Preset appears in FluidSection                    |
| Hide/show habits         | Habit visibility toggles in QuickCapture          |

#### Tier 5: Data Integrity

| Test                              | What It Verifies                                       |
| --------------------------------- | ------------------------------------------------------ |
| Food status after multiple trials | Status progresses: testing -> safe                     |
| Food status after bad trial       | Status changes: safe -> watch (with proper weighting)  |
| Profile sync to Convex            | Save profile, clear IDB, load profile -> data restored |
| Gamification streak               | Log entries on consecutive days -> streak increments   |

### OpenAI in E2E Tests

**Yes, it's possible and recommended for critical paths:**

1. **Real API calls**: Use a test API key with spend limits. Playwright can wait for network responses.
2. **Response validation**: Assert that Dr. Poo's response contains expected JSON fields (summary, suspectedCulprits, likelySafe, etc.)
3. **Food parsing validation**: Assert canonical names, quantities, preparations are correctly extracted.
4. **Cost control**: Use `gpt-5-mini` (cheapest) for all E2E tests, limit to essential flows.
5. **Timeout handling**: AI calls can take 5-30s. Set appropriate Playwright timeouts.

**Authentication in E2E**:

- Clerk supports test mode with `CLERK_TESTING_TOKEN`
- Or use Clerk's `setupClerkTestingToken()` in Playwright global setup
- Convex will authenticate via the Clerk JWT automatically

---

## Appendix: File Map

### Critical Files (read these to understand the app)

| File                              | Lines | Purpose                                                 |
| --------------------------------- | ----- | ------------------------------------------------------- |
| `src/store.ts`                    | ~800  | All app state, migrations, actions                      |
| `src/lib/aiAnalysis.ts`           | 1807  | Dr. Poo prompts, system prompt builder, insight fetcher |
| `src/lib/analysis.ts`             | 915   | Food-to-poo correlation engine                          |
| `src/lib/sync.ts`                 | 748   | Convex sync hooks, type definitions                     |
| `src/lib/foodParsing.ts`          | ~400  | AI food parsing logic                                   |
| `src/lib/trialEngine.ts`          | ~300  | Trial sessions, gap enforcement, points                 |
| `src/lib/foodStatusThresholds.ts` | ~200  | Status taxonomy, zone assignments                       |
| `src/pages/Track.tsx`             | 569   | Main tracking page                                      |
| `src/pages/Patterns.tsx`          | 880   | Analytics page                                          |
| `src/components/TransitMap.tsx`   | ~30KB | Metro-style food map                                    |
| `src/types/domain.ts`             | ~200  | All domain types                                        |
| `convex/schema.ts`                | ~150  | Database schema (18 tables)                             |

---

## Progress Log

### 2026-03-14 — Food System Phases 1–4 Complete

Server-side food pipeline Tasks 1–11 all done. The food system now has: a fully normalized food registry, Bayesian evidence engine, client-initiated LLM food matching (BYOK, user-triggered, not server-scheduled), shared/ utilities directory, Convex-side normalization unified under a single path. Phase 5 (transit map UI + game layer) is future work. E2E suite written: 75+ tests across 11 Playwright spec files covering food pipeline, patterns, and all core tracking flows. Many tests currently failing due to selector/timing issues — fixes are next. Backfill migration for `resolvedBy` field on legacy food items completed. Five food pipeline UI bugs fixed (display names, expired re-matching, old log status, patterns table, review modal queue UX).

### 2026-03-10 — Browser Testing Pass 2 (Track page only)

18 bugs verified fixed. 4 still broken: #6 (Fluids — full revert needed), #45 (Toasts), #49 (Units consistency), #4 (BM time layout). 18 new issues found (#64–#81). Patterns/Settings/AI/Menu pages not yet tested.

**Phase 1 progress update:**

- Bayesian food scoring: **Partially implemented** — `foodEvidence.ts` has Bayesian engine with thresholds, `computeTrend` uses Bayesian signals. But confidence weighting for the "toast problem" (1 bad out of 27 should not flip status) still needs verification.
- Configurable transit time: **Done** — `ObservationWindow` uses learned `transitCalibration` from store instead of hardcoded values.
- Reconcile code vs AI engine: **Not started** — still a fundamental gap.
- Environmental factor weighting: **Not started**.

**New strategic requirement:** OpenAI prompt management — use dashboard prompt IDs instead of sending full prompt text in every API call. Discovered 2026-03-10, flagged as required before v1 ship.

**Abandoned:** Pre-sync Onboarding Modal — tried, didn't work as UX, removed. PRD (`plans/PRD-health-profile-and-presync-modal.md`) is historical only.

**Full bug tracker:** `docs/browser-testing/2026-03-09-v1-test-run.md`

### 2026-03-09 — Browser Testing Pass 1

63 bugs found across all pages. 61 fixed in a single session (commit 2216021). 2 deferred as design tasks (#1 menu nav, #60 track layout). Key fixes: async food parsing, Bayesian engine wiring, food safety grid, menu page rewrite, Dr Poo personality modes, conversation panel, archive markdown, transit map enabled.
