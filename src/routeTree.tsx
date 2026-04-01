import { SignInButton, UserButton } from "@clerk/clerk-react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { LayoutDashboard, NotebookPen, Settings } from "lucide-react";
import React, { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import ModeToggle from "@/components/mode-toggle";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiKeyProvider } from "@/contexts/ApiKeyContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SyncedLogsProvider } from "@/contexts/SyncedLogsContext";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";
import TrackPage from "./pages/Track";

const PatternsPage = lazy(() => import("./pages/Patterns"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const UiMigrationLabPage = lazy(() => import("./pages/UiMigrationLab"));
const ArchivePage = lazy(() => import("./pages/secondary_pages/Archive"));
const MenuPage = lazy(() => import("./pages/secondary_pages/Menu"));

const NAV_ITEMS = [
  {
    to: "/",
    label: "Track",
    icon: NotebookPen,
    activeTone: "text-teal-600 dark:text-teal-400",
    activeGlow: "from-teal-500/60 to-teal-400/0",
    activeBorder: "border-b-teal-500 dark:border-b-teal-400",
  },
  {
    to: "/patterns",
    label: "Patterns",
    icon: LayoutDashboard,
    activeTone: "text-rose-600 dark:text-rose-400",
    activeGlow: "from-rose-500/60 to-rose-400/0",
    activeBorder: "border-b-rose-500 dark:border-b-rose-400",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    activeTone: "text-violet-600 dark:text-violet-400",
    activeGlow: "from-violet-500/60 to-violet-400/0",
    activeBorder: "border-b-violet-500 dark:border-b-violet-400",
  },
] as const;

const AUTH_LOADING_TIMEOUT_MS = 8000;

interface ErrorBoundaryProps {
  children: ReactNode;
  label: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Route render error:", error);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto my-8 max-w-xl rounded-2xl border border-(--red)/40 bg-(--surface-1) p-5">
        <h2 className="text-base font-bold text-(--text)">{this.props.label} crashed</h2>
        <p className="mt-1 text-sm text-(--text-muted)">
          The page hit an unexpected error. You can retry without losing the rest of the app.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-(--surface-0) px-3 py-1.5 text-xs font-semibold text-(--text)"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-(--text-muted)"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

function withBoundary(label: string, node: ReactNode) {
  return <RouteErrorBoundary label={label}>{node}</RouteErrorBoundary>;
}

function AuthLoadingFallback() {
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

function GlobalHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[rgba(12,20,32,0.7)]">
      <div className="mx-auto w-full max-w-440 px-4 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          {/* Logo area */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/" className="flex items-center gap-2.5">
                <img
                  src="/icons/icon-72x72.png"
                  alt="PDH"
                  width={64}
                  height={64}
                  className="h-16 w-16 drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]"
                />
                <div className="hidden lg:block">
                  <p className="bg-linear-to-r from-(--teal) to-(--section-food) bg-clip-text font-display text-lg font-extrabold tracking-tight text-transparent">
                    PDH
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-widest text-(--text-faint)">
                    Anastomosis Food Re-Integration Tracker
                  </p>
                </div>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className={pathname === "/" ? "" : "hidden"}>
              Home
            </TooltipContent>
          </Tooltip>

          {/* Navigation */}
          <div className="flex justify-center">
            <NavigationMenu viewport={false} className="max-w-none">
              <NavigationMenuList className="gap-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

                  return (
                    <NavigationMenuItem key={item.to}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <NavigationMenuLink
                            asChild
                            active={isActive}
                            className={cn(
                              "group relative inline-flex h-10 w-auto flex-row items-center gap-2 border-b-2 border-transparent px-4 py-2 font-semibold tracking-wide transition-all duration-200",
                              isActive
                                ? cn("text-(--text)", item.activeBorder)
                                : "text-(--text-muted) hover:-translate-y-px hover:text-(--text)",
                            )}
                          >
                            <Link to={item.to} aria-label={item.label}>
                              <Icon
                                className={cn(
                                  "h-4 w-4 transition-colors",
                                  isActive ? item.activeTone : "group-hover:text-(--text)",
                                )}
                                aria-hidden="true"
                              />
                              <span className="hidden md:inline" aria-hidden="true">
                                {item.label}
                              </span>
                              {/* Active gradient glow underneath */}
                              {isActive && (
                                <span
                                  className={cn(
                                    "absolute bottom-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-linear-to-r opacity-60",
                                    item.activeGlow,
                                  )}
                                  aria-hidden="true"
                                />
                              )}
                            </Link>
                          </NavigationMenuLink>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="md:hidden">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </NavigationMenuItem>
                  );
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="rounded-lg transition-colors hover:bg-white/6">
              <ModeToggle />
            </div>
            <UserButton />
          </div>
        </div>
      </div>

      {/* Gradient separator at the bottom of the header */}
      <div
        className="h-px w-full opacity-40"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--teal), var(--orange), var(--teal), transparent)",
        }}
        aria-hidden="true"
      />
    </header>
  );
}

function AppLayout() {
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

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-center" duration={4000} richColors expand visibleToasts={5} />
    </>
  ),
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppLayout,
  // No beforeLoad redirect — unauthenticated users see the sign-in prompt via AppLayout.
});

const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: () => withBoundary("Track", <TrackPage />),
});

const patternsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/patterns",
  component: () =>
    withBoundary(
      "Patterns",
      <Suspense fallback={null}>
        <PatternsPage />
      </Suspense>,
    ),
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: () =>
    withBoundary(
      "Settings",
      <Suspense fallback={null}>
        <SettingsPage />
      </Suspense>,
    ),
});

const archiveRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/archive",
  component: () =>
    withBoundary(
      "Archive",
      <Suspense fallback={null}>
        <ArchivePage />
      </Suspense>,
    ),
});

const menuRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/menu",
  component: () =>
    withBoundary(
      "Menu",
      <Suspense fallback={null}>
        <MenuPage />
      </Suspense>,
    ),
});

const devOnlyRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => appLayoutRoute,
        path: "/ui-migration-lab",
        component: () =>
          withBoundary(
            "UI Migration Lab",
            <Suspense fallback={null}>
              <UiMigrationLabPage />
            </Suspense>,
          ),
      }),
    ]
  : [];

export const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    indexRoute,
    patternsRoute,
    settingsRoute,
    archiveRoute,
    menuRoute,
    ...devOnlyRoutes,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
