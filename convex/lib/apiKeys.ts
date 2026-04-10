/**
 * @file apiKeys.ts
 *
 * Server-side helpers for storing/retrieving BYOK OpenAI API keys in the
 * profiles table. Keys are encrypted at rest with AES-GCM using the
 * API_KEY_ENCRYPTION_SECRET Convex environment variable.
 *
 * Legacy base64-only rows are still readable so existing profiles continue
 * to work until the user saves their key again.
 *
 * @consumers
 *   - convex/profiles.ts (public mutations/queries)
 *   - convex/foodLlmMatching.ts (server-side key lookup)
 *   - convex/ai.ts (server-side key lookup)
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ProfileRow = Doc<"profiles">;
type ProfileReaderCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

const API_KEY_CIPHER_PREFIX = "enc-v1";
const API_KEY_IV_BYTES = 12;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedEncryptionSecret: string | null = null;
let cachedEncryptionKey: Promise<CryptoKey> | null = null;

function getEncryptionSecret(): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET is not configured in Convex environment variables.",
    );
  }
  return secret;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = getEncryptionSecret();
  if (cachedEncryptionKey !== null && cachedEncryptionSecret === secret) {
    return cachedEncryptionKey;
  }

  cachedEncryptionSecret = secret;
  cachedEncryptionKey = (async () => {
    const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
    return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  })().catch((err) => {
    // Clear the cached promise so the next call retries instead of
    // returning the rejected promise forever (rejection poisoning).
    cachedEncryptionKey = null;
    cachedEncryptionSecret = null;
    throw err;
  });
  return cachedEncryptionKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptApiKey(key: string): Promise<string> {
  const encryptionKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(API_KEY_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    textEncoder.encode(key),
  );

  return `${API_KEY_CIPHER_PREFIX}:${bytesToBase64(iv)}:${bytesToBase64(
    new Uint8Array(ciphertext),
  )}`;
}

function decryptLegacyApiKey(value: string): string {
  return atob(value);
}

async function decryptApiKey(value: string): Promise<string> {
  if (!value.startsWith(`${API_KEY_CIPHER_PREFIX}:`)) {
    return decryptLegacyApiKey(value);
  }

  const [, ivBase64, payloadBase64] = value.split(":");
  if (!ivBase64 || !payloadBase64) {
    throw new Error("Stored API key is malformed.");
  }

  const encryptionKey = await getEncryptionKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
      encryptionKey,
      base64ToBytes(payloadBase64),
    );
    return textDecoder.decode(plaintext);
  } catch {
    throw new Error(
      "Stored API key could not be decrypted. Check API_KEY_ENCRYPTION_SECRET.",
    );
  }
}

async function listProfilesByUserId(
  ctx: ProfileReaderCtx,
  userId: string,
): Promise<ProfileRow[]> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

function profileRichnessScore(profile: ProfileRow): number {
  let score = 0;
  if (profile.unitSystem !== "metric") score += 10;
  if (profile.habits.length > 0) score += 8;
  if ((profile.fluidPresets?.length ?? 0) > 0) score += 4;
  else if (profile.fluidPresets !== undefined) score += 1;
  if (profile.sleepGoal !== undefined) score += 4;
  if (profile.healthProfile !== undefined) score += 4;
  if (profile.aiPreferences !== undefined) score += 4;
  if (profile.foodPreferences !== undefined) score += 4;
  if (profile.transitCalibration !== undefined) score += 4;
  if ((profile.knownFoods?.length ?? 0) > 0) score += 3;
  if (profile.encryptedApiKey !== undefined) score += 2;
  return score;
}

function sortProfiles(rows: ReadonlyArray<ProfileRow>): ProfileRow[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        profileRichnessScore(b) - profileRichnessScore(a) ||
        b.updatedAt - a.updatedAt ||
        b._creationTime - a._creationTime,
    );
}

function firstDefined<T>(values: ReadonlyArray<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function firstPopulatedArray<T>(
  values: ReadonlyArray<ReadonlyArray<T> | undefined>,
): ReadonlyArray<T> | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return firstDefined(values);
}

function mergeKnownFoods(rows: ReadonlyArray<ProfileRow>): string[] {
  const knownFoods = new Set<string>();
  for (const row of rows) {
    for (const name of row.knownFoods ?? []) {
      if (name.length > 0) {
        knownFoods.add(name);
      }
    }
  }
  return [...knownFoods];
}

function buildMergedProfile(
  rows: ReadonlyArray<ProfileRow>,
  options: { encryptedApiKey?: string | null; updatedAt: number },
): Omit<ProfileRow, "_id" | "_creationTime"> {
  const sorted = sortProfiles(rows);
  const keeper = sorted[0];
  const nextKnownFoods = mergeKnownFoods(sorted);
  const nextEncryptedApiKey =
    options.encryptedApiKey === undefined
      ? firstDefined(sorted.map((row) => row.encryptedApiKey))
      : options.encryptedApiKey;

  const fluidPresets = (() => {
    const selected = firstPopulatedArray(sorted.map((row) => row.fluidPresets));
    return selected !== undefined ? [...selected] : undefined;
  })();
  const sleepGoal = firstDefined(sorted.map((row) => row.sleepGoal));
  const healthProfile = firstDefined(sorted.map((row) => row.healthProfile));
  const aiPreferences = firstDefined(sorted.map((row) => row.aiPreferences));
  const foodPreferences = firstDefined(
    sorted.map((row) => row.foodPreferences),
  );
  const transitCalibration = firstDefined(
    sorted.map((row) => row.transitCalibration),
  );

  return {
    userId: keeper.userId,
    unitSystem: keeper.unitSystem,
    habits: keeper.habits,
    ...(fluidPresets !== undefined && { fluidPresets }),
    ...(sleepGoal !== undefined && { sleepGoal }),
    ...(healthProfile !== undefined && { healthProfile }),
    ...(aiPreferences !== undefined && { aiPreferences }),
    ...(foodPreferences !== undefined && { foodPreferences }),
    ...(transitCalibration !== undefined && { transitCalibration }),
    ...(nextKnownFoods.length > 0 && { knownFoods: nextKnownFoods }),
    ...(nextEncryptedApiKey !== undefined &&
      nextEncryptedApiKey !== null && {
        encryptedApiKey: nextEncryptedApiKey,
      }),
    updatedAt: options.updatedAt,
  };
}

async function consolidateProfiles(
  ctx: MutationCtx,
  rows: ReadonlyArray<ProfileRow>,
  options: { encryptedApiKey?: string | null; updatedAt: number },
): Promise<void> {
  const [keeper, ...duplicates] = sortProfiles(rows);
  await ctx.db.replace(keeper._id, buildMergedProfile(rows, options));

  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id);
  }
}

/**
 * Store an encrypted API key in the user's profile.
 * Creates a minimal profile with defaults if one does not exist yet.
 * If duplicate profile rows exist from prior races, consolidate them.
 */
export async function storeApiKey(
  ctx: MutationCtx,
  userId: string,
  key: string,
  now: number,
): Promise<void> {
  const encryptedApiKey = await encryptApiKey(key);
  const updatedAt = now;
  const profiles = await listProfilesByUserId(ctx, userId);

  if (profiles.length === 0) {
    await ctx.db.insert("profiles", {
      userId,
      unitSystem: "metric",
      habits: [],
      encryptedApiKey,
      updatedAt,
    });

    const profilesAfterInsert = await listProfilesByUserId(ctx, userId);
    if (profilesAfterInsert.length > 1) {
      await consolidateProfiles(ctx, profilesAfterInsert, {
        encryptedApiKey,
        updatedAt,
      });
    }
    return;
  }

  await consolidateProfiles(ctx, profiles, { encryptedApiKey, updatedAt });
}

/**
 * Check whether any profile row for the user currently stores an API key.
 * This does not decrypt the key, so it remains safe even if encryption
 * configuration has changed.
 */
export async function hasStoredApiKey(
  ctx: QueryCtx,
  userId: string,
): Promise<boolean> {
  const profiles = await listProfilesByUserId(ctx, userId);
  return profiles.some((profile) => profile.encryptedApiKey !== undefined);
}

/**
 * Retrieve the decrypted API key from the user's profile.
 * Returns null if the profile doesn't exist or has no key stored.
 */
export async function getApiKey(
  ctx: QueryCtx,
  userId: string,
): Promise<string | null> {
  const profiles = sortProfiles(await listProfilesByUserId(ctx, userId));
  const profileWithKey = profiles.find(
    (profile) => profile.encryptedApiKey !== undefined,
  );

  if (profileWithKey?.encryptedApiKey === undefined) {
    return null;
  }

  return await decryptApiKey(profileWithKey.encryptedApiKey);
}

/**
 * Delete the stored API key from the user's profile.
 * No-op if the profile doesn't exist.
 * If duplicate profile rows exist from prior races, consolidate them.
 */
export async function deleteApiKey(
  ctx: MutationCtx,
  userId: string,
  now: number,
): Promise<void> {
  const profiles = await listProfilesByUserId(ctx, userId);
  if (profiles.length === 0) {
    return;
  }

  await consolidateProfiles(ctx, profiles, {
    encryptedApiKey: null,
    updatedAt: now,
  });
}
