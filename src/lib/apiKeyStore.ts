import { del, get, set } from "idb-keyval";

const API_KEY_STORAGE_KEY = "caca-traca-openai-key";

export async function getApiKey(): Promise<string | null> {
  const key = await get<string>(API_KEY_STORAGE_KEY);
  return key ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  await set(API_KEY_STORAGE_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await del(API_KEY_STORAGE_KEY);
}
