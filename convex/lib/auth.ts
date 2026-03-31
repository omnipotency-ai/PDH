import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Require authenticated user identity.
 *
 * Returns `{ userId }` where `userId` is `identity.subject`.
 * Throws if the user is not authenticated.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new Error("Not authenticated");
  }
  return { userId: identity.subject };
}
