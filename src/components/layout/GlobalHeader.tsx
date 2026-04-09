import { UserButton } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import ModeToggle from "@/components/mode-toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function GlobalHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150 dark:bg-[rgba(12,20,32,0.7)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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

          <div className="flex items-center justify-end gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/settings"
                  className="rounded-lg p-1.5 text-(--text-muted) transition-colors hover:bg-white/6 hover:text-(--text)"
                  aria-label="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
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
