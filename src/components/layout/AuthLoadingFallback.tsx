import { useEffect, useState } from "react";

const AUTH_LOADING_TIMEOUT_MS = 8000;

export function AuthLoadingFallback() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), AUTH_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!timedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-(--text-muted)">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-(--orange)/30 bg-(--surface-1) p-5">
        <h2 className="text-base font-semibold text-(--text)">Auth is unavailable</h2>
        <p className="text-sm text-(--text-muted)">
          Sign-in is taking too long to load. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-(--text) hover:bg-(--surface-2)"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
