Perfect. Now I have all the information I need. Let me analyze the differences between the architecture doc and the actual current implementation.

## Analysis: Architecture Document Staleness

Based on my read of the actual code and the sprint plan, here is a section-by-section audit of what is outdated in `docs/current-state-architecture.md`:

---

## **CRITICAL SECTIONS WITH STALE INFORMATION**

### **Section 1: Data Ownership (Line 18)**

**STALE:** The table states OpenAI API key is "IDB only" and "never stored in Convex."

**CURRENT REALITY:** 
- API key is NOW **dual-stored**: IndexedDB (client) and Convex `profiles.encryptedApiKey` (server)
- File: `convex/lib/apiKeys.ts` implements server-side encryption with AES-GCM
- File: `src/hooks/useApiKey.ts` auto-migrates keys from IDB to server on mount
- Server-side actions (`convex/foodLlmMatching.ts`, `convex/ai.ts`) now look up keys from Convex profile as fallback when client doesn't provide one

**CORRECT VERSION:**
```
| Data type                            | Canonical source     | How it works                                                         |
| ---- | ---- | ---- |
| OpenAI API key                       | Convex + IDB        | Encrypted at rest in Convex via AES-GCM (profiles.encryptedApiKey). Client maintains IndexedDB copy for direct access. Auto-migrates from IDB on first mount (Wave 4C, WQ-317).        |
```

---

### **Section 7: Server-Side Food Pipeline → LLM Matching Subsection (Lines 149–159)**

**STALE:** Describes "client-initiated, BYOK" flow but says API key is "sent transiently, never stored."

**CURRENT REALITY:**
- Client CAN send API key transiently (backward-compatible), but fallback to server-stored key is now implemented
- `convex/foodLlmMatching.ts` lines 554–563 show: client-provided key is tried first, then server-stored fallback
- Key is still encrypted at rest and never logged (masked for safety)
- The architecture moved toward **server-can-be-autonomous** (preparatory for Phase 4D)

**CORRECT VERSION:**
```
### LLM matching (server-first with client fallback)

The client hook `useFoodLlmMatching.ts` detects unresolved items and calls the
`convex/foodLlmMatching.ts::matchUnresolvedItems` action.

API key resolution order:
1. Client-provided key (IndexedDB copy, sent transiently)
2. Server-stored encrypted key (from profiles.encryptedApiKey, if available)

```
if (!apiKey) {
  const profileKey = await ctx.runQuery(internal.profiles.getServerApiKey, { userId });
  if (profileKey !== null) {
    apiKey = profileKey;
  }
}
```

Both paths encrypt the key at rest (server storage via `convex/lib/apiKeys.ts`).
The LLM call is made server-side. Results are written back via `applyLlmResults` mutation.
```

---

### **Section 7: Pipeline Modules Table (Lines 167–175)**

**STALE:** Does NOT mention `convex/ai.ts` which also uses the API key pattern.

**CURRENT REALITY:**
- `convex/ai.ts` is a generic chat completion relay action (lines 37–122) 
- Implements the same API key resolution pattern as `foodLlmMatching.ts`
- Used for Dr. Poo AI reports and other generic LLM tasks

**CORRECT VERSION:** Add to the modules table:
```
| Module                                 | Role                                                                           |
| ------ | ------ |
| `convex/ai.ts`                         | Generic OpenAI chat completion relay (Dr. Poo reports, any LLM call)           |
| `convex/lib/apiKeys.ts`                | Server-side API key encryption/decryption helpers (AES-GCM at rest)           |
```

---

### **Section 1: Data Drift Rules (Line 24)**

**STALE:** States "The OpenAI API key is device-local only and never stored in Convex."

**CORRECT VERSION:**
```
- The OpenAI API key is now dual-stored: encrypted at rest in Convex (`profiles.encryptedApiKey`), 
  with IndexedDB as a fallback during the client-to-server migration window. Server actions can now 
  operate autonomously without the client providing the key (Phase 4C, WQ-317).
```

---

### **Section 5: Routing (Lines 92–110)**

**STALE:** Does NOT mention `/api-key-guide` route (if it exists as a public page).

**CURRENT REALITY:** The doc shows `/api-key-guide` as a public route at lines 101. This is consistent with code and doesn't need updating.

**STATUS:** ✅ This section is accurate.

---

### **Section 9: Derived vs Persisted (Lines 220–231)**

**STATUS:** ✅ This section is accurate — correctly identifies that transit calibration, food safety, baseline averages, etc. are derived then cached, and that ingredient exposures are persisted server-side.

---

### **Section 11: Remaining Architectural Debt (Lines 237–249)**

**STALE:** Does NOT mention the LLM context pipeline overhaul (Phase 4) which is actively shipping in Sprint 2.5+.

**CURRENT REALITY:**
- Wave 4A (design) is DONE (documented in sprint plan)
- Wave 4B (context compiler, client-side refactor) is being implemented
- Wave 4C (API key migration to server) is partially DONE — the infrastructure is in place
- Wave 4D (move compiler server-side) is planned for Sprint 3

**ADD TO SECTION 11:**
```
### Phase 4: LLM Context Pipeline Redesign (In Progress)

Currently shipping in Sprint 2.5+:
- Wave 4A: LLM context payload design (DONE) — variable time windows by log type + surgery
- Wave 4B: Context compiler refactor (in progress) — client-side rebuild of buildLogContext/buildUserMessage
- Wave 4C: API key server migration (partial) — infrastructure in place; user migration pending

After stabilization (~1 week): Wave 4D will move context compilation server-side, enabling fully 
server-autonomous LLM operations without the client. This completes the shift from "client orchestrates 
LLM" to "server-first with client as fallback."

See `docs/plans/2026-03-18-sprint-2.5+-data-architecture-overhaul.md` Phase 4 for full scope.
```

---

### **Section 3: What IndexedDB Owns (Lines 44–58)**

**STALE:** States IDB stores "exactly one thing: the user's OpenAI API key."

**CURRENT REALITY:**
- IDB still primarily stores the API key, but the key is now **dual-owned** with Convex
- The `migrateLegacyStorage` comment is still accurate
- The "no Zustand blob" and "no persist middleware" parts are correct

**CORRECT VERSION:**
```
## 3. What IndexedDB Owns

IDB stores the user's OpenAI API key as a client-side copy for direct action calls.

The canonical store for the API key is now **Convex** (`profiles.encryptedApiKey`, encrypted at rest).
IndexedDB serves as a fallback during the migration window (Phase 4C, WQ-317). On first load, 
`useApiKey.ts` auto-migrates any client-only key to the server.

There is **no**:
- Zustand blob in IDB
- Persist middleware
- Settings cache
- Sync queue
- Migration metadata
- Version-gated data migrations
```

---

## **COMPLETE UPDATED SUMMARY TABLE**

| **Section** | **Line(s)** | **Status** | **Core Issue** |
|---|---|---|---|
| 1. Data Ownership table | 18 | ❌ STALE | API key no longer "IDB only" — now Convex + IDB (dual-owned, encrypted at rest) |
| 1. Data drift rules | 24 | ❌ STALE | Says key is "device-local only" — now stored server-side encrypted |
| 3. IndexedDB Owns | 44–58 | ⚠️ PARTIAL | Key is now canonical in Convex, IDB is fallback |
| 7. LLM matching subsection | 149–159 | ❌ STALE | Doesn't mention server-stored key fallback; says key "never stored" |
| 7. Pipeline modules table | 167–175 | ⚠️ INCOMPLETE | Missing `convex/ai.ts` and `convex/lib/apiKeys.ts` |
| 11. Remaining debt | 237–249 | ⚠️ MISSING | No mention of Phase 4 (LLM context redesign, now in-flight) |

---

## **FILES THAT SHOULD BE REFERENCED IN UPDATED SECTIONS**

- `convex/foodLlmMatching.ts` (lines 554–563: API key resolution pattern)
- `convex/ai.ts` (lines 51–63: same pattern in generic chat action)
- `convex/lib/apiKeys.ts` (lines 74–115: encryption/decryption helpers)
- `src/hooks/useApiKey.ts` (lines 60–67: auto-migration logic)
- `src/hooks/useFoodLlmMatching.ts` (lines 129–135: client passes key as fallback)
- `docs/plans/2026-03-18-sprint-2.5+-data-architecture-overhaul.md` Phase 4 (context pipeline design)

---

## **KEY INSIGHT: THE ARCHITECTURE SHIFTED**

The doc was written **before** Wave 4C (API key server migration) shipped its **infrastructure**. The code now has:

1. **Encryption at rest** (`AES-GCM`, `API_KEY_ENCRYPTION_SECRET`) in Convex
2. **Auto-migration** from IDB to server on client mount
3. **Server-side fallback** in actions when client doesn't provide key
4. **Dual-store during transition** — IndexedDB for fast client access, Convex for server autonomy

This is the **preparatory foundation** for Phase 4D (full server-side context compilation), which will ship in Sprint 3. The doc should reflect this current state as the "bridge phase" between client-first and server-first architecture.