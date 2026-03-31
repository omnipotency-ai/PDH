# Fix Status: convex/stripe.ts Audit Remediation

**Date:** 2026-03-28
**File:** `convex/stripe.ts`
**Typecheck:** PASS

## Findings Fixed

### HIGH: Auth migration — FIXED
- Replaced raw `ctx.auth.getUserIdentity()` + null check with `requireAuth(ctx)` from `convex/lib/auth.ts`.
- Imports `requireAuth` at top of file.

### HIGH: Client-supplied priceId not allowlisted — FIXED
- Added server-side `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_LIFETIME_PRICE_ID` env var reads.
- Builds a `validPriceIds` set from configured env vars.
- Validates `args.priceId` is in the set; throws `"Invalid price ID"` if not.
- Throws if no price IDs are configured at all.
- **Deploy note:** Add `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_LIFETIME_PRICE_ID` to Convex environment variables (matching the `VITE_STRIPE_*` client-side values).

### HIGH: successUrl/cancelUrl not validated — FIXED
- Added `APP_URL` env var read (already in `.env.example`).
- Validates both `successUrl` and `cancelUrl` start with `APP_URL`.
- Throws `"Invalid redirect URL"` if validation fails.
- Kept client-supplied URLs (args unchanged) to avoid breaking client code. Server validates origin.
- **Deploy note:** Add `APP_URL` to Convex environment variables.

### HIGH: Stripe error body leaked to caller — FIXED
- Error response body is now logged server-side via `console.error` (includes status code + body).
- Caller receives only `"Payment processing failed. Please try again."`.

### MODERATE: Date.now() — N/A
- No `Date.now()` calls exist in this file. No changes needed.

## Environment Variables Required (New)

| Variable | Description | Where to set |
|---|---|---|
| `STRIPE_MONTHLY_PRICE_ID` | Stripe price ID for monthly subscription | Convex env vars |
| `STRIPE_LIFETIME_PRICE_ID` | Stripe price ID for lifetime payment | Convex env vars |
| `APP_URL` | App origin URL (e.g., `https://cacatraca.com`) | Convex env vars |
