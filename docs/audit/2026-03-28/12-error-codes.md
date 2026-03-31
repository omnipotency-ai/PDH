Perfect! Now I have enough information to create a comprehensive report. Let me compile everything:

---

## WQ-330 Research Report: Error Handling System Audit & Proposed Solution

### Executive Summary

The Convex backend currently uses **plain string error messages** with inconsistent patterns. Two emerging ad-hoc error code systems exist (`[NON_RETRYABLE]`, `[KEY_ERROR]`, `[QUOTA_ERROR]`, etc.), but they're only partially implemented. The client cannot reliably distinguish error types or provide localized/contextual responses. This report inventories existing errors, proposes a structured error system, and outlines an incremental migration path.

---

### Part 1: Error Inventory & Analysis

#### A. Error Pattern Summary

**Total error throws in production code:** 94+ unique error messages across 30+ files

**Error types by category:**

| Category | Count | Key Examples |
|----------|-------|--------------|
| **Authentication** | 22 | "Not authenticated" (17 instances across multiple files) |
| **Validation** | 16 | "canonicalName is required", "{fieldName} is required" |
| **Not Found** | 8 | "Log not found", "Report not found" |
| **Authorization** | 6 | "Not authorized to modify this log", "Not authorized to delete..." |
| **Constraint Violation** | 5 | "Profile cannot contain more than 100 habits" |
| **External Service** | 12 | OpenAI API errors, Stripe errors, OpenFoodFacts lookup |
| **Data Format** | 6 | "Backup payload is missing...", "Unsupported backup version" |
| **Business Logic** | 6 | "Merge map contains a cycle", "Item index out of range" |
| **Config/Setup** | 3 | "API_KEY_ENCRYPTION_SECRET not configured" |

#### B. Current Ad-Hoc Error Code System

Two files currently use structured error codes embedded in error messages:

**File: `convex/ai.ts` (OpenAI chat completion action)**
```typescript
// Existing classification function
function classifyOpenAiError(status: number): string {
  if (status === 401 || status === 403) return "KEY_ERROR";
  if (status === 429) return "QUOTA_ERROR";
  if (status >= 500) return "NETWORK_ERROR";
  return "NETWORK_ERROR";
}

// Error format: "[NON_RETRYABLE] [KEY_ERROR] Invalid OpenAI API key format..."
```

**File: `convex/foodLlmMatching.ts` (LLM food matching action)**
```typescript
// Duplicates the classification function
// Uses format: "[NON_RETRYABLE] [VALIDATION_ERROR] Log not found or is not a food log."
```

**Current codes observed:**
- `KEY_ERROR` — API key invalid or missing (non-retryable)
- `QUOTA_ERROR` — Rate limit/quota exceeded (retryable)
- `NETWORK_ERROR` — Network/500-class errors (retryable)
- `VALIDATION_ERROR` — Input or state validation failure (non-retryable)

#### C. ConvexError Capabilities

`ConvexError` from `convex/values` is a **generic typed class** that can carry structured data:

```typescript
export declare class ConvexError<TData extends Value> extends Error {
  name: string;
  data: TData;
}
```

**Current usage in codebase:** Only 5 instances in `convex/foodParsing.ts` (for item validation), but all use **plain string messages**—not leveraging the `data` field.

**Limitation:** ConvexError message **cannot be customized**—it always displays the `data` field. But we can structure the `data` to be an object containing code, message, and metadata.

#### D. Client-Side Error Handling Status

Currently minimal error parsing:

```typescript
// Example from useFoodLlmMatching.ts
.catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  console.error(`LLM food matching failed: ${message}`);
  // No parsing of error code or structured response
});
```

Clients show generic toast messages with no distinction between:
- Transient failures (network) vs. permanent failures (bad API key)
- Validation errors vs. auth errors
- Retryable vs. non-retryable errors

---

### Part 2: Proposed Error Code System

#### A. Error Code Enum

```typescript
// convex/lib/errorCodes.ts (NEW)

/**
 * Machine-readable error codes for structured error handling.
 * Used by both server (mutations/actions) and client (error parsers).
 * 
 * Categories:
 * - AUTH: Authentication & authorization failures
 * - VALIDATION: Input validation failures
 * - NOT_FOUND: Resource not found
 * - CONFLICT: State or uniqueness conflicts
 * - RATE_LIMIT: Rate limiting or quota exceeded
 * - EXTERNAL: External service (OpenAI, Stripe, etc.) failures
 * - INTERNAL: Unexpected server errors
 */

export const ERROR_CODE = {
  // Auth (40x)
  UNAUTHENTICATED: "UNAUTHENTICATED",         // 401 equivalent
  FORBIDDEN: "FORBIDDEN",                     // 403 equivalent (not authorized)
  
  // Validation (422)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MALFORMED_INPUT: "MALFORMED_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  
  // Not found (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_DELETED: "RESOURCE_DELETED",
  
  // Conflict (409)
  CONFLICT: "CONFLICT",                      // Uniqueness, state, etc.
  PRECONDITION_FAILED: "PRECONDITION_FAILED", // Version mismatch
  
  // External services
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  API_KEY_ERROR: "API_KEY_ERROR",            // Invalid/expired API key
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",          // Rate limit, quota
  
  // Internal
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",              // Missing env vars, etc.
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
```

#### B. Structured Error Helper

```typescript
// convex/lib/structuredError.ts (NEW)

import { ConvexError } from "convex/values";
import type { ErrorCode } from "./errorCodes";

/**
 * Structured error data object.
 * Serialized to JSON and passed through ConvexError.
 */
export interface StructuredErrorData {
  code: ErrorCode;
  message: string;
  /** User-friendly message for UI display */
  userMessage?: string;
  /** Additional metadata for debugging or client logic */
  metadata?: Record<string, unknown>;
  /** Indicates if the error can be retried by the client */
  retryable?: boolean;
}

/**
 * Create a structured error to throw from a Convex mutation/action.
 * 
 * @param code - Machine-readable error code
 * @param message - Technical message for logs
 * @param userMessage - Optional user-friendly message (defaults to message)
 * @param metadata - Optional metadata (status codes, rate limit info, etc.)
 * 
 * @returns ConvexError with serialized StructuredErrorData
 * 
 * @example
 * if (!user) {
 *   throw createStructuredError(
 *     ERROR_CODE.UNAUTHENTICATED,
 *     "User identity not found in context",
 *     "Please sign in to continue"
 *   );
 * }
 */
export function createStructuredError(
  code: ErrorCode,
  message: string,
  userMessage?: string,
  metadata?: Record<string, unknown>,
): ConvexError<StructuredErrorData> {
  const retryable =
    code === ERROR_CODE.QUOTA_EXCEEDED ||
    code === ERROR_CODE.EXTERNAL_SERVICE_ERROR;

  return new ConvexError<StructuredErrorData>({
    code,
    message,
    userMessage: userMessage ?? message,
    metadata,
    retryable,
  });
}

/**
 * Classify HTTP status codes from external APIs.
 * Returns both the error code and retryability.
 */
export function classifyHttpStatus(status: number): {
  code: ErrorCode;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { code: ERROR_CODE.API_KEY_ERROR, retryable: false };
  }
  if (status === 429) {
    return { code: ERROR_CODE.QUOTA_EXCEEDED, retryable: true };
  }
  if (status >= 500 || status === 408) {
    // 408 = timeout, 5xx = server error
    return { code: ERROR_CODE.EXTERNAL_SERVICE_ERROR, retryable: true };
  }
  if (status === 400 || status === 422) {
    return { code: ERROR_CODE.MALFORMED_INPUT, retryable: false };
  }
  return { code: ERROR_CODE.EXTERNAL_SERVICE_ERROR, retryable: true };
}
```

#### C. Client-Side Error Parser

```typescript
// src/lib/errorParsing.ts (NEW)

import type { StructuredErrorData } from "../../convex/lib/structuredError";
import type { ErrorCode } from "../../convex/lib/errorCodes";

/**
 * Parse an error from a Convex mutation/action into structured data.
 * 
 * Returns the structured data if available, otherwise extracts the message
 * and returns a generic error object.
 * 
 * @param error - Unknown error from catch block
 * @returns Parsed error with code, messages, and retryability
 * 
 * @example
 * .catch((err) => {
 *   const parsed = parseConvexError(err);
 *   if (parsed.code === ERROR_CODE.API_KEY_ERROR) {
 *     toast.error("Invalid API key. Please check your settings.");
 *   } else if (parsed.retryable) {
 *     triggerRetry();
 *   }
 * });
 */
export function parseConvexError(error: unknown): StructuredErrorData {
  // If it's already structured, return it
  if (
    error instanceof Error &&
    error.message &&
    typeof error.message === "string"
  ) {
    try {
      // Convex serializes the error.data as JSON in the message
      // This attempts to parse it if available
      const parsed = JSON.parse(error.message) as StructuredErrorData;
      if (parsed.code && parsed.message) {
        return parsed;
      }
    } catch {
      // Not JSON, fall through to generic handling
    }
  }

  // Fallback: extract message and create generic error
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    code: "INTERNAL_ERROR" as ErrorCode,
    message,
    userMessage: "An unexpected error occurred. Please try again.",
    retryable: false,
  };
}

/**
 * Determine if an error should trigger a retry button in the UI.
 */
export function shouldShowRetryButton(parsed: StructuredErrorData): boolean {
  return parsed.retryable ?? false;
}

/**
 * Get a user-friendly error message for displaying in toast/modal.
 * Falls back to technical message if userMessage is not available.
 */
export function getUserErrorMessage(parsed: StructuredErrorData): string {
  return parsed.userMessage ?? parsed.message ?? "Something went wrong";
}

/**
 * Get a technical message for logging (console, Sentry, etc.).
 */
export function getTechnicalErrorMessage(
  parsed: StructuredErrorData,
): string {
  const parts = [parsed.code, parsed.message];
  if (parsed.metadata) {
    parts.push(JSON.stringify(parsed.metadata));
  }
  return parts.join(" | ");
}
```

---

### Part 3: Implementation Plan (Incremental Migration)

#### Phase 1: Foundation (Week 1)
- [ ] Create `convex/lib/errorCodes.ts` with ERROR_CODE enum
- [ ] Create `convex/lib/structuredError.ts` with helpers
- [ ] Create `src/lib/errorParsing.ts` with client parser
- [ ] Add unit tests for helpers
- [ ] **No breaking changes to existing code**

#### Phase 2: Pilot in High-Value Areas (Week 2–3)
Migrate the most frequently-used error paths first:

1. **Auth guard in `convex/lib/auth.ts`**
   ```typescript
   // OLD
   if (!identity) throw new Error("Not authenticated");
   
   // NEW
   if (!identity) {
     throw createStructuredError(
       ERROR_CODE.UNAUTHENTICATED,
       "User identity not found in context",
       "Please sign in to continue"
     );
   }
   ```

2. **Input validation in `convex/lib/inputSafety.ts`**
   ```typescript
   // OLD
   throw new Error(`${fieldName} is required.`);
   
   // NEW
   throw createStructuredError(
     ERROR_CODE.MISSING_FIELD,
     `Validation failed for field "${fieldName}"`,
     `${fieldName} is required`,
     { fieldName }
   );
   ```

3. **External service errors in `convex/ai.ts` and `convex/foodLlmMatching.ts`**
   ```typescript
   // OLD
   throw new Error(`[${errorCode}] OpenAI API error: ${message}`);
   
   // NEW
   const { code, retryable } = classifyHttpStatus(status);
   throw createStructuredError(
     code,
     `OpenAI API returned ${status}: ${message}`,
     retryable
       ? "AI matching temporarily unavailable. Please try again."
       : "Invalid OpenAI API key",
     { status, message }
   );
   ```

4. **Client integration in `src/hooks/useFoodLlmMatching.ts`**
   ```typescript
   // OLD
   .catch((err: unknown) => {
     const message = err instanceof Error ? err.message : "Unknown error";
     toast.error("Food matching failed");
   });
   
   // NEW
   .catch((err: unknown) => {
     const parsed = parseConvexError(err);
     console.error(`[LLM] ${getTechnicalErrorMessage(parsed)}`);
     if (shouldShowRetryButton(parsed)) {
       // Show toast with retry button
     } else {
       toast.error(getUserErrorMessage(parsed));
     }
   });
   ```

**Measurement:** Ensure all test suites pass after each file migration.

#### Phase 3: Systematic Migration (Week 4–5)
Migrate remaining error-throwing code by module:
- [ ] `convex/logs.ts` — entity not found, authorization, constraint violations
- [ ] `convex/foodParsing.ts` — validation, state errors
- [ ] `convex/profiles.ts` — API key handling
- [ ] `convex/foodLibrary.ts` — business logic errors (cycles, merges)
- [ ] Other action/mutation files

**Batch approach:** Group similar errors by category to avoid mechanical drift.

#### Phase 4: Legacy Error String Cleanup (Week 6)
Once core paths are migrated:
- [ ] Identify any remaining `throw new Error(...)` that could be structured
- [ ] Update test expectations (`rejects.toThrow()` → parse code instead)
- [ ] Consider deprecating plain `Error` in favor of `ConvexError` via linting rule

---

### Part 4: Migration Path & Backward Compatibility

#### Compatibility Concerns

1. **Existing clients expect plain error messages**
   - Solution: Parser gracefully falls back to extracting `.message` field
   - No breaking change to client code that only logs errors

2. **Tests currently match error strings**
   ```typescript
   // OLD
   expect(() => func()).rejects.toThrow("Not authenticated");
   
   // NEW (parsing-aware test helper)
   expect(() => func()).rejects.toThrow(
     expect.objectContaining({ code: ERROR_CODE.UNAUTHENTICATED })
   );
   ```
   - Create test utility to assert on error code, not message

3. **Convex retries and exponential backoff**
   - Convex automatically retries on non-structured errors
   - Our `retryable` field in metadata is **advisory only** for UI purposes
   - Server-side retry logic (actions/mutations) unaffected

#### Rollout Strategy

1. **Commit 1:** Add lib files, zero changes to existing code
2. **Commits 2–6:** Migrate by module (one per commit)
3. **Commit 7:** Update test utilities and fix test assertions
4. **Commit 8:** Documentation and team guidance

---

### Part 5: Example: Full Migration of One Function

**Before:**
```typescript
// convex/lib/auth.ts
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<{ userId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return { userId: identity.subject };
}
```

**After:**
```typescript
// convex/lib/auth.ts
import { createStructuredError } from "./structuredError";
import { ERROR_CODE } from "./errorCodes";

export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<{ userId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw createStructuredError(
      ERROR_CODE.UNAUTHENTICATED,
      "User identity not found in Clerk context",
      "Please sign in to continue"
    );
  }
  return { userId: identity.subject };
}
```

**Client usage:**
```typescript
// src/hooks/useMyData.ts
const mutation = useMutation(api.myModule.getData);

const handleFetch = async () => {
  try {
    const data = await mutation({ /* args */ });
    // ...
  } catch (err) {
    const parsed = parseConvexError(err);
    
    if (parsed.code === ERROR_CODE.UNAUTHENTICATED) {
      // Redirect to login
      window.location.href = "/auth/signin";
    } else {
      // Generic error handling
      toast.error(getUserErrorMessage(parsed));
    }
  }
};
```

---

### Part 6: Testing Strategy

#### Unit Tests for Error Helpers

```typescript
// convex/lib/__tests__/structuredError.test.ts
describe("createStructuredError", () => {
  it("should create a retryable error for QUOTA_EXCEEDED", () => {
    const err = createStructuredError(
      ERROR_CODE.QUOTA_EXCEEDED,
      "Rate limited",
    );
    expect(err.data.retryable).toBe(true);
  });

  it("should create a non-retryable error for API_KEY_ERROR", () => {
    const err = createStructuredError(
      ERROR_CODE.API_KEY_ERROR,
      "Invalid key",
    );
    expect(err.data.retryable).toBe(false);
  });

  it("should preserve metadata", () => {
    const err = createStructuredError(
      ERROR_CODE.EXTERNAL_SERVICE_ERROR,
      "Service down",
      undefined,
      { statusCode: 503 }
    );
    expect(err.data.metadata).toEqual({ statusCode: 503 });
  });
});
```

#### Integration Tests for Client Parsing

```typescript
// src/lib/__tests__/errorParsing.test.ts
describe("parseConvexError", () => {
  it("should parse structured errors from Convex", () => {
    const structuredError = new Error(JSON.stringify({
      code: ERROR_CODE.API_KEY_ERROR,
      message: "Invalid key format",
      userMessage: "Please check your API key",
    }));
    
    const parsed = parseConvexError(structuredError);
    expect(parsed.code).toBe(ERROR_CODE.API_KEY_ERROR);
    expect(parsed.userMessage).toBe("Please check your API key");
  });

  it("should gracefully fall back for unstructured errors", () => {
    const plainError = new Error("Something went wrong");
    const parsed = parseConvexError(plainError);
    
    expect(parsed.code).toBe("INTERNAL_ERROR");
    expect(parsed.message).toContain("Something went wrong");
  });
});
```

#### E2E Test Updates

```typescript
// Existing test with old assertion
expect(mutation()).rejects.toThrow("Not authenticated");

// Updated assertion
expect(mutation()).rejects.toThrow(
  expect.objectContaining({
    data: expect.objectContaining({
      code: ERROR_CODE.UNAUTHENTICATED,
    }),
  })
);

// Better: Use helper
await expect(mutation()).rejectsWithCode(ERROR_CODE.UNAUTHENTICATED);
```

---

### Part 7: Key Benefits of This System

| Benefit | Impact |
|---------|--------|
| **Machine-readable codes** | Client can distinguish error types → better UX (retry buttons, specific messages) |
| **Retryability hints** | Automatic exponential backoff retry logic in client |
| **Structured metadata** | Enhanced debugging (API status, field names, rate limit info) |
| **Localization support** | i18n can key off error codes, not fragile message strings |
| **Monitoring/analytics** | Error codes enable dashboards, alerts, trend analysis |
| **Backward compatible** | Old clients still work (parser falls back gracefully) |
| **Incremental adoption** | No big-bang rewrite; migrate by module over time |

---

### Part 8: Caveats & Open Questions

1. **Error message serialization:** How does Convex serialize `ConvexError.data`?
   - Current code assumes JSON serialization in `.message`
   - **Verify:** Check Convex docs or test with actual ConvexError throw

2. **Client-side error type checking:** Will `instanceof ConvexError` work in browser?
   - Likely **no**—the error crosses an HTTP boundary
   - **Verify:** Test actual client-server error flow

3. **Existing telemetry:** Do error codes break any Sentry/monitoring integrations?
   - **Mitigation:** Log both structured code and message
   - **Test:** With your monitoring setup

4. **Convex automatic retries:** Does adding `retryable` metadata affect server-side retry logic?
   - **Answer:** No—Convex decides retries based on error type, not metadata
   - Our `retryable` field is **UI-only**

---

### Summary Table: Error Codes Reference

```typescript
// Quick reference for errors mapping

Auth Errors:
  UNAUTHENTICATED (401)    → "Please sign in"
  FORBIDDEN (403)          → "Access denied"

Validation Errors:
  VALIDATION_ERROR         → "Input validation failed"
  MISSING_FIELD            → "{fieldName} is required"
  INVALID_FORMAT           → "Invalid {fieldName} format"
  MALFORMED_INPUT          → "Malformed request body"

Resource Errors:
  NOT_FOUND (404)          → "Not found"
  RESOURCE_DELETED         → "Item was deleted"

Conflict Errors:
  CONFLICT (409)           → "Item already exists or state conflict"
  PRECONDITION_FAILED      → "Version mismatch (optimistic lock)"

External Service Errors:
  API_KEY_ERROR            → "Invalid API key (non-retryable)"
  QUOTA_EXCEEDED           → "Rate limit hit (retryable)"
  EXTERNAL_SERVICE_ERROR   → "Service temporarily unavailable"

Internal Errors:
  INTERNAL_ERROR           → "Unexpected server error"
  CONFIG_ERROR             → "Server misconfiguration"
```

---

### Files to Create & Modify

**New files:**
- `/Users/peterjamesblizzard/projects/caca_traca/convex/lib/errorCodes.ts`
- `/Users/peterjamesblizzard/projects/caca_traca/convex/lib/structuredError.ts`
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/errorParsing.ts`
- `/Users/peterjamesblizzard/projects/caca_traca/convex/lib/__tests__/structuredError.test.ts`
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/__tests__/errorParsing.test.ts`

**Files to migrate (phased):**
- `convex/lib/auth.ts`
- `convex/lib/inputSafety.ts`
- `convex/ai.ts`
- `convex/foodLlmMatching.ts`
- `convex/logs.ts`
- `convex/foodParsing.ts`
- `convex/profiles.ts`
- `src/hooks/useFoodLlmMatching.ts`
- (and 20+ others)

---

This plan provides a **structured, incremental path** to replacing ad-hoc error strings with machine-readable codes, enabling the client to respond intelligently to different error types while maintaining backward compatibility.