# Security Review: Caca Traca

**Date:** 2026-02-24
**Reviewer:** Claude Code (Automated Security Audit)
**Codebase:** /Users/peterjamesblizzard/projects/caca_traca
**Commit:** 6f9928c (master branch, with unstaged changes)

---

## Executive Summary

Caca Traca is a personal health tracking application (ostomy recovery tracker) that stores and transmits sensitive medical data including surgical history, bowel habits, medications, HIV status, substance use, and dietary information. The application uses a local-first architecture (IndexedDB via Zustand) with cloud sync to Convex, and integrates with the OpenAI API for AI-powered food analysis.

**Overall Security Posture: HIGH RISK**

The audit identified **2 Critical**, **5 High**, **5 Medium**, and **5 Low** severity findings. The most urgent issues are a live OpenAI API key committed to the local environment file and a complete absence of authentication on the Convex backend, allowing anyone who knows or guesses a sync key to read and modify all health data for that user.

---

## Findings

### CRITICAL Severity

#### C-1: Live OpenAI API Key in `.env.local`

**Description:** A production OpenAI API key (`sk-proj-7gYfmQ...`) is stored in plaintext in `.env.local`. While `.env.local` is excluded from Git via `.gitignore` (confirmed: never committed to history), this key is visible on the local filesystem and could be exposed through backup tools, file sync services, or shoulder surfing.

**Location:** `.env.local:8`

**Impact:** An attacker with access to the developer's machine or filesystem backups can use this key to make unlimited API calls billed to the project owner's OpenAI account. The key has project-level access (`sk-proj-` prefix), which may include permissions beyond chat completions.

**Recommendation:**

1. Immediately rotate this API key on the OpenAI dashboard.
2. Set per-key usage limits and budget caps in the OpenAI dashboard.
3. For development, use environment-specific keys with minimal permissions.
4. Consider using a secrets manager instead of `.env` files.

---

#### C-2: No Authentication or Authorization on Convex Backend

**Description:** The entire Convex backend has zero authentication. All queries and mutations (logs, profiles, AI analyses, food library) are guarded only by a `syncKey` string. There is no `ctx.auth` usage anywhere in the backend. Anyone who can reach the Convex deployment can read, write, modify, and delete any user's data by supplying their `syncKey`.

**Location:**

- `convex/logs.ts:77-96` (listBySyncKey query -- no auth check)
- `convex/logs.ts:128-143` (add mutation -- no auth check)
- `convex/logs.ts:145-152` (remove mutation -- no auth, no ownership check)
- `convex/logs.ts:154-166` (update mutation -- no auth, no ownership check)
- `convex/aiAnalyses.ts:4-29` (add mutation -- no auth check)
- `convex/foodLibrary.ts:9-31` (listBySyncKey -- no auth check)

**Impact:** The default sync key is `"my-recovery-key"` (set in `src/store.ts:209`). Any user who does not change this default will share the same data pool. Even with a custom sync key, the key is a simple user-chosen string -- not a cryptographic token. The Convex URL is public (embedded in the client bundle as `VITE_CONVEX_URL`), so any attacker can call these endpoints directly and enumerate sync keys to find real user data. This exposes extremely sensitive health data (HIV status, drug use, surgical details, bowel habits, medications).

**Recommendation:**

1. Implement Convex Auth (supports Clerk, Auth0, or custom JWT providers).
2. Replace `syncKey`-based queries with user identity from `ctx.auth.getUserIdentity()`.
3. Add row-level security to ensure users can only access their own data.
4. The `remove` and `update` mutations must verify the requesting user owns the record.

---

### HIGH Severity

#### H-1: OpenAI API Key Sent from Browser (Client-Side API Calls)

**Description:** The OpenAI SDK is initialized in the browser with `dangerouslyAllowBrowser: true`. The user's OpenAI API key is stored in IndexedDB (via Zustand persistence) and sent directly from the client to OpenAI's API servers.

**Location:**

- `src/lib/foodParsing.ts:191` (`dangerouslyAllowBrowser: true`)
- `src/lib/aiAnalysis.ts:529` (`dangerouslyAllowBrowser: true`)
- `src/store.ts:97` (`openAiApiKey` stored in persisted state)

**Impact:**

1. The API key is visible in browser developer tools (Network tab) for anyone with access to the device.
2. The key is persisted in IndexedDB in plaintext, accessible via browser console.
3. Browser extensions or XSS vulnerabilities could exfiltrate the key.
4. The OpenAI SDK explicitly warns against browser usage (hence the `dangerouslyAllowBrowser` flag name).

**Recommendation:**

1. Route all OpenAI API calls through a backend proxy (e.g., a Convex action or HTTP endpoint).
2. Store the API key server-side only (as a Convex environment variable).
3. Remove `dangerouslyAllowBrowser: true` from the codebase entirely.

---

#### H-2: Sensitive Health Data Stored Without Encryption

**Description:** Extremely sensitive health information is stored in plaintext in both IndexedDB (local) and Convex (cloud). The data includes:

- HIV status and antiretroviral medication
- Substance use details (methamphetamine, cigarettes, frequency)
- Surgical history and dates
- Bowel habits, accidents, urgency details
- Weight, BMI, medications, allergies
- Health conditions (mental health, chronic conditions)

**Location:**

- `src/store.ts:45-58` (HealthProfile type with medications, conditions)
- `src/store.ts:84-90` (LogEntry with `data: any`)
- `convex/schema.ts:70-84` (logs table with `data: v.any()`)
- `src/lib/aiAnalysis.ts:220-444` (system prompt containing hardcoded patient details)

**Impact:** If the Convex database is breached, if a device is lost or stolen, or if someone accesses the browser's IndexedDB, they get unrestricted access to deeply personal medical and lifestyle data. The AI analysis system prompt (`src/lib/aiAnalysis.ts`) also hardcodes sensitive patient details (HIV status, drug use baselines) which are sent to OpenAI with every API call.

**Recommendation:**

1. Implement client-side encryption for sensitive fields before storage (both local and cloud).
2. Consider field-level encryption for the most sensitive data (HIV status, drug use, medications).
3. Remove hardcoded patient details from the AI system prompt; pull them dynamically from the encrypted health profile.
4. Review OpenAI's data retention policy and opt out of training data usage.

---

#### H-3: Gemini API Key Injected into Client Bundle

**Description:** The Vite config uses `define` to inject the Gemini API key into the client-side JavaScript bundle at build time: `'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)`. This means if `GEMINI_API_KEY` is set in any `.env` file, it becomes a string literal in the production JavaScript bundle visible to any user.

**Location:** `vite.config.ts:14`

**Impact:** The Gemini API key would be extractable from the production JavaScript bundle by anyone who views the page source. Currently, the key is only referenced in `.env.example` with a placeholder, and no `src/` code references `process.env.GEMINI_API_KEY`, but the injection mechanism is a latent vulnerability that will activate the moment a real key is provided.

**Recommendation:**

1. Remove the `define` block from `vite.config.ts` that injects `GEMINI_API_KEY`.
2. Never inject API keys into client-side bundles. Route Gemini calls through a server-side function.

---

#### H-4: Sync Key as Sole Access Control (IDOR Vulnerability)

**Description:** The `syncKey` is the only mechanism separating one user's data from another's across all Convex tables. It is a user-chosen, human-readable string with a default value of `"my-recovery-key"`. There is no rate limiting, no brute-force protection, and no complexity requirement.

**Location:**

- `src/store.ts:209` (default: `"my-recovery-key"`)
- `src/store.ts:218` (setSyncKey allows any string)
- `convex/logs.ts:77-96` (queries filter only by syncKey)

**Impact:** This is an Insecure Direct Object Reference (IDOR). An attacker can:

1. Use the default key to access data of any user who did not change it.
2. Enumerate common sync keys to find real user data.
3. There is no lockout mechanism for invalid attempts.
4. The sync key is visible in plaintext in the Settings UI.

**Recommendation:**

1. Replace sync keys with proper authentication (see C-2).
2. If sync keys must be kept as a temporary measure, generate them as cryptographic UUIDs (e.g., `crypto.randomUUID()`), not user-chosen strings.
3. Add rate limiting on Convex queries to prevent enumeration attacks.

---

#### H-5: Full AI Request/Response Payloads Stored in Convex

**Description:** The `aiAnalyses` table stores complete request payloads (including the system prompt with hardcoded patient medical details) and raw AI responses. The system prompt contains HIV status, drug use baselines, specific medications, and detailed behavioral information.

**Location:**

- `convex/aiAnalyses.ts:4-29` (stores `request: v.any()`, `response: v.any()`)
- `src/hooks/useAiInsights.ts:80-88` (saves full `result.request` including messages)
- `src/lib/aiAnalysis.ts:592-595` (serializes all messages including system prompt)

**Impact:** Anyone who can access the AI analyses records (which requires only the `syncKey`, see C-2) gets the full system prompt containing extremely private patient data. This data is also unnecessarily duplicated in every analysis record.

**Recommendation:**

1. Do not store the system prompt in each analysis record; it is static and can be regenerated.
2. Strip sensitive health details from stored payloads.
3. Store only the insight result, not the full request/response.

---

### MEDIUM Severity

#### M-1: `v.any()` Used for Unvalidated Data Fields in Convex Schema

**Description:** Multiple Convex schema fields use `v.any()` instead of typed validators: `logs.data`, `aiAnalyses.request`, `aiAnalyses.response`, `aiAnalyses.insight`, and `profiles.calibrations`. This bypasses Convex's built-in input validation.

**Location:**

- `convex/schema.ts:81` (`data: v.any()`)
- `convex/schema.ts:89-91` (`request: v.any()`, `response: v.any()`, `insight: v.any()`)
- `convex/schema.ts:105` (`calibrations: v.optional(v.any())`)

**Impact:** Attackers can store arbitrary data (including malicious payloads) in the database. Without schema validation, there is no guarantee that data retrieved from the database matches expected shapes, which could lead to client-side crashes or unexpected behavior.

**Recommendation:**

1. Define typed Convex validators for log data (separate validators per log type).
2. Define typed validators for AI analysis fields.
3. Remove the `v.any()` catch-all and use `v.union()` for polymorphic data.

---

#### M-2: Development Server Bound to All Interfaces

**Description:** The `dev` script binds Vite to `0.0.0.0` (`--host=0.0.0.0`), making the development server accessible from any device on the local network.

**Location:** `package.json:7`

**Impact:** Other devices on the same network (e.g., at a coffee shop, coworking space, or shared WiFi) can access the development server, including the application with any data stored in it. Combined with the lack of authentication, this exposes sensitive health data to network-adjacent attackers.

**Recommendation:**

1. Remove `--host=0.0.0.0` unless needed for specific cross-device testing.
2. Default to `--host=localhost` to bind only to the loopback interface.

---

#### M-3: No Content Security Policy (CSP) Headers

**Description:** The `index.html` does not include any Content Security Policy headers or meta tags. There is no `<meta http-equiv="Content-Security-Policy">` tag, and no evidence of CSP being set at the hosting layer.

**Location:** `index.html:1-18`

**Impact:** Without CSP, the application has no defense-in-depth against XSS attacks. If an attacker finds a way to inject scripts (e.g., through AI response rendering or stored data), there is no CSP to prevent execution.

**Recommendation:**
Add a restrictive CSP meta tag to `index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.convex.cloud https://api.openai.com; img-src 'self' data:;"
/>
```

---

#### M-4: Convex Mutation `remove` Has No Ownership Check

**Description:** The `logs.remove` mutation accepts only a document ID and deletes it without verifying the caller owns the record. Similarly, `logs.update` patches a record by ID without ownership verification.

**Location:**

- `convex/logs.ts:145-152` (remove -- deletes any log by ID)
- `convex/logs.ts:154-166` (update -- patches any log by ID)

**Impact:** An attacker who obtains or guesses a valid Convex document ID can delete or modify any user's log entries, regardless of sync key. Convex document IDs are sequential/predictable enough that enumeration may be feasible.

**Recommendation:**

1. Add a `syncKey` argument to `remove` and `update` mutations.
2. Before delete/update, verify the record's `syncKey` matches the caller's.
3. Long-term: replace `syncKey` checks with proper auth (see C-2).

---

#### M-5: Sensitive Patient Data Hardcoded in Source Code

**Description:** The AI system prompt in `src/lib/aiAnalysis.ts` contains hardcoded patient-specific medical information including: HIV+ status, specific antiretroviral medication (Biktarvy), substance use details and quantities, body measurements, surgery dates, and ADHD diagnosis.

**Location:** `src/lib/aiAnalysis.ts:12-15, 220-444`

**Impact:** This data is committed to Git and pushed to a public GitHub repository (`https://github.com/PBLIZZ/caca_traca.git`). Anyone browsing the repository can see the full medical profile. Additionally, this data is included in every OpenAI API request.

**Recommendation:**

1. Move all patient-specific data to the health profile in the store/database.
2. Dynamically construct the system prompt using only the current user's profile data.
3. Audit the Git history for this file and consider force-pushing to remove sensitive data from history (or use BFG Repo-Cleaner).

---

### LOW Severity

#### L-1: No Input Length Limits on User-Facing Text Fields

**Description:** Free-text inputs (food entry, Dr. Poo replies, notes fields, medications, allergies) have no maximum length validation on the client or server side.

**Location:**

- `src/components/track/FoodSection.tsx:51-55` (food input, no maxLength)
- `src/components/AiInsightsSection.tsx:160-167` (reply input, no maxLength)
- `src/pages/Settings.tsx:407-413` (medications textarea, no maxLength)
- `convex/logs.ts:128-143` (add mutation, no data size limit)

**Impact:** A malicious user could submit extremely large payloads, potentially:

1. Causing expensive OpenAI API calls with oversized prompts.
2. Inflating Convex storage costs.
3. Degrading client performance when rendering large text.

**Recommendation:**

1. Add `maxLength` attributes to all text inputs.
2. Add server-side validation in Convex mutations for string length limits.

---

#### L-2: Console Error Messages May Leak Sensitive Information

**Description:** Error handlers throughout the codebase log potentially sensitive information to the browser console, including API response fragments.

**Location:**

- `src/lib/foodParsing.ts:214` (logs raw AI JSON response to console)
- `src/lib/aiAnalysis.ts:585` (logs raw AI JSON response to console)
- `src/hooks/useAiInsights.ts:91` (logs AI errors to console)

**Impact:** If a user has their browser console open or if console output is captured by monitoring tools, partial API responses containing health data could be exposed.

**Recommendation:**

1. Avoid logging raw API response content in production.
2. Use a structured logger that can be disabled in production builds.
3. Truncate or redact sensitive data before logging.

---

#### L-3: AI Response Rendered as Text Content (Low XSS Risk)

**Description:** AI-generated content (Dr. Poo's summary, suggestions, meal plans, food names) is rendered using React's default text rendering (JSX `{variable}` interpolation), which auto-escapes HTML. No `dangerouslySetInnerHTML` or `innerHTML` usage was found.

**Location:**

- `src/components/AiInsightsSection.tsx:345` (summary rendered as text)
- `src/components/AiInsightsSection.tsx:354` (suggestions rendered in list)

**Impact:** The current rendering approach is safe against XSS. However, if AI responses contain unexpected content or if future changes introduce HTML rendering of AI output, this could become a vector. The AI's `response_format: { type: "json_object" }` setting provides additional structure.

**Recommendation:**

1. Maintain the current approach of rendering AI output as text only.
2. Add a code comment warning against using `dangerouslySetInnerHTML` for AI output.
3. Consider sanitizing AI output strings as a defense-in-depth measure.

---

#### L-4: `openai` Package Listed as Production Dependency

**Description:** The `openai` package (v6.22.0) is listed in `dependencies` rather than being used through a server-side proxy. While the package itself is not vulnerable (bun audit reports no vulnerabilities), bundling a server-side SDK for client-side use increases the bundle size and attack surface.

**Location:** `package.json:31`

**Impact:** The OpenAI SDK includes code paths for Node.js-specific features that are dead code in the browser, unnecessarily inflating the bundle. More importantly, its presence encourages the `dangerouslyAllowBrowser` anti-pattern.

**Recommendation:**

1. Move OpenAI API calls to the server side (Convex actions).
2. Remove `openai` from client-side dependencies.

---

#### L-5: Exported Data May Contain Sensitive Information

**Description:** The Settings page allows exporting all logs as CSV or JSON. The export includes all log data (food, bowel, habits, weight, activities) without any warning about the sensitivity of the exported data.

**Location:** `src/pages/Settings.tsx:82-107` (handleExport function)

**Impact:** A user could accidentally share or lose an export file containing their complete health history. The file is downloaded with a predictable name pattern (`kaka-tracker-YYYY-MM-DD.csv`).

**Recommendation:**

1. Add a confirmation dialog warning about sensitive data before export.
2. Consider password-protecting exported files.
3. Add a disclaimer to the export UI about data sensitivity.

---

## Dependency Analysis

**Package Manager:** Bun v1.3.6
**Vulnerability Scan Result:** `bun audit` reports **no known vulnerabilities**.

Key dependencies reviewed:
| Package | Version | Status |
|---------|---------|--------|
| react | ^19.0.0 | Current, no known issues |
| convex | ^1.32.0 | Current |
| openai | ^6.22.0 | Current, but should not be client-side |
| zustand | ^5.0.11 | Current |
| vite | ^6.2.0 | Current |
| react-router-dom | ^7.13.0 | Current |
| papaparse | ^5.5.3 | Current |
| idb-keyval | ^6.2.2 | Current |

No suspicious, unmaintained, or typosquatting packages were identified. The `@biomejs/cli-linux-arm64`, `@esbuild/linux-arm64`, `@rollup/rollup-linux-arm64-gnu`, `@tailwindcss/oxide-linux-arm64-gnu`, and `lightningcss-linux-arm64-gnu` packages in `dependencies` (rather than `devDependencies` or `optionalDependencies`) suggest this was developed or deployed on an ARM64 Linux environment. They are benign but should be in `optionalDependencies`.

---

## Summary of Recommendations (Priority Order)

1. **IMMEDIATE:** Rotate the OpenAI API key and set usage limits.
2. **IMMEDIATE:** Remove hardcoded patient medical data from source code and Git history (public repo).
3. **URGENT:** Implement Convex Auth to replace sync key-based access control.
4. **URGENT:** Move OpenAI API calls to a server-side proxy (Convex actions).
5. **URGENT:** Add ownership checks to `remove` and `update` mutations.
6. **HIGH:** Remove `process.env.GEMINI_API_KEY` injection from Vite config.
7. **HIGH:** Add Content Security Policy headers.
8. **MEDIUM:** Replace `v.any()` with typed validators in Convex schema.
9. **MEDIUM:** Remove `--host=0.0.0.0` from dev script.
10. **MEDIUM:** Add input length validation on all text fields.
11. **LOW:** Add export data sensitivity warnings.
12. **LOW:** Reduce console logging of sensitive data in production.

---

## Overall Security Posture Assessment

**Rating: HIGH RISK**

The application handles some of the most sensitive categories of personal data possible -- medical records, HIV status, substance use, mental health conditions, and surgical history. Despite this, it currently has:

- **No authentication** of any kind
- **No encryption** of data at rest or in transit (beyond HTTPS)
- **No access control** beyond a guessable string
- **Sensitive data in a public GitHub repository** (hardcoded in source code)
- **API keys handled client-side** with explicit security bypass flags

The architectural decision to use a "sync key" instead of proper authentication was likely made for development speed, but it creates a fundamental security flaw that permeates the entire application. The most critical issue is that the application's Convex backend is essentially a public database that anyone can read and write to.

For a personal-use application, some of these risks may be acceptable to the developer (who is the sole user). However, if this application is ever shared with others, made public, or considered for any kind of production deployment, the Critical and High severity findings must be addressed first.
