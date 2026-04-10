import { UserButton } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Home,
  NotebookPen,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import ModeToggle from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const SETTINGS_ACTIVE = "text-violet-400";
const SETTINGS_INACTIVE = "text-[var(--text-faint)]";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Home",
    icon: Home,
    activeTone: "text-teal-500 dark:text-teal-400",
    activeBorder: "border-teal-500 dark:border-teal-400",
  },
  {
    to: "/track",
    label: "Track",
    icon: NotebookPen,
    activeTone: "text-sky-500 dark:text-sky-400",
    activeBorder: "border-sky-500 dark:border-sky-400",
  },
  {
    to: "/food",
    label: "Food",
    icon: UtensilsCrossed,
    activeTone: "text-orange-500 dark:text-orange-400",
    activeBorder: "border-orange-500 dark:border-orange-400",
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
    activeTone: "text-rose-500 dark:text-rose-400",
    activeBorder: "border-rose-500 dark:border-rose-400",
  },
] as const;

export function GlobalHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsActive = pathname.startsWith("/settings");

  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[rgba(12,20,32,0.7)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-2">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="Peter's Digestive Health home"
          >
            <img
              src="/icons/icon-72x72.png"
              alt="PDH"
              width={32}
              height={32}
              className="h-8 w-8 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)]"
            />
            <span className="hidden font-display text-sm font-extrabold tracking-tight text-teal-400 sm:block">
              Peter's Digestive Health
            </span>
          </Link>

          {/* Nav — centre */}
          <nav
            aria-label="Main navigation"
            className="flex flex-1 items-center justify-center"
          >
            <div className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors",
                      isActive
                        ? item.activeTone
                        : "text-(--text-muted) hover:bg-white/6 hover:text-(--text)",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                    {/* Active underline */}
                    {isActive && (
                      <span
                        className={cn(
                          "absolute inset-x-1 -bottom-[calc(0.5rem+1px)] h-0.5 rounded-full",
                          item.activeBorder.replace("border-", "bg-"),
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right controls */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/settings"
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "rounded-lg p-1.5 transition-colors hover:bg-white/6",
                settingsActive ? SETTINGS_ACTIVE : SETTINGS_INACTIVE,
              )}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="rounded-lg transition-colors hover:bg-white/6">
              <ModeToggle />
            </div>
            <UserButton />
          </div>
        </div>
      </div>

      {/* Gradient separator */}
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
