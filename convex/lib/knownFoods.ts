import type { MutationCtx } from "../_generated/server";

/**
 * Adds canonical food names to the user's `knownFoods` set on their profile.
 * Deduplicates against existing entries. No-op if all names are already known
 * or if the user has no profile.
 *
 * This avoids unbounded historical log scans in weeklyDigest by maintaining
 * a running set of all foods the user has ever logged.
 */
export async function addToKnownFoods(
  ctx: MutationCtx,
  userId: string,
  canonicalNames: ReadonlyArray<string>,
): Promise<void> {
  if (canonicalNames.length === 0) return;

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (profile === null) return;

  const existing = new Set(profile.knownFoods ?? []);
  const toAdd = canonicalNames.filter(
    (name) => name !== "" && name !== "unknown_food" && !existing.has(name),
  );

  if (toAdd.length === 0) return;

  for (const name of toAdd) {
    existing.add(name);
  }

  await ctx.db.patch(profile._id, {
    knownFoods: [...existing],
  });
}
