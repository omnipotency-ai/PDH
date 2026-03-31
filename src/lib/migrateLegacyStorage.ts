import { del, get } from "idb-keyval";
import { setApiKey } from "./apiKeyStore";

const LEGACY_KEY = "ostomy-tracker-storage";

const PROFILE_FIELDS = [
  "unitSystem",
  "habits",
  "fluidPresets",
  "sleepGoal",
  "healthProfile",
  "aiPreferences",
  "foodPersonalisation",
  "transitCalibration",
] as const;

type ProfileField = (typeof PROFILE_FIELDS)[number];

type LegacyProfileData = Partial<
  Record<ProfileField, unknown> & {
    openAiApiKey: unknown;
  }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * One-time migration from the legacy Zustand IDB blob to Convex + new API key store.
 *
 * - Reads the old `ostomy-tracker-storage` blob from IndexedDB.
 * - Saves the OpenAI API key to the new dedicated IDB store (`apiKeyStore`).
 * - Backfills profile/settings fields to Convex only when the cloud profile does not
 *   already define them.
 * - Deletes the legacy blob so the migration never runs again.
 *
 * Returns `true` if a migration was performed, `false` if nothing to migrate.
 */
export async function migrateLegacyStorage(
  cloudProfile: Record<string, unknown> | null,
  patchProfile: (updates: Record<string, unknown>) => Promise<void>,
): Promise<boolean> {
  let raw: unknown;
  try {
    raw = await get(LEGACY_KEY);
  } catch (err) {
    console.warn("[Migration] Could not read legacy IDB blob:", err);
    return false;
  }

  if (!raw) return false; // nothing to migrate

  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  } catch (err) {
    console.warn("[Migration] Could not parse legacy IDB blob:", err);
    return false;
  }

  // Zustand persist wraps data under a `state` key.
  const unwrapped = isRecord(parsed) && "state" in parsed ? parsed.state : parsed;
  if (!isRecord(unwrapped)) {
    console.warn("[Migration] Legacy IDB blob has unexpected shape.");
    return false;
  }
  const data: LegacyProfileData = unwrapped;

  // Save API key to the new dedicated IDB store
  if (typeof data.openAiApiKey === "string" && data.openAiApiKey.length > 0) {
    await setApiKey(data.openAiApiKey);
  }

  // Backfill only fields that exist in the legacy blob AND are still missing in Convex.
  const updates: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    const legacyValue = data[field];
    const cloudValue = cloudProfile?.[field];
    if (legacyValue !== undefined && cloudValue === undefined) {
      updates[field] = data[field];
    }
  }

  if (Object.keys(updates).length > 0) {
    await patchProfile(updates);
  }

  // Delete the legacy blob so migration is never re-triggered
  try {
    await del(LEGACY_KEY);
  } catch (err) {
    // Non-fatal — blob stays but won't cause issues since data is already migrated.
    // Log it so we know if cleanup failed.
    console.warn("[Migration] Could not delete legacy IDB blob:", err);
  }

  return true;
}
