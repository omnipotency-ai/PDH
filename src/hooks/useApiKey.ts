/**
 * @file useApiKey.ts
 *
 * React hook that manages the user's OpenAI API key. The key is stored in
 * both IndexedDB (for client-side access) and Convex (for server-side access).
 * Convex is the primary store; IndexedDB is kept as fallback during migration.
 *
 * On mount:
 *   1. Loads key from IndexedDB (existing behavior)
 *   2. If IndexedDB has a key but Convex doesn't, auto-migrates to Convex
 *
 * On save/delete:
 *   - Writes to BOTH IndexedDB and Convex
 *   - IndexedDB is written first (fast, local); Convex is best-effort
 *
 * The client still prefers the local copy for direct action calls, but
 * server-side fallback remains available when only the Convex copy exists.
 *
 * @exports useApiKey — returns { apiKey, hasApiKey, loading, updateKey, removeKey }
 *
 * @consumers
 *   - src/contexts/ApiKeyContext.tsx (sole direct consumer; re-exposes as useApiKeyContext)
 */
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { clearApiKey, getApiKey, setApiKey } from "@/lib/apiKeyStore";
import { api } from "../../convex/_generated/api";

/**
 * Sanitize an error for logging — strip any API key material that might
 * appear in the error message or serialized args. Only the error type and
 * a safe summary are logged; never the raw error object which could contain
 * the key in its serialized form.
 */
function sanitizeApiKeyError(err: unknown): string {
  if (err instanceof Error) {
    // Replace anything that looks like an API key (sk-...) in the message
    return err.message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-****");
  }
  return "Unknown error (details redacted for key safety)";
}

export function useApiKey() {
  const [apiKey, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasServerKey = useQuery(api.profiles.hasServerApiKey);
  const setServerKey = useMutation(api.profiles.setApiKey);
  const removeServerKey = useMutation(api.profiles.removeApiKey);

  // Load from IndexedDB on mount
  useEffect(() => {
    getApiKey().then((k) => {
      setKey(k);
      setLoading(false);
    });
  }, []);

  // Auto-migrate: if IndexedDB has a key but server doesn't, push to Convex
  useEffect(() => {
    if (apiKey !== null && hasServerKey === false) {
      setServerKey({ apiKey }).catch((err: unknown) => {
        // WQ-323: Never log the raw error — it may contain the API key
        console.error("[ApiKey] Migration to server failed:", sanitizeApiKeyError(err));
      });
    }
  }, [apiKey, hasServerKey, setServerKey]);

  const updateKey = useCallback(
    async (key: string) => {
      // Write to IndexedDB first (fast, local)
      await setApiKey(key);
      setKey(key);
      // Then write to Convex (best-effort)
      try {
        await setServerKey({ apiKey: key });
      } catch (err: unknown) {
        // WQ-323: Never log the raw error — it may contain the API key
        console.error("[ApiKey] Server save failed:", sanitizeApiKeyError(err));
      }
    },
    [setServerKey],
  );

  const removeKey = useCallback(async () => {
    // Clear IndexedDB first
    await clearApiKey();
    setKey(null);
    // Then clear Convex (best-effort)
    try {
      await removeServerKey();
    } catch (err: unknown) {
      // WQ-323: Sanitize error even for delete — errors may reference prior state
      console.error("[ApiKey] Server delete failed:", sanitizeApiKeyError(err));
    }
  }, [removeServerKey]);

  return {
    apiKey,
    // During loading, hasApiKey is undefined (not false) to avoid false negatives.
    // Consumers should check `loading` before acting on `hasApiKey`.
    hasApiKey:
      loading || hasServerKey === undefined ? undefined : apiKey !== null || hasServerKey === true,
    loading,
    updateKey,
    removeKey,
  };
}
