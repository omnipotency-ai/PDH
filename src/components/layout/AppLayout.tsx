import { SignInButton } from "@clerk/clerk-react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { ApiKeyProvider } from "@/contexts/ApiKeyContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SyncedLogsProvider } from "@/contexts/SyncedLogsContext";
import { AuthLoadingFallback } from "./AuthLoadingFallback";
import { GlobalHeader } from "./GlobalHeader";

export function AppLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const requiresSyncedLogs =
    pathname === "/" ||
    pathname.startsWith("/patterns") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/menu") ||
    pathname.startsWith("/archive");

  return (
    <div className="relative min-h-screen">
      <Authenticated>
        <ApiKeyProvider>
          <ProfileProvider>
            <GlobalHeader />
            <main className="relative z-10 mx-auto w-full max-w-440 px-4 py-4 pb-8">
              {requiresSyncedLogs ? (
                <SyncedLogsProvider>
                  <Outlet />
                </SyncedLogsProvider>
              ) : (
                <Outlet />
              )}
            </main>
          </ProfileProvider>
        </ApiKeyProvider>
      </Authenticated>
      <Unauthenticated>
        <div className="flex min-h-screen flex-col items-center justify-center gap-6">
          <img
            src="/icons/icon-72x72.png"
            alt="PDH"
            width={72}
            height={72}
            className="drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]"
          />
          <h1 className="bg-linear-to-r from-(--teal) to-(--section-food) bg-clip-text font-display text-2xl font-extrabold tracking-tight text-transparent">
            PDH
          </h1>
          <p className="text-sm text-(--text-muted)">
            Sign in to access the app
          </p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-xl bg-(--teal) px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <AuthLoadingFallback />
      </AuthLoading>
    </div>
  );
}
