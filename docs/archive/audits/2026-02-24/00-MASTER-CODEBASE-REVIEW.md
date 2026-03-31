# Caca Traca -- Master Codebase Review

**Date:** 2026-02-24
**Scope:** Full codebase audit across 8 domains
**Codebase:** 61 TypeScript/TSX files, ~13,254 lines of code
**Stack:** React 19 + TypeScript 5.8 + Vite 6 + Convex + Zustand 5 + Tailwind CSS 4

---

## Executive Summary

Caca Traca is a personal ostomy recovery tracker with an impressive feature set: AI-powered food parsing, a sophisticated food-to-digestion correlation engine, gamification with streak tracking, and an offline-first architecture with cloud sync. The domain logic demonstrates genuine clinical understanding, and the UI has a cohesive "Aurora Glass" design system.

However, the codebase has significant structural issues that must be addressed before any broader deployment. The most critical problems fall into three categories:

1. **Security is high-risk.** There is zero authentication on the Convex backend -- anyone who guesses a sync key (default: `"my-recovery-key"`) can read/write all health data, including HIV status, medication details, and bowel habits. API keys are exposed client-side.

2. **Type safety is absent.** The most important data field (`LogEntry.data`) is typed as `any` everywhere -- in TypeScript, in Convex schemas, and in the sync layer. TypeScript strict mode is disabled. This means the compiler cannot catch any data-related bugs.

3. **Zero test coverage.** Not a single automated test exists across 8,000+ lines of business logic, including the medically significant food correlation engine.

Despite these issues, the codebase has a solid foundation. The architecture is well-organized, the domain modeling is thorough, the AI integration is robust with proper fallbacks, and the newer components show a clear trend toward better patterns. The technical debt is addressable with focused effort.

### Scorecard

| Domain                      | Grade             | Key Issue                                                           |
| --------------------------- | ----------------- | ------------------------------------------------------------------- |
| Security                    | **F** (High Risk) | No authentication; API keys client-side; sensitive data unencrypted |
| Architecture                | **B-**            | Solid foundation; needs consolidation and lazy loading              |
| Frontend Design & UI/UX     | **B+**            | Strong visual identity; accessibility debt                          |
| DevOps                      | **1/5** (Ad-hoc)  | No CI/CD, no deployment process, API key in bundle                  |
| Testing & QA                | **0/10**          | Zero tests, zero infrastructure                                     |
| Performance                 | **6/10**          | Duplicate subscriptions, no code splitting, redundant computation   |
| Code Quality                | **C+**            | Pervasive `any` types, god components, duplicated code              |
| Data Model & Business Logic | **7/10**          | Strong domain logic; untyped schema, Bristol mapping bug            |

---

## All Issues by Severity

### CRITICAL (Immediate Action Required)

These issues pose active risks to data integrity, security, or correctness and should be addressed before any further feature work.

| #     | Issue                                                                                                                                                                                                     | Domain(s)                              | Location                                                                                                                   | Impact                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| CR-1  | **No authentication on Convex backend** -- all data access gated only by a guessable `syncKey` string (default: `"my-recovery-key"`). Anyone can read/write/delete any user's health data.                | Security, Architecture, Data Model     | `convex/logs.ts:77-96`, `src/store.ts:209`                                                                                 | Complete data exposure for all users                    |
| CR-2  | **`v.any()` used for log data fields** -- the most critical field in the database has zero server-side validation. Corrupt data enters silently; 11 `v.any()` usages across 3 Convex tables.              | Architecture, Code Quality, Data Model | `convex/schema.ts:81,89-91`, `convex/logs.ts:134`                                                                          | Silent data corruption, runtime crashes                 |
| CR-3  | **OpenAI API key stored in browser** -- used with `dangerouslyAllowBrowser: true`, stored in plaintext IndexedDB, visible in network requests.                                                            | Security, DevOps                       | `src/lib/foodParsing.ts:191`, `src/lib/aiAnalysis.ts:529`, `src/store.ts:97`                                               | API key theft, financial liability                      |
| CR-4  | **Gemini API key baked into client bundle** via Vite `define` -- extractable from built JavaScript.                                                                                                       | Security, DevOps                       | `vite.config.ts:14`                                                                                                        | API key exposure in production                          |
| CR-5  | **Hardcoded patient medical data in source code** -- HIV status, medication (Biktarvy), drug use patterns, and other sensitive details are hardcoded in AI prompts and committed to a public GitHub repo. | Security, Data Model, Code Quality     | `src/lib/aiAnalysis.ts:12-15, 220-444`                                                                                     | PHI exposure in public repository                       |
| CR-6  | **Zero automated tests** -- no test framework, no test files, no test scripts across 8,000+ lines of business logic including medically significant correlation algorithms.                               | Testing, Code Quality                  | Entire codebase                                                                                                            | No regression safety; health data at risk               |
| CR-7  | **TypeScript strict mode disabled** -- no `strictNullChecks`, no `noImplicitAny`, combined with Biome's `noExplicitAny: "off"`. 43 occurrences of `: any` across 13 files.                                | Code Quality, Testing                  | `tsconfig.json`, `biome.json:22`                                                                                           | Entire categories of bugs invisible to compiler         |
| CR-8  | **Hardcoded patient constants ignore configurable HealthProfile** -- AI module uses hardcoded surgery date, weight, and height instead of the user's actual settings.                                     | Data Model, Architecture               | `src/lib/aiAnalysis.ts:12-14`                                                                                              | AI gives clinically incorrect advice for any other user |
| CR-9  | **Duplicate Convex subscriptions** -- `useSyncedLogs(1200)` called independently in 5+ components, each creating separate WebSocket subscriptions for the same 1200 logs.                                 | Performance                            | `Track.tsx:65`, `useAiInsights.ts:19`, `FoodSafetyDatabase.tsx:353`, `DaySummaryCard.tsx:36`, `HabitsStreaksWeight.tsx:25` | 3-5x memory usage, multiplied network traffic           |
| CR-10 | **No code splitting** -- entire OpenAI SDK (~200KB), all pages, and all libraries bundled in single 1MB initial load.                                                                                     | Performance, DevOps                    | `src/App.tsx:14-16`                                                                                                        | Slow initial load, wasted bandwidth                     |

### HIGH (Address This Week)

These issues significantly affect maintainability, reliability, or user experience.

| #     | Issue                                                                                                                                                                                  | Domain(s)                              | Location                                                      | Impact                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| HI-1  | **Sensitive health data stored unencrypted** -- HIV status, drug use, surgical history stored in plaintext in IndexedDB and Convex.                                                    | Security                               | `src/store.ts:45-58`, `convex/schema.ts:70-84`                | Data breach exposes deeply personal medical info        |
| HI-2  | **AI request/response payloads stored with sensitive data** -- full system prompts (containing hardcoded patient details) saved in Convex `aiAnalyses` table, accessible via sync key. | Security                               | `convex/aiAnalyses.ts:4-29`                                   | Sensitive data duplicated in every analysis record      |
| HI-3  | **Sync key is sole access control (IDOR)** -- user-chosen string, no complexity requirement, default shared across all users.                                                          | Security, Data Model                   | `src/store.ts:209,218`                                        | Data enumeration, unauthorized access                   |
| HI-4  | **Duplicated Convex validators** -- `habitConfig`, `habitType`, `habitCategory` etc. defined identically in both `schema.ts` and `logs.ts`.                                            | Architecture, Code Quality             | `convex/schema.ts:4-67`, `convex/logs.ts:4-75`                | Divergence bugs (already happened: `"sweets"` mismatch) |
| HI-5  | **`"sweets"` habit type mismatch** -- present in `schema.ts` validator but missing from `logs.ts` validator and frontend `HabitType`.                                                  | Architecture, Data Model, Code Quality | `convex/schema.ts:20` vs `convex/logs.ts:33`                  | Mutation failures for `"sweets"` habits                 |
| HI-6  | **God components** -- `TodayLog.tsx` (2,318 lines), `Settings.tsx` (995 lines) concentrate too many responsibilities.                                                                  | Code Quality                           | `src/components/track/TodayLog.tsx`, `src/pages/Settings.tsx` | Hard to maintain, review, and test                      |
| HI-7  | **No CI/CD pipeline** -- no GitHub Actions, no automated checks, no deployment process.                                                                                                | DevOps                                 | `.github/` directory absent                                   | Bugs shipped directly to master                         |
| HI-8  | **Platform-specific deps in production** -- 5 `linux-arm64` native packages in `dependencies` instead of `optionalDependencies`.                                                       | DevOps                                 | `package.json:16-19,28`                                       | Bloated installs, cross-platform issues                 |
| HI-9  | **`vite` in both deps and devDeps**                                                                                                                                                    | DevOps, Code Quality                   | `package.json:41,52`                                          | Duplicate dependency                                    |
| HI-10 | **No lazy loading for pages** -- Patterns, Settings eagerly imported.                                                                                                                  | Performance, Architecture              | `src/App.tsx:14-16`                                           | Wasted bandwidth for unused pages                       |
| HI-11 | **Redundant `analyzeLogs()` computation** -- expensive O(n\*m) analysis runs independently in multiple components with same input.                                                     | Performance                            | `Track.tsx:119`, `FoodSafetyDatabase.tsx:356`                 | Doubled CPU work on every log change                    |
| HI-12 | **Settings page destructures entire Zustand store** without selectors -- every state change re-renders entire page.                                                                    | Performance                            | `src/pages/Settings.tsx:44-66`                                | Excessive re-renders on every keystroke                 |
| HI-13 | **Modal missing focus trap** -- PreSyncCheckInModal has `role="dialog"` but no focus management, no Escape key handling.                                                               | Frontend Design                        | `src/components/PreSyncCheckInModal.tsx:66-242`               | Keyboard/screen reader users cannot use modal           |
| HI-14 | **Bristol scale picker lacks ARIA semantics** -- no `role="radiogroup"`, no arrow key navigation.                                                                                      | Frontend Design                        | `src/components/track/BowelSection.tsx:360-403`               | Inaccessible to screen reader users                     |
| HI-15 | **Inline hover handlers break keyboard accessibility** -- hover styles applied via JS, not triggered by keyboard focus.                                                                | Frontend Design, Code Quality          | `FluidSection.tsx:93-98`, `QuickFactors.tsx:77-84`            | Invisible focus states for keyboard users               |
| HI-16 | **FluidSection ignores user-configured presets** -- hardcoded `["Aquarius", "Coffee", "Coke", "Juice"]` instead of reading from store.                                                 | Architecture, Frontend Design          | `src/components/track/FluidSection.tsx:7`                     | Settings page presets are non-functional                |
| HI-17 | **No offline write support** -- mutations require Convex connectivity; log entries lost if offline.                                                                                    | Data Model, Architecture               | `src/lib/sync.ts`                                             | Data loss on connectivity loss                          |
| HI-18 | **Google Fonts blocking initial render** -- 3 font families with multiple weights loaded synchronously.                                                                                | Performance                            | `index.html:7-12`                                             | 500ms-2s added to First Contentful Paint                |
| HI-19 | **Untested food-stool correlation engine** -- 910 lines of medically significant logic with boundary conditions at 55min, 8h, 14h, 18h.                                                | Testing                                | `src/lib/analysis.ts`                                         | Incorrect dietary recommendations possible              |
| HI-20 | **Untested store migration** -- version 8 migration transforms persisted state; bug = silent data corruption.                                                                          | Testing                                | `src/store.ts:327-373`                                        | User data loss on app update                            |
| HI-21 | **Health profile not synced to Convex** -- lost on browser clear or device switch.                                                                                                     | Data Model                             | `src/store.ts:128-129`                                        | Profile data loss across devices                        |
| HI-22 | **Dead code files** -- `FoodDrinkSection.tsx`, `WeightSection.tsx`, `shouldShowSleepNudge()` unused.                                                                                   | Code Quality                           | Various                                                       | Bundle bloat, maintenance confusion                     |

### MEDIUM (Address Next Sprint)

These issues affect code quality, consistency, or edge-case correctness.

| #     | Issue                                                                                                                                                          | Domain(s)                  | Location                                        | Impact                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------- | ------------------------------------------- |
| MD-1  | **Bristol code mapping inconsistency** -- `Track.tsx` maps Bristol 5 as "loose", `analysis.ts` maps it as "firm". Affects food safety classification accuracy. | Data Model                 | `Track.tsx:47-50` vs `analysis.ts:783-784`      | Food safety status skewed                   |
| MD-2  | **`LogEntry.data` typed as `any` on client** -- no compile-time safety for the most frequently accessed data structure.                                        | Code Quality, Architecture | `src/store.ts:89`, `src/lib/sync.ts:12`         | Typos in field names invisible              |
| MD-3  | **`REQUIRED_QUICK_HABITS` duplicated** between `habitTemplates.ts` and `Track.tsx` with different contents.                                                    | Architecture, Code Quality | `habitTemplates.ts:207`, `Track.tsx:37`         | Inconsistent quick habit display            |
| MD-4  | **Monolithic Zustand store** -- 25+ actions in single store blob.                                                                                              | Architecture               | `src/store.ts` (377 lines)                      | Broad subscription triggers                 |
| MD-5  | **Duplicate `useSyncedLogs` calls with different limits** (600 vs 1200) creating separate subscriptions.                                                       | Performance, Architecture  | `Settings.tsx:43` vs `Track.tsx:65`             | Doubled reactive overhead                   |
| MD-6  | **Error handling swallows details** -- `catch (err: any)` in 10 places, `.catch(console.error)` fire-and-forget patterns.                                      | Code Quality               | 7 files across codebase                         | Silent failures, untyped errors             |
| MD-7  | **`WeightFormState` defined in two files with different shapes**                                                                                               | Code Quality               | `ActivitySection.tsx:15`, `WeightSection.tsx:8` | Confusing, inconsistent interfaces          |
| MD-8  | **No Content Security Policy** headers                                                                                                                         | Security                   | `index.html`                                    | No defense-in-depth against XSS             |
| MD-9  | **Convex `remove`/`update` mutations lack ownership check** -- deletes/updates by document ID without verifying sync key.                                      | Security, Data Model       | `convex/logs.ts:145-166`                        | Any user can delete/modify any record by ID |
| MD-10 | **`dist/` not in `.gitignore`** -- build artifacts with baked-in API keys can be committed.                                                                    | DevOps                     | `.gitignore`                                    | API keys in git history                     |
| MD-11 | **No environment variable validation** -- `.env.example` documents wrong variables.                                                                            | DevOps                     | `src/main.tsx`                                  | Confusing developer onboarding              |
| MD-12 | **No bundle splitting** -- single 1MB JavaScript file.                                                                                                         | DevOps, Performance        | `vite.config.ts`                                | Slow loads, no caching granularity          |
| MD-13 | **No error tracking service** (Sentry, etc.)                                                                                                                   | DevOps                     | N/A                                             | Production errors invisible                 |
| MD-14 | **No PWA/service worker** -- app shell not cached for offline.                                                                                                 | DevOps                     | N/A                                             | App cannot load without network             |
| MD-15 | **TypeScript strict mode not enabled** in root tsconfig.                                                                                                       | DevOps, Code Quality       | `tsconfig.json`                                 | Permissive type checking                    |
| MD-16 | **AI analysis race condition** -- rapid sequential calls can permanently lock out analysis.                                                                    | Testing, Data Model        | `src/hooks/useAiInsights.ts:37-113`             | AI analysis blocked until page reload       |
| MD-17 | **`normalizeDigestiveCategory()` defaults to "loose"** for missing data -- unfairly penalizes foods.                                                           | Data Model, Testing        | `src/lib/analysis.ts:789`                       | Safe foods misclassified                    |
| MD-18 | **AbortController signal not propagated to fetch** -- aborted requests continue consuming API tokens.                                                          | Code Quality               | `src/hooks/useAiInsights.ts:42-66`              | Wasted API credits                          |
| MD-19 | **`setTimeout` without cleanup in celebration hook**                                                                                                           | Code Quality               | `src/hooks/useCelebration.ts:43-45`             | Stale timeouts, premature state clears      |
| MD-20 | **No `prefers-reduced-motion` support** in animations                                                                                                          | Frontend Design            | `BowelSection.tsx`, `Confetti.tsx`              | Accessibility violation                     |
| MD-21 | **Form validation is toast-only** -- no inline error states, no `aria-invalid`.                                                                                | Frontend Design            | `FoodSection.tsx:24`, `FluidSection.tsx:22`     | Poor form UX                                |
| MD-22 | **Three-column layout lacks medium breakpoint** -- single column from 768-1280px.                                                                              | Frontend Design            | `Track.tsx:365`                                 | Wasted space on tablets                     |
| MD-23 | **No data retention/deletion mechanism** -- no "delete all my data" capability.                                                                                | Data Model                 | All Convex mutations                            | GDPR non-compliance                         |
| MD-24 | **Food library has no case-normalized deduplication**                                                                                                          | Data Model                 | `convex/foodLibrary.ts:42-60`                   | Near-duplicate entries accumulate           |
| MD-25 | **Timezone-naive day boundaries** in factor analysis                                                                                                           | Data Model                 | `src/lib/analysis.ts:513-515`                   | Cross-timezone inconsistencies              |
| MD-26 | **Settings page too long on mobile** -- 7 sections, no jump navigation.                                                                                        | Frontend Design            | `src/pages/Settings.tsx:207-993`                | Excessive scrolling                         |
| MD-27 | **Hardcoded colors in FoodSection button** -- bypasses design token system.                                                                                    | Frontend Design            | `src/components/track/FoodSection.tsx:68-72`    | Doesn't adapt to theme changes              |
| MD-28 | **Inconsistent styling approaches** -- mixes Tailwind, inline styles, and CSS classes unpredictably.                                                           | Frontend Design            | Multiple files                                  | Maintenance burden                          |
| MD-29 | **Dev server bound to all interfaces** (`--host=0.0.0.0`)                                                                                                      | Security                   | `package.json:7`                                | Health data exposed on shared WiFi          |
| MD-30 | **`parseAiInsight()` doesn't validate nested objects**                                                                                                         | Testing                    | `src/store.ts:192-203`                          | Malformed AI data stored silently           |

### LOW (Backlog)

These are minor issues, nice-to-haves, or cosmetic improvements.

| #     | Issue                                                                             | Domain(s)              | Location                                             |
| ----- | --------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| LO-1  | No input length limits on text fields                                             | Security               | Various input components                             |
| LO-2  | Console logging may leak sensitive data                                           | Security               | `foodParsing.ts:214`, `aiAnalysis.ts:585`            |
| LO-3  | Export data lacks sensitivity warning                                             | Security               | `Settings.tsx:82-107`                                |
| LO-4  | Package name is "react-example"                                                   | DevOps, Code Quality   | `package.json:2`                                     |
| LO-5  | `autoprefixer` unused in devDependencies                                          | DevOps                 | `package.json:47`                                    |
| LO-6  | `.DS_Store` files in working tree                                                 | DevOps                 | Root and `public/`                                   |
| LO-7  | Empty `metadata.json` from template                                               | DevOps                 | `metadata.json`                                      |
| LO-8  | `noExplicitAny` disabled in Biome                                                 | Code Quality           | `biome.json:22`                                      |
| LO-9  | Error boundary background is alarming red                                         | Frontend Design        | `App.tsx:70`                                         |
| LO-10 | Unused components: `SummaryCard`, `BadgeShowcase`, `StreakBadge`, `DailyProgress` | Code Quality, Frontend | Various                                              |
| LO-11 | Backtick characters in UI text                                                    | Frontend Design        | `Settings.tsx:946-949`                               |
| LO-12 | Duplicate fluid/meals color tokens                                                | Frontend Design        | `index.css:207-217`                                  |
| LO-13 | Font loading could be optimized                                                   | Performance, Frontend  | `index.html:9-12`                                    |
| LO-14 | Missing `glass-card-weight` CSS class                                             | Frontend Design        | `WeightSection.tsx:48`                               |
| LO-15 | `RouteErrorBoundary` uses non-standard class pattern                              | Architecture           | `App.tsx:45-48`                                      |
| LO-16 | Multiple `formatWeight` functions across files                                    | Code Quality           | `WeightTrendCard.tsx:9`, `HabitsStreaksWeight.tsx:9` |
| LO-17 | Magic numbers in audio module                                                     | Code Quality           | `src/lib/sounds.ts`                                  |
| LO-18 | Long if-else chain in habitIcons                                                  | Code Quality           | `src/lib/habitIcons.tsx`                             |
| LO-19 | `allowJs: true` with no JS files                                                  | Code Quality           | `tsconfig.json:16`                                   |
| LO-20 | `experimentalDecorators` enabled unnecessarily                                    | Code Quality           | `tsconfig.json:4-5`                                  |
| LO-21 | Week averages divide by 7 regardless of actual data days                          | Data Model             | `DaySummaryCard.tsx:176-228`                         |
| LO-22 | Export limited to 600 logs (Track fetches 1200)                                   | Data Model             | `Settings.tsx:43`                                    |
| LO-23 | AI model identifiers hardcoded (stale risk)                                       | Data Model             | `foodParsing.ts:3`, `aiAnalysis.ts:6`                |
| LO-24 | Large uncompressed PNG icons in public/                                           | Performance            | `public/icons/`                                      |
| LO-25 | `readText()` edge cases with non-string values                                    | Data Model             | `analysis.ts:902-904`                                |
| LO-26 | Logo dimension mismatch (36x36 attrs vs 64x64 CSS)                                | Frontend Design        | `App.tsx:119-124`                                    |
| LO-27 | `key` prop in MealCard interface (React anti-pattern)                             | Code Quality           | `AiInsightsSection.tsx`                              |
| LO-28 | Select dropdown arrow not theme-aware                                             | Frontend Design        | `index.css:1055-1065`                                |
| LO-29 | Confetti particles lack cleanup guard                                             | Frontend Design        | `Confetti.tsx:61-73`                                 |
| LO-30 | Nav labels hidden on mobile without `aria-label`                                  | Frontend Design        | `App.tsx:165`                                        |

---

## Strengths Identified Across All Reviews

1. **Exceptional domain expertise** -- The food-to-digestion correlation engine, Bristol Stool Scale integration, transit time model, and AI system prompt demonstrate genuine clinical understanding of post-anastomosis recovery.

2. **Robust AI integration** -- Conversation history maintained across sessions, structured JSON output with validation, graceful fallback to naive parsing when API fails, and thoughtful debouncing.

3. **Cohesive visual design system** -- The Aurora Glass aesthetic with section-specific color tokens, glass cards, and noise texture overlays creates a distinctive, premium feel. The CSS token architecture is thorough.

4. **Well-designed gamification** -- Streak shields, badge progression, sound effects (synthesized via Web Audio API -- no audio files), and confetti celebrations provide ADHD-focused engagement without cluttering medical functionality.

5. **Clean local-first architecture** -- Zustand + IndexedDB + Convex sync provides genuine offline data persistence with a clean abstraction layer.

6. **Good component composition in newer code** -- The `patterns/` directory components (`ReportArchive`, `NextFoodCard`, `MealPlanSection`, `DaySummaryCard`) follow single-responsibility principles and show clear architectural improvement.

7. **Comprehensive bowel event capture** -- Bristol type, urgency, effort, volume, episode count, and accident status provide rich data for meaningful correlation analysis.

8. **Novel UX innovations** -- The Observation Window showing real-time food transit progress is genuinely useful and original for this domain.

---

## Recommendations: What to Do, How, and When

### Phase 1: Emergency Security Fixes (This Week, ~4 hours)

These protect against active data exposure and should be done before any other work.

| #   | Action                                                | How                                                                                                                                                                    | Time   |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Rotate OpenAI API key**                             | OpenAI dashboard -> API keys -> Create new -> Delete old                                                                                                               | 5 min  |
| 2   | **Remove hardcoded patient medical data from source** | Replace constants in `aiAnalysis.ts:12-15, 220-444` with dynamic `HealthProfile` reads. Remove HIV status, medication details, drug use patterns from prompt template. | 1 hr   |
| 3   | **Scrub git history** of sensitive data               | Use `git filter-repo` or BFG Repo-Cleaner on `aiAnalysis.ts` to remove PHI from history, then force-push                                                               | 30 min |
| 4   | **Remove Gemini key injection from Vite config**      | Delete the `define` block in `vite.config.ts:13-15`                                                                                                                    | 5 min  |
| 5   | **Add `dist/` to `.gitignore`**                       | Append `dist/` to `.gitignore`; run `git rm -r --cached dist/` if committed                                                                                            | 5 min  |
| 6   | **Remove `--host=0.0.0.0`** from dev script           | Change to `--host=localhost` in `package.json:7`                                                                                                                       | 2 min  |
| 7   | **Generate random default sync key**                  | Replace `"my-recovery-key"` with `crypto.randomUUID()` in `src/store.ts:209`                                                                                           | 10 min |
| 8   | **Add ownership checks to mutations**                 | Require `syncKey` arg in `logs.remove` and `logs.update`; verify ownership before delete/update                                                                        | 30 min |

### Phase 2: Type Safety Foundation (Week 2, ~2-3 days)

The highest-leverage code quality improvement. Surfaces latent bugs and prevents new ones.

| #   | Action                                                     | How                                                                                                                                      | Time             |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---- | ------- |
| 1   | **Enable TypeScript strict mode**                          | Add `"strict": true` to `tsconfig.json`. Fix errors incrementally, starting with `strictNullChecks`.                                     | 1-2 days         |
| 2   | **Define discriminated union for LogEntry.data**           | Create typed interfaces for each log type (food, digestion, habit, fluid, activity, weight). Replace `data: any` with `data: FoodLogData | DigestionLogData | ...` | 4-6 hrs |
| 3   | **Replace `v.any()` in Convex schema**                     | Define per-type validators matching the TypeScript unions. Use `v.union()` for the `data` field.                                         | 4-6 hrs          |
| 4   | **Consolidate duplicated Convex validators**               | Create `convex/validators.ts`, export shared validators, import in `schema.ts` and `logs.ts`. Fix `"sweets"` mismatch.                   | 1 hr             |
| 5   | **Re-enable `noExplicitAny` in Biome**                     | Set to `"warn"` in `biome.json`, fix violations, then upgrade to `"error"`                                                               | 2 hrs            |
| 6   | **Replace `catch (err: any)` with `catch (err: unknown)`** | Create `getErrorMessage(err: unknown)` utility, use across all catch blocks                                                              | 1 hr             |

### Phase 3: Testing Foundation (Week 3, ~3-4 days)

Highest-value tests first -- all pure functions, no mocking needed.

| #   | Action                                       | How                                                                                                                                        | Time   |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1   | **Install Vitest**                           | `bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom`                                                                 | 15 min |
| 2   | **Test correlation engine** (~30 tests)      | Test `outcomeFromTransitAndCategory()` at all boundaries, `resolveAllCorrelations()` with known data, `buildFoodStats()` status graduation | 1 day  |
| 3   | **Test store migration** (~8 tests)          | Pass old state shapes through migrator, test with missing/invalid fields                                                                   | 2 hrs  |
| 4   | **Test streak logic** (~15 tests)            | `updateStreak()` all branches, `checkNewBadges()` thresholds, shield mechanics                                                             | 3 hrs  |
| 5   | **Test food parsing validators** (~10 tests) | Valid/invalid inputs for `isValidFoodParseResult`, `buildFallbackResult` edge cases                                                        | 2 hrs  |
| 6   | **Test habit normalization** (~10 tests)     | `normalizeHabitConfig()` with partial inputs, `inferHabitType()` regex matching                                                            | 2 hrs  |
| 7   | **Add `test` script and CI**                 | Add `"test": "vitest run"` to package.json. Create basic GitHub Actions workflow.                                                          | 30 min |

### Phase 4: Architecture & Performance (Week 4, ~2-3 days)

| #   | Action                                   | How                                                                                               | Time   |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Lazy load pages**                      | `React.lazy(() => import("./pages/Patterns"))` with `<Suspense>` in App.tsx                       | 30 min |
| 2   | **Dynamic import OpenAI SDK**            | `const OpenAI = (await import("openai")).default` in AI functions                                 | 30 min |
| 3   | **Lift `useSyncedLogs` to page level**   | Fetch once in Track/Patterns pages, pass via props or context                                     | 2 hrs  |
| 4   | **Cache `analyzeLogs()` results**        | Create shared hook/context that memoizes by log identity                                          | 2 hrs  |
| 5   | **Fix Settings store destructuring**     | Replace with individual selectors: `const syncKey = useStore(s => s.syncKey)`                     | 1 hr   |
| 6   | **Connect FluidSection to user presets** | Read `fluidPresets` from store instead of hardcoded array                                         | 15 min |
| 7   | **Fix Bristol mapping inconsistency**    | Remove `bristolToConsistency()` in Track.tsx, use `normalizeDigestiveCategory()` from analysis.ts | 30 min |
| 8   | **Wire HealthProfile to AI module**      | Pass `HealthProfile` from store into `fetchAiInsights()`, remove hardcoded constants              | 1 hr   |

### Phase 5: Security Hardening (Week 5-6, ~1 week)

| #   | Action                               | How                                                                                                                 | Time     |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Move API calls to Convex actions** | Create `convex/actions/ai.ts` for OpenAI calls. Store API key in Convex env vars. Remove `dangerouslyAllowBrowser`. | 1-2 days |
| 2   | **Implement Convex Auth**            | Add Clerk or Auth0 via Convex Auth. Replace sync key queries with `ctx.auth.getUserIdentity()`.                     | 2-3 days |
| 3   | **Add Content Security Policy**      | Add CSP meta tag to `index.html` restricting script/connect/style sources                                           | 30 min   |
| 4   | **Sync health profile to Convex**    | Add health profile fields to `profiles` schema, include in sync flow                                                | 2 hrs    |
| 5   | **Add data deletion capability**     | Create Convex mutation to delete all records by user, add "Delete All Data" button in Settings                      | 2 hrs    |

### Phase 6: Polish & Debt Reduction (Ongoing)

| #   | Action                                                   | Priority |
| --- | -------------------------------------------------------- | -------- |
| 1   | Break up god components (`TodayLog.tsx`, `Settings.tsx`) | High     |
| 2   | Add focus trapping to modals                             | High     |
| 3   | Add ARIA semantics to Bristol scale picker               | High     |
| 4   | Replace inline hover handlers with CSS                   | Medium   |
| 5   | Add `prefers-reduced-motion` support                     | Medium   |
| 6   | Add inline form validation states                        | Medium   |
| 7   | Add medium responsive breakpoint                         | Medium   |
| 8   | Remove dead code files                                   | Medium   |
| 9   | Add PWA/service worker for true offline                  | Low      |
| 10  | Add Sentry error tracking                                | Low      |
| 11  | Self-host Google Fonts                                   | Low      |
| 12  | Clean up package.json (name, deps)                       | Low      |

---

## Individual Review Reports

Detailed findings for each domain are available in:

1. [Security Review](./01-security-review.md) -- 421 lines, 17 findings
2. [Architecture Review](./02-architecture-review.md) -- 556 lines, 24 findings
3. [Frontend Design & UI/UX Review](./03-frontend-design-review.md) -- 400 lines, 29 findings
4. [DevOps Review](./04-devops-review.md) -- 402 lines, 18 findings
5. [Testing & QA Review](./05-testing-qa-review.md) -- 491 lines, 19 findings
6. [Performance Review](./06-performance-review.md) -- 598 lines, 24 findings
7. [Code Quality Review](./07-code-quality-review.md) -- 513 lines, 21 findings
8. [Data Model & Business Logic Review](./08-data-model-business-logic-review.md) -- 409 lines, 22 findings

**Total findings across all reviews: ~174** (deduplicated to ~70 unique issues in this master document)

---

_Generated by 8 parallel Claude Opus 4.6 review agents on 2026-02-24_
