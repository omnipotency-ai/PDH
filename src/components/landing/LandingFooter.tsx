import { Link } from "@tanstack/react-router";
import { ChakraBar } from "@/components/landing/ChakraBar";
import { cn } from "@/lib/utils";

interface LandingFooterProps {
  /** Embedded mode removes wrapper styling for use inside SectionShell */
  embedded?: boolean;
}

export function LandingFooter({ embedded = false }: LandingFooterProps) {
  const year = new Date().getFullYear();

  const content = (
    <>
      <ChakraBar />
      <div
        className={cn(
          "flex flex-col items-center text-center",
          embedded ? "gap-3 pt-1" : "mx-auto max-w-6xl gap-6 px-4 py-12 md:px-6",
        )}
      >
        <p className={cn("text-sm font-medium text-[var(--text-muted)]", embedded && "pt-8")}>
          Built by{" "}
          <span className="bg-gradient-to-r from-[#2dd4bf] to-[#a78bfa] bg-clip-text font-bold text-transparent">
            Omnipotency AI
          </span>
        </p>

        <nav
          className={cn("flex", embedded ? "flex-col gap-2" : "gap-6")}
          aria-label="Footer links"
        >
          <Link
            to="/terms"
            className="text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            Privacy
          </Link>
          <Link
            to="/"
            className="text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
          >
            Launch App
          </Link>
        </nav>

        <p className="text-xs text-[var(--text-faint)]">{year} Caca Traca. All rights reserved.</p>
      </div>
    </>
  );

  if (embedded) {
    return <div className="mt-auto pt-10">{content}</div>;
  }

  return <footer className="relative mt-20">{content}</footer>;
}
