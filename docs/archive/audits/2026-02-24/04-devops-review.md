# DevOps Review -- Caca Traca

**Reviewed:** 2026-02-24
**Branch:** master
**Reviewer:** DevOps Engineering (automated)
**Stack:** React 19 + TypeScript + Vite 6 + Convex + Zustand + Tailwind CSS 4 + Bun

---

## Executive Summary

Caca Traca is a personal health tracking application with a local-first architecture backed by Convex cloud sync. The DevOps posture of this project is **early-stage / individual-developer** -- functional for local development but lacking nearly all production operational infrastructure. There is no CI/CD pipeline, no containerization, no infrastructure as code, no monitoring, no automated testing, and no formal deployment process. The most urgent finding is an **API key exposed in the Vite build configuration** that gets embedded into the client-side JavaScript bundle shipped to browsers.

**Summary of findings:**

- Critical: 2
- High: 5
- Medium: 7
- Low: 4

---

## Findings

### Critical

#### C1: Gemini API Key Baked Into Client Bundle via Vite `define`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/vite.config.ts:14`

```typescript
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

**Description:** The Vite config uses `define` to inline the `GEMINI_API_KEY` environment variable as a compile-time constant. This means the raw API key is embedded as a string literal in the production JavaScript bundle (`dist/assets/index-D9zR_9jz.js`, 1MB). Anyone who loads the app can extract this key from the browser's developer tools or by reading the JS source. This is distinct from the OpenAI key (which is stored in Zustand / user-entered) -- the Gemini key is a build-time secret permanently baked into every deployment artifact.

**Impact:** Full unauthorized access to the Gemini API account associated with this key, with potential for cost abuse and data exfiltration. The `dist/` directory is committed to the repo, meaning the compiled key is in git history even if the `.env` file is not.

**Recommendation:**

1. Remove the `define` block from `vite.config.ts` immediately.
2. Rotate the Gemini API key.
3. If the Gemini API is needed client-side, proxy requests through a backend function (Convex action or server-side endpoint) that holds the key.
4. If the Gemini API is no longer in use (the codebase uses OpenAI for both food parsing and AI analysis), remove the reference entirely.

---

#### C2: `dist/` Directory Committed to Git Repository

**File:** `/Users/peterjamesblizzard/projects/caca_traca/dist/` (entire directory)

**Description:** The `dist/` build output directory is present in the working tree and not listed in `.gitignore`. Although git status shows it is currently untracked (not staged), the `.gitignore` only lists `build/` and not `dist/`. The production build artifacts -- including the JavaScript bundle with the inlined Gemini API key (C1) -- can be accidentally committed. Given that git log shows the dist was generated at the same time as recent commits, there is a risk this has already been pushed or will be.

**Impact:** Build artifacts in version control bloat the repo, create merge conflicts, and in this case would permanently embed API keys in git history. Even if the key is rotated, the old key remains in git history forever (unless the history is rewritten).

**Recommendation:**

1. Add `dist/` to `.gitignore` immediately.
2. Run `git rm -r --cached dist/` if it has been staged or committed.
3. Verify that the current git history does not contain the dist directory: `git log --all --diff-filter=A -- dist/`.

---

### High

#### H1: OpenAI API Calls Made Directly from the Browser (`dangerouslyAllowBrowser: true`)

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts:529`
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts:191`

```typescript
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

**Description:** Both AI modules instantiate the OpenAI client directly in the browser. The API key is user-provided (entered in Settings and stored in IndexedDB), so it is not baked into the build. However, calling the OpenAI API from the browser means: (a) the key is visible in network requests, (b) no server-side rate limiting or abuse prevention exists, (c) CORS restrictions could break, and (d) the OpenAI SDK explicitly warns against this pattern with the `dangerouslyAllowBrowser` flag.

**Impact:** The user's own API key is at risk of interception if the app is ever served over a non-HTTPS connection or compromised by an XSS attack. There is no ability to implement server-side guardrails (rate limiting, prompt injection filtering, cost caps).

**Recommendation:** Move OpenAI API calls to a Convex action (server-side function). The Convex backend already exists and supports actions. Store the API key in Convex environment variables rather than in the client. This eliminates the need for `dangerouslyAllowBrowser` and adds a server-side control point.

---

#### H2: No CI/CD Pipeline

**Description:** There are no GitHub Actions workflows (`.github/` directory does not exist), no deployment scripts, no build verification automation, and no automated quality gates. The `scripts/` directory contains only exploration notes and review findings -- no deployment or automation scripts.

**Impact:** Every deployment is manual. There is no automated type checking, linting, or build verification on push. Bugs, type errors, and lint violations can be pushed to `master` without detection. The `typecheck` and `lint:fix` scripts exist in `package.json` but are only run manually.

**Recommendation:** Create a minimal GitHub Actions workflow that runs on push to `master`:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint:fix --check # or biome check (no --write)
      - run: bun run build
```

---

#### H3: No Automated Test Suite

**Description:** There are zero test files in the codebase. No `*.test.*` or `*.spec.*` files exist anywhere under `src/`. No testing framework (vitest, jest, playwright, cypress) is installed as a dependency. No test script exists in `package.json`.

**Impact:** There is no automated verification that the application works correctly. All AI parsing logic, analysis functions, store mutations, and data sync code is untested. Any refactor (the codebase has gone through several as shown by the git log) can introduce regressions with no safety net.

**Recommendation:**

1. Install vitest (integrates natively with Vite): `bun add -d vitest`.
2. Add a `test` script to `package.json`: `"test": "vitest run"`.
3. Start with unit tests for pure functions: `analysis.ts`, `foodParsing.ts` (mock OpenAI), `streaks.ts`, `trackMetrics.ts`.
4. Add the test step to the CI pipeline (H2).

---

#### H4: Platform-Specific Native Dependencies in Production `dependencies`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:16-19,28`

```json
"dependencies": {
  "@biomejs/cli-linux-arm64": "^2.4.4",
  "@esbuild/linux-arm64": "^0.27.3",
  "@rollup/rollup-linux-arm64-gnu": "^4.58.0",
  "@tailwindcss/oxide-linux-arm64-gnu": "^4.2.0",
  "lightningcss-linux-arm64-gnu": "^1.31.1",
}
```

**Description:** Five platform-specific `linux-arm64` native binary packages are listed in `dependencies` (not `devDependencies`). These are build-time tools that should never be in production dependencies. They appear to have been added to support a Linux ARM64 build environment (possibly Google AI Studio's Cloud Run). On macOS (the current development platform), these packages are unnecessary -- Bun/npm installs the correct platform-specific binaries automatically via optional dependencies.

**Impact:**

- Bloated `node_modules` (447MB) with unnecessary platform binaries.
- Confusing dependency graph -- these are not application dependencies.
- If deployed to a non-ARM64 platform, these binaries are useless dead weight.
- If deployed to ARM64 Linux, the correct approach is to let each tool's optional dependency resolution handle platform selection.

**Recommendation:**

1. Remove all five `linux-arm64` packages from `dependencies`.
2. If a specific CI/Linux build environment requires them, add them to `devDependencies` or use `optionalDependencies`.
3. Better: configure the CI environment correctly and let each tool resolve its own platform binaries.

---

#### H5: `vite` Listed in Both `dependencies` and `devDependencies`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:41,52`

```json
"dependencies": {
  "vite": "^6.2.0"
},
"devDependencies": {
  "vite": "^6.2.0"
}
```

**Description:** Vite is a build tool and should only be in `devDependencies`. It is listed in both sections, likely from the same AI Studio template issue that caused the linux-arm64 dependencies.

**Impact:** In a production deployment that runs `npm install --production` or `bun install --production`, vite and its transitive dependencies would be installed unnecessarily, bloating the deployment artifact.

**Recommendation:** Remove `vite` from `dependencies`. Keep it only in `devDependencies`.

---

### Medium

#### M1: No Environment Variable Validation at Startup

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/main.tsx:8-11`

```typescript
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Run `bunx convex dev` to configure Convex.",
  );
}
```

**Description:** The only environment variable validated at startup is `VITE_CONVEX_URL`. The Gemini API key (used in vite.config.ts `define`) has no validation. There is no `.env.local.example` or env schema. The `.env.example` documents AI Studio variables (`GEMINI_API_KEY`, `APP_URL`) but not the Convex variables that the app actually requires (`VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `OPENAI_API_KEY`).

**Impact:** Developers cloning the repo have no documentation about which environment variables are needed. The `.env.example` is misleading because it documents a different deployment target (AI Studio) than the actual Convex-based architecture.

**Recommendation:**

1. Update `.env.example` to document all required variables: `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`.
2. Remove the Gemini-specific variables if they are no longer used.
3. Consider using a library like `@t3-oss/env-core` or a simple validation function to check all required env vars at build time.

---

#### M2: TypeScript Strict Mode Not Enabled

**File:** `/Users/peterjamesblizzard/projects/caca_traca/tsconfig.json`

**Description:** The root `tsconfig.json` does not enable `"strict": true`. Only the Convex subdirectory (`convex/tsconfig.json`) has strict mode enabled. The main app code compiles without strict null checks, strict function types, or strict property initialization. Combined with the Biome config disabling `noExplicitAny` and `noNonNullAssertion`, there is minimal type safety enforcement.

**Impact:** Type errors that would be caught by strict mode (null/undefined access, implicit any, unchecked function signatures) can reach production silently. The CLAUDE.md says "don't suppress Lint warnings or errors" but the tsconfig itself is permissive.

**Recommendation:** Add `"strict": true` to the root `tsconfig.json`. Fix any resulting type errors. This is a meaningful safety improvement for a health-tracking application.

---

#### M3: No Build Optimization or Bundle Splitting

**File:** `/Users/peterjamesblizzard/projects/caca_traca/vite.config.ts`

**Description:** The Vite config has no `build` configuration. The entire app compiles to a single 1MB JavaScript file (`index-D9zR_9jz.js`). There is no code splitting, no manual chunk strategy, no tree-shaking hints. The OpenAI SDK alone is likely a significant portion of that bundle, even though it is only used when the user has configured an API key.

**Impact:** Every user downloads the full 1MB bundle on first load, including the OpenAI SDK, motion animation library, date-fns, radix-ui, etc. -- even if they only need the Track page. On slow connections, this hurts initial load time significantly.

**Recommendation:** Add build configuration to `vite.config.ts`:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        openai: ['openai'],
        ui: ['radix-ui', 'lucide-react', 'motion'],
      },
    },
  },
  sourcemap: true, // for debugging production issues
},
```

Also consider lazy-loading the Patterns and Settings pages with `React.lazy()`.

---

#### M4: No Source Maps in Production Build

**File:** `/Users/peterjamesblizzard/projects/caca_traca/vite.config.ts`

**Description:** No `build.sourcemap` option is configured, and no `.map` files exist in `dist/`. When an error occurs in production, the stack trace points to minified code positions that are impossible to debug.

**Impact:** Production errors are undebuggable. The `RouteErrorBoundary` catches errors but only logs them to `console.error` with no way to trace back to source code.

**Recommendation:** Enable source maps in production: `build: { sourcemap: 'hidden' }`. The `'hidden'` option generates `.map` files but does not reference them in the bundle, so they can be uploaded to an error tracking service without exposing them to end users.

---

#### M5: No Error Tracking or Monitoring Service

**Description:** There is no Sentry, LogRocket, Datadog, PostHog, or any other error tracking / monitoring service integrated. Errors are logged to `console.error` only. The `RouteErrorBoundary` in `App.tsx` catches React render errors but only displays a UI message -- errors are not reported anywhere.

**Impact:** When users encounter errors in production, there is no visibility into what happened. AI API failures, Convex sync errors, and rendering crashes are invisible to the developer unless the user reports them manually.

**Recommendation:**

1. Integrate Sentry (free tier) for error tracking: `bun add @sentry/react`.
2. Configure it in `main.tsx` with the Convex URL as environment context.
3. Report errors from the `RouteErrorBoundary.componentDidCatch` to Sentry.
4. Report AI analysis errors from `useAiInsights.ts` to Sentry.

---

#### M6: No PWA / Service Worker Configuration

**Description:** The app is described as "local-first" and "works offline" (per CLAUDE.md), but there is no service worker, no web app manifest, and no PWA configuration. The offline capability comes from IndexedDB data persistence via Zustand, but the app shell itself (HTML, JS, CSS) is not cached for offline use. If the network is unavailable, the app cannot load.

**Impact:** The "works offline" claim is only partially true. Data is persisted locally, but the application cannot be opened without a network connection to load the JavaScript bundle. For a health tracking app that may be used in hospital settings with poor connectivity, this is a meaningful gap.

**Recommendation:**

1. Add a `manifest.json` to `public/` with app metadata.
2. Use `vite-plugin-pwa` to generate a service worker that caches the app shell.
3. This would also enable "Add to Home Screen" on mobile devices.

---

#### M7: Single Branch Workflow with No Protection

**Description:** The project operates on a single `master` branch with no feature branches, no pull requests, and no branch protection rules. All commits go directly to `master`. The git log shows direct commits with no PR references.

**Impact:** There is no code review gate, no ability to roll back a specific feature without reverting individual commits, and no separation between development and production code. Combined with the lack of CI (H2), any broken commit goes directly to the deployable branch.

**Recommendation:**

1. Enable branch protection on `master` in GitHub settings (require PR, require status checks).
2. Use short-lived feature branches for changes.
3. This is lower priority for a single-developer project but becomes essential if anyone else contributes.

---

### Low

#### L1: Package Name is Generic ("react-example")

**File:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:2`

```json
"name": "react-example",
```

**Description:** The package name is a leftover from a template. While this has no functional impact for a non-published package, it makes the project harder to identify in tooling output (build logs, error messages, process lists).

**Impact:** Cosmetic. Confusing in logs and tooling.

**Recommendation:** Change to `"name": "caca-traca"`.

---

#### L2: `autoprefixer` in `devDependencies` May Be Unused

**File:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:47`

**Description:** `autoprefixer` is listed as a dev dependency but there is no PostCSS config file (`postcss.config.js`, `.postcssrc`). Tailwind CSS 4 with the Vite plugin does not require autoprefixer. This appears to be a leftover from an earlier setup.

**Impact:** Minor dependency bloat. No functional impact.

**Recommendation:** Remove `autoprefixer` from `devDependencies` if it is not used.

---

#### L3: `.DS_Store` Files Present in Working Tree and Public Directory

**Description:** `.DS_Store` files exist in the project root and `public/` directory. While `.DS_Store` is in `.gitignore`, the presence in `public/` means it could be served as a static file in development.

**Impact:** Minimal. `.DS_Store` files can leak directory structure information if served.

**Recommendation:** Delete existing `.DS_Store` files and add a global gitignore: `git config --global core.excludesfile ~/.gitignore_global`.

---

#### L4: `metadata.json` Has Empty Fields

**File:** `/Users/peterjamesblizzard/projects/caca_traca/metadata.json`

```json
{
  "name": "",
  "description": "",
  "requestFramePermissions": []
}
```

**Description:** This file appears to be from the AI Studio template and is unused by the current Convex-based architecture.

**Impact:** Clutter. No functional impact.

**Recommendation:** Remove the file if it serves no purpose, or populate it with correct metadata.

---

## Strengths

1. **Local-first architecture is well-designed.** The Zustand + IndexedDB + Convex sync pattern provides genuine offline data persistence. The `sync.ts` module is clean and well-typed.

2. **Convex backend is properly structured.** Schema definitions are explicit with proper validators. Indexes are correctly defined for query patterns. The `syncKey` pattern provides multi-user data isolation.

3. **Error boundaries are in place.** Every route is wrapped in `RouteErrorBoundary`, preventing a single page crash from taking down the entire app. This is a good React practice.

4. **Biome is properly configured.** Linting and formatting are configured with sensible defaults. Import organization is enabled. The configuration is thoughtful (CSS linting disabled for Tailwind, UI components excluded from strict linting).

5. **`.gitignore` correctly excludes `.env*` files.** The `.env.local` file containing API keys is not tracked by git. The `.env.example` exists as documentation (though it needs updating -- see M1).

6. **`bun.lock` is committed.** Deterministic installs are ensured by the lockfile being in version control.

7. **Vite dev server is well-configured for DX.** The `--host=0.0.0.0` flag enables LAN testing (useful for mobile testing), and the HMR toggle via `DISABLE_HMR` env var shows consideration for different development contexts.

8. **AI response validation.** The `foodParsing.ts` module has thorough runtime validation of AI responses (`isValidFoodParseResult`, `isValidParsedFoodItem`, `isValidFoodComponent`) with graceful fallback to local parsing. This is a good defensive pattern.

---

## Overall DevOps Assessment

**Maturity Level: 1/5 (Ad-hoc)**

The project is at the earliest stage of DevOps maturity. It functions as a development environment for a single developer but has no production operational capability. The critical findings (API key in bundle, dist in git) should be addressed immediately. The high findings (no CI, no tests, wrong dependency classification) should be addressed before any public or multi-user deployment.

**Priority action items:**

| Priority    | Item                                                | Effort    |
| ----------- | --------------------------------------------------- | --------- |
| Immediate   | C1: Remove Gemini key from Vite define + rotate key | 15 min    |
| Immediate   | C2: Add `dist/` to `.gitignore` + remove from git   | 5 min     |
| This week   | H4: Move linux-arm64 deps out of dependencies       | 10 min    |
| This week   | H5: Remove vite from dependencies                   | 2 min     |
| This week   | H2: Add basic CI workflow                           | 30 min    |
| Next sprint | H1: Move OpenAI calls to Convex actions             | 2-4 hours |
| Next sprint | H3: Add vitest + initial test suite                 | 4-8 hours |
| Next sprint | M3: Add bundle splitting                            | 30 min    |
| Backlog     | M5: Add Sentry error tracking                       | 1 hour    |
| Backlog     | M6: Add PWA support                                 | 2-3 hours |
