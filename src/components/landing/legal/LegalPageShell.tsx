import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChakraBar } from "@/components/landing/ChakraBar";

interface LegalPageShellProps {
  title: string;
  children: ReactNode;
}

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <div
      data-slot="legal-page-shell"
      data-theme="dark"
      className="min-h-screen bg-[#080c14] text-[rgba(240,248,255,0.95)]"
    >
      <ChakraBar />
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <Link
          to="/home"
          className="mb-8 inline-block text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--teal)]"
        >
          Back to Home
        </Link>

        <h1 className="mb-8 font-display text-4xl font-extrabold text-[var(--text)]">{title}</h1>

        <div className="prose-landing space-y-6 text-sm leading-relaxed text-[var(--text-muted)]">
          {children}
        </div>
      </div>
    </div>
  );
}
