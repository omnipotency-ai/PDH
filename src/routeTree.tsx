import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppLayout, withBoundary } from "@/components/layout";
import { Toaster } from "@/components/ui/sonner";

const TrackPage = lazy(() => import("./pages/Track"));
const PatternsPage = lazy(() => import("./pages/Patterns"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const UiMigrationLabPage = lazy(() => import("./pages/UiMigrationLab"));
const ArchivePage = lazy(() => import("./pages/secondary_pages/Archive"));
const MenuPage = lazy(() => import("./pages/secondary_pages/Menu"));

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
  component: () =>
    withBoundary(
      "Track",
      <Suspense fallback={null}>
        <TrackPage />
      </Suspense>,
    ),
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
