# Full Codebase Review — 20-Agent Audit (2026-03-28)

**Model:** Sonnet 4.6 (code-reviewer agents)
**Scope:** ~250 source files across `src/` and `convex/`
**Total findings:** 73 HIGH, 144 MODERATE, 55 NICE-TO-HAVE = **272 findings**

---

## Executive Summary

Twenty parallel code-reviewer agents audited the entire codebase. The findings cluster into **8 systemic themes** that account for the majority of high-severity issues. Fixing these themes (rather than individual findings) is the most efficient path.

---

## Systemic Themes

### Theme 1: `Date.now()` Inside Convex Mutations (HIGH x ~15)
Convex replays mutations deterministically. `Date.now()` breaks this contract — replayed mutations get different timestamps.

**Affected files:** `convex/logs.ts`, `convex/lib/apiKeys.ts`, `convex/foodParsing.ts`, `convex/foodLibrary.ts`, `convex/computeAggregates.ts`, `convex/waitlist.ts`, `convex/weeklySummaries.ts`

**Fix:** Accept timestamps as mutation args from the client, or use Convex's server-side time primitives.

---

### Theme 2: Legacy Auth Pattern (`ctx.auth.getUserIdentity()`) (HIGH x ~25)
`requireAuth(ctx)` exists in `convex/lib/auth.ts` but is not used in the majority of mutation/query handlers. The legacy pattern is scattered across `logs.ts` (18 occurrences), `stripe.ts`, `aggregateQueries.ts`, `weeklySummaries.ts`, `conversations.ts`, `foodAssessments.ts`, `foodLibrary.ts`, `ingredientExposures.ts`, `ingredientOverrides.ts`, `ingredientProfiles.ts`, `ingredientNutritionApi.ts`, `profiles.ts`.

**Fix:** Mechanical migration — replace raw `getUserIdentity()` with `requireAuth(ctx)` across all files.

---

### Theme 3: API Key Exposure & Privacy Contradictions (HIGH x ~6)
- API key sent as plain Convex action arg on every food-matching and AI call — visible in Convex dashboard logs
- Privacy Policy says keys are "stored locally, never on servers" — architecture actually stores them server-side in Convex
- Settings page has contradictory disclosures (one says server, one says device-only)
- ApiKeyGuidePage repeats the incorrect "local only" claim

**Affected files:** `convex/ai.ts`, `src/hooks/useFoodLlmMatching.ts`, `src/lib/convexAiClient.ts`, `src/lib/aiAnalysis.ts`, `src/pages/secondary_pages/ApiKeyGuidePage.tsx`, `src/pages/secondary_pages/PrivacyPage.tsx`, `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx`, `src/components/settings/app-data-form/CloudProfileSection.tsx`

**Fix:** Remove client-side API key args; resolve from server-side storage in Convex actions. Update all privacy disclosures to match actual architecture.

---

### Theme 4: Unbounded Queries (`.collect()` with no limit) (HIGH x ~6)
- `logs.ts:listAll` — fetches every log ever written
- `logs.ts:count` — full collect just to return `.length`
- `logs.ts:listFoodLogs` — collects all logs, filters in JS
- `foodAssessments.ts:allFoods` — unbounded live subscription
- `foodParsing.ts:embedAliasInternal` — fetches all embeddings (~4MB+)
- `foodLibrary.ts:mergeDuplicates` — scans all user logs

**Fix:** Add pagination, limits, or filtered indexes. WQ-087 tracks the `listAll` case.

---

### Theme 5: Stripe Payment Security (HIGH x 3)
- `priceId` accepted from client with no server-side allowlist — attacker can substitute cheaper price
- `successUrl`/`cancelUrl` not validated against app origin — phishing redirect risk
- Raw Stripe error body leaked to caller — exposes account diagnostics

**Affected file:** `convex/stripe.ts`

**Fix:** Enforce price ID allowlist, validate redirect URLs, sanitize error responses.

---

### Theme 6: Bristol Scale Mishandling (HIGH x 3, MODERATE x 3)
- `validators.ts:bristolCode` is `v.number()` with no 1-7 range enforcement
- `LogEntry.tsx` maps Bristol 1-5 all to `'firm'` (1-2 are constipated, 3-4 normal, 5 soft)
- `BristolTrendTile` shows 3-5 (normal/good) in orange (alarming when user is doing well)
- Bristol 7 labelled as "cancelled" in `serviceRecord`
- Bristol 6 treated as borderline, not concerning, for post-anastomosis context
- Delta always shown in rose regardless of improvement direction

**Fix:** Add schema-level range validation. Fix consistency mapping. Audit all color assignments against clinical meaning.

---

### Theme 7: Clinical Data Correctness (HIGH x 3)
- Trimester boundaries off by 1 week from clinical standard (`reproductiveHealth.ts`)
- `resolveItem` doesn't create `ingredientExposures` after evidence window closes — data silently lost
- `fuzzyPreMatch` labels Fuse.js matches as `resolvedBy: 'llm'` — corrupts provenance

**Fix:** Correct trimester constants. Add exposure creation to `resolveItem`. Fix provenance tagging.

---

### Theme 8: Missing Error Handling on Mutations (HIGH x ~8)
- Multiple delete/save operations use fire-and-forget (`void onDelete()`) with no try/catch
- `LogEntry.tsx` save error silently swallowed (empty catch block)
- `ReplyInput.tsx` clears input before mutation resolves, no recovery on failure
- `CopyReportButton` has no error handling on clipboard API

**Fix:** Add try/catch with user-visible error feedback on all mutation call sites.

---

## Additional High-Severity Findings (not in themes)

| ID | File | Description |
|----|------|-------------|
| I002 | routeTree.tsx:458 | Auth guard sniffs `window.Clerk?.session` — fragile timing-dependent pattern |
| I003 | data/transitData.ts | 2112-line hardcoded file diverges from canonical registry; consumed by deployed components |
| HC002 | useAiInsights.ts:94 | `stableEndMs` frozen at mount via empty-dep useMemo with `Date.now()` |
| HC003 | useApiKey.ts:100 | `hasApiKey` returns false during loading, blocking server-key-only users |
| FH003 | useTransitMapGeometry.ts:596 | Module-level caches never invalidated |
| FH004 | useTransitMapGeometry.ts:660 | DOM leak if SVGPathElement throws (no try/finally) |
| P001 | Archive.tsx:94 | Keyboard navigation reversed (ArrowLeft→Newer, ArrowRight→Older) |
| LU003 | sounds.ts | AudioContext singleton never closed (Chrome 6-tab cap) |
| LU004 | sounds.ts | Sounds play regardless of `prefers-reduced-motion` (WCAG violation) |
| F001 | DrPooReport.tsx:33 | Raw AI innerHTML copied to clipboard (XSS surface) |
| F004 | ConversationPanel.tsx | react-markdown doesn't block `<img>` tags (tracking beacon risk) |
| F003 | DrPooReport/ConversationPanel/MealIdeaCard | Security-critical markdown config duplicated in 3 files |
| TM-001 | StationMarker.tsx:67 | Pulse animation transform-origin wrong |
| TM-003 | RegistryTransitMap.tsx | Near-complete duplicate of TransitMapContainer |
| F002 | habitAggregates.ts:154 | `currentGoodStreak` not bounded to window — celebration fires once at 7, never again |
| F001 | weightUtils.ts | `sanitizeDecimalInput` multi-dot normalisation broken |
| F011/12 | AddHabitDrawer.tsx | Custom fluid habit values not converted from fl oz to ml |

---

## Moderate Findings Summary (144 total)

Key categories:
- **Accessibility (ARIA):** ~18 findings — broken combobox ownership, missing labels, suppressed focus rings, keyboard-unreachable elements
- **Duplicate code:** ~12 findings — `AI_MARKDOWN_COMPONENTS` x3, `getDateKey` x3, `patchHealthProfile` x3, `formatTransitHours` x3
- **Stale closures / unstable refs:** ~8 findings — boundary date recomputation, draft state not resetting on Convex sync
- **Dead code:** ~6 findings — `FoodRow` component, static `columns` export, `cmToFeetInches`, `TodayLogDataContext`
- **UX inconsistencies:** ~10 findings — reversed keyboard nav, missing confirmation dialogs, fluid maxLength=10, silent fallbacks
- **Color/design token violations:** ~5 findings — hardcoded hex, wrong severity colors, inverted Bristol semantics

---

## Nice-to-Have Summary (55 total)

Mostly: stale model pricing strings, env-based feature flags, minor dead code branches, documentation gaps, cosmetic inconsistencies.

---

## Recommended Fix Order

1. **Privacy & Legal** — API key disclosures, Privacy Policy contradiction (GDPR risk)
2. **Payment Security** — Stripe price ID allowlist, URL validation, error sanitization
3. **Data Correctness** — Trimester boundaries, Bristol mapping, `resolveItem` exposures, provenance tagging, fl oz→ml conversion
4. **Convex Determinism** — `Date.now()` in mutations (mechanical fix across ~15 sites)
5. **Auth Migration** — `requireAuth(ctx)` (mechanical fix across ~25 sites)
6. **API Key Architecture** — Remove client-side key args, resolve server-side
7. **Error Handling** — Add try/catch + user feedback on all mutation call sites
8. **Unbounded Queries** — Pagination/limits on `.collect()` calls
9. **XSS/Injection** — Clipboard innerHTML, react-markdown img blocking, markdown config dedup
10. **Accessibility** — Focus rings, ARIA, keyboard navigation
