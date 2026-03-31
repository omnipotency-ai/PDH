import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const scrollParent = nav?.closest("[data-theme]") as HTMLElement | null;
    const target = scrollParent ?? window;

    function onScroll() {
      const scrollTop = scrollParent?.scrollTop ?? window.scrollY;
      setScrolled(scrollTop > 80);
    }
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-[#e8e6e3]/[0.06] bg-[rgba(4,9,27,0.85)] backdrop-blur-xl backdrop-saturate-150"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1 md:px-6">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-0">
          <img
            src="/icons/icon-72x72.png"
            alt="Caca Traca"
            width={44}
            height={44}
            className="h-18 w-18 pt-[8px] drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]"
          />
          <div className="flex flex-col">
            <span className="bg-gradient-to-r from-[#2dd4bf] to-[#38bdf8] bg-clip-text font-display text-base font-extrabold tracking-tight text-transparent">
              Caca Traca
            </span>
            <span className="max-w-[140px] text-[9px] leading-tight font-semibold tracking-[0.08em] text-[#2dd4bf]/70 uppercase sm:max-w-none">
              Anastomosis Food Re-Integration Tracker
            </span>
          </div>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-sm font-medium text-[#2dd4bf]/70 transition-colors hover:text-[#2dd4bf]"
          >
            Launch App
          </Link>
          <a
            href="#pricing"
            className="rounded-lg border-2 border-[#2dd4bf] px-4 py-2 text-sm font-semibold text-[#2dd4bf] transition-all hover:bg-[#2dd4bf] hover:text-[#080c14]"
          >
            Be a Beta Tester
          </a>
        </div>
      </div>
    </nav>
  );
}
