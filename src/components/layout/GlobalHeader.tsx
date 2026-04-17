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
    tone: "text-teal-500 dark:text-teal-400",
    activeBg: "bg-teal-400",
  },
  {
    to: "/track",
    label: "Track",
    icon: NotebookPen,
    tone: "text-sky-500 dark:text-sky-400",
    activeBg: "bg-sky-400",
  },
  {
    to: "/food",
    label: "Food",
    icon: UtensilsCrossed,
    tone: "text-orange-500 dark:text-orange-400",
    activeBg: "bg-orange-400",
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
    tone: "text-rose-500 dark:text-rose-400",
    activeBg: "bg-rose-400",
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
              src="/favicon_light_transparent.png"
              alt="PDH"
              width={40}
              height={40}
              className="h-10 w-10 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)] dark:hidden"
            />
            <img
              src="/favicon_dark_transparent.png"
              alt=""
              width={40}
              height={40}
              aria-hidden="true"
              className="hidden h-10 w-10 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)] dark:block"
            />
            <span className="hidden font-sketch text-base font-bold tracking-tight text-teal-400 sm:block">
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
                      item.tone,
                    )}
                  >
                    <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <span className="text-[11px] font-semibold">
                      {item.label}
                    </span>
                    {/* Active underline — thick tapered pill (inverted top-border style) */}
                    {isActive && (
                      <span
                        className={cn(
                          "absolute inset-x-2 -bottom-[calc(0.5rem+1px)] h-[3px] rounded-full",
                          item.activeBg,
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
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to="/settings"
              aria-label="Settings"
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:text-[var(--text-muted)]",
                settingsActive ? SETTINGS_ACTIVE : SETTINGS_INACTIVE,
              )}
            >
              <Settings className="h-6 w-6" aria-hidden="true" />
            </Link>
            <ModeToggle />
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-9 w-9",
                  userButtonTrigger:
                    "focus:shadow-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/45",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
