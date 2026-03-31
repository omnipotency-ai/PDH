import { del, get, set } from "idb-keyval";

const API_KEY_STORAGE_KEY = "PDH-ai-key";
const LEGACY_API_KEY_STORAGE_KEY = "PDH-openai-key";

/**
 * Migrate from the old provider-specific key name to the provider-agnostic one.
 * Reads the legacy key, writes it to the new key, then deletes the old key.
 * Safe to call multiple times — no-ops once the legacy key is absent.
 */
async function migrateLegacyApiKey(): Promise<void> {
  const legacyKey = await get<string>(LEGACY_API_KEY_STORAGE_KEY);
  if (legacyKey === undefined) return;
  await set(API_KEY_STORAGE_KEY, legacyKey);
  await del(LEGACY_API_KEY_STORAGE_KEY);
}

export async function getApiKey(): Promise<string | null> {
  await migrateLegacyApiKey();
  const key = await get<string>(API_KEY_STORAGE_KEY);
  return key ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  await set(API_KEY_STORAGE_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await del(API_KEY_STORAGE_KEY);
}
