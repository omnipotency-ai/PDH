# Fix Status — 07 Pages, Privacy, Accessibility & UX

**Date:** 2026-03-28
**Branch:** `feat/sprint-2.5+`
**Typecheck:** Clean (all errors pre-existing, none introduced)

---

## HIGH Severity — All Fixed

### 1. Privacy Policy contradicts BYOK architecture (PrivacyPage.tsx)

- **Section 2:** Changed "Only your OpenAI API key is stored locally on your device" to "Your OpenAI API key is stored securely on our servers using AES-256-GCM encryption."
- **Section 3:** Changed "Your API key is transmitted securely but never stored on our servers" to "Your API key is stored securely on our servers using AES-256-GCM encryption. It is only used to make AI requests on your behalf and is never shared with third parties."

### 2. API Key Guide contradicts BYOK architecture (ApiKeyGuidePage.tsx)

- **TIPS array, first entry:** Changed "stored locally on your device… never stored there" to "stored securely on our servers using AES-256-GCM encryption."

### 3. Cloud Profile Section contradicts BYOK architecture (CloudProfileSection.tsx)

- Changed "Your OpenAI API key stays on this device only" to "Your OpenAI API key is stored securely on our servers using AES-256-GCM encryption."
- Removed "Your OpenAI API key is never sent to the cloud" sentence.

### 4. Archive keyboard navigation inverted (Archive.tsx)

- Swapped ArrowLeft/ArrowRight handlers so ArrowLeft = Newer (handlePrev) and ArrowRight = Older (handleNext), matching visual button layout.

---

## MODERATE Severity — All Fixed

### 5. Archive unbounded query (Archive.tsx)

- Reduced `useAiAnalysisHistory(200)` to `useAiAnalysisHistory(50)`.

### 6. Archive pagination buttons lack aria-labels (Archive.tsx)

- Added `aria-label="Go to newer analyses"` and `aria-label="Go to older analyses"` to pagination buttons.

### 7. Patterns.tsx — forceMount on transit-map tab (Patterns.tsx)

- Removed `forceMount` from the transit-map `TabsContent` to avoid mounting the heavy canvas unconditionally.

### 8. Patterns.tsx — Date.now() for IDs (Patterns.tsx)

- Replaced `Date.now().toString(36)` with `crypto.randomUUID()` for stable unique smart-view IDs.

### 9. Track.tsx — stale deps in clock useEffect (Track.tsx)

- Replaced broken `[now.getMilliseconds, now.getSeconds]` dependency array with `[]` (runs once on mount) with an explanatory comment.

### 10. Track.tsx — unused baseline variable (Track.tsx)

- Removed `const _baselines =` assignment; call is side-effect-only, now invoked without capturing the return value.

### 11. Menu.tsx — accessibility (Menu.tsx)

- Added `aria-label="Search food names"` to the search input.
- Added `aria-pressed` to status filter buttons.
- Added TODO comment about duplicated `analyzeLogs` call.

### 12. useAppDataFormController — window.confirm removal (useAppDataFormController.ts)

- Replaced `window.confirm()` for factory reset with state-driven `showFactoryResetConfirm` + `confirmFactoryReset()`.
- Fixed anchor element pattern: added `document.body.appendChild(anchor)` before click and `removeChild` after.
- Added `deleteError` state for in-drawer error feedback.

### 13. DeleteConfirmDrawer — error feedback (DeleteConfirmDrawer.tsx)

- Added optional `errorMessage` prop with `role="alert"` error display in both mobile drawer and desktop dialog layouts.

### 14. AppDataForm — wire up new controller state (AppDataForm.tsx)

- Destructured `showFactoryResetConfirm`, `setShowFactoryResetConfirm`, `confirmFactoryReset`, `deleteError` from controller.
- Added inline factory reset confirmation UI (amber-styled card).
- Passed `deleteError` to `DeleteConfirmDrawer` via conditional spread for `exactOptionalPropertyTypes` compliance.

---

## Pre-existing Issues (Not Introduced)

- `useAppDataFormController.ts` lines 34-35: `unknown` type issues in `getTotalInserted`.
- `useAppDataFormController.ts` line 92: implicit `any` on `row` parameter in CSV export map.
- Various `convex/__tests__/` type issues.

These are outside the scope of this audit fix batch.
