import { UserButton } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, NotebookPen, Settings } from "lucide-react";
import ModeToggle from "@/components/mode-toggle";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

export function GlobalHeader() {
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
