import { SignInButton } from "@clerk/clerk-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { BarChart3, Home, NotebookPen, UtensilsCrossed } from "lucide-react";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SyncedLogsProvider } from "@/contexts/SyncedLogsContext";
import { cn } from "@/lib/utils";
import { AuthLoadingFallback } from "./AuthLoadingFallback";
import { GlobalHeader } from "./GlobalHeader";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Home",
    icon: Home,
    activeTone: "text-teal-600 dark:text-teal-400",
  },
  {
    to: "/track",
    label: "Track",
    icon: NotebookPen,
    activeTone: "text-sky-600 dark:text-sky-400",
  },
  {
    to: "/food",
    label: "Food",
    icon: UtensilsCrossed,
    activeTone: "text-orange-600 dark:text-orange-400",
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
    activeTone: "text-rose-600 dark:text-rose-400",
  },
] as const;

function BottomTabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/6 bg-[rgba(255,255,255,0.9)] backdrop-blur-xl dark:bg-[rgba(12,20,32,0.9)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex w-full max-w-440 items-center justify-around px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-xs font-medium transition-colors",
                isActive ? item.activeTone : "text-(--text-muted)",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const requiresSyncedLogs =
    pathname === "/" ||
    pathname.startsWith("/track") ||
    pathname.startsWith("/food") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/patterns") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/menu") ||
    pathname.startsWith("/archive");

  return (
    <div className="relative min-h-screen">
      <Authenticated>
        <ProfileProvider>
          <GlobalHeader />
          <main className="relative z-10 mx-auto w-full max-w-440 px-4 py-4 pb-20">
            {requiresSyncedLogs ? (
              <SyncedLogsProvider>
                <Outlet />
              </SyncedLogsProvider>
            ) : (
              <Outlet />
            )}
          </main>
          <BottomTabBar />
        </ProfileProvider>
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
          <p className="text-sm text-(--text-muted)">Sign in to access the app</p>
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
