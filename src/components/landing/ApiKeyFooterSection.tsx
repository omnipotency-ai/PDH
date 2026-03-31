import { Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, KeyRound } from "lucide-react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { SectionShell } from "@/components/landing/SectionShell";
import { CHAKRA } from "@/lib/chakraColors";

export function ApiKeyFooterSection() {
  return (
    <SectionShell id="api-key" accent={CHAKRA.solar}>
      <div className="mb-4 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#FFC700]">
          Powered by ChatGPT
        </p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)] md:text-3xl">
          Bring Your Own API Key
        </h2>
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[#FFC700]/15 bg-[#FFC700]/[0.03] p-6 md:p-8">
          <p className="mb-5 text-center text-sm leading-relaxed text-[var(--text-muted)]">
            AI features like food parsing and Dr. Poo analysis use your own OpenAI API key. You're
            charged separately by OpenAI based on usage.
          </p>

          <ul className="mb-5 space-y-3">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC700]" />
              <span className="text-sm text-[var(--text-muted)]">
                You control the API key — add, change, or remove it at any time
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC700]" />
              <span className="text-sm text-[var(--text-muted)]">
                Pay OpenAI directly for only what you use — no markup from us
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC700]" />
              <span className="text-sm text-[var(--text-muted)]">
                Your data stays private — AI requests are processed securely through our servers and
                sent to OpenAI using your key
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFC700]" />
              <span className="text-sm text-[var(--text-muted)]">
                Choose from GPT-5 mini or GPT 5.2 in settings to decide the level of expert helping
                you through your recovery
              </span>
            </li>
          </ul>

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://developers.openai.com/docs/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#FFC700] px-5 py-2.5 text-sm font-semibold text-[#FFC700] transition-all hover:bg-[#FFC700] hover:text-[#04091b]"
            >
              <KeyRound className="h-4 w-4" />
              Get Your OpenAI API Key
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              to="/api-key-guide"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFC700]/10 px-5 py-2.5 text-sm font-semibold text-[#FFC700] transition-all hover:bg-[#FFC700]/20"
            >
              <BookOpen className="h-4 w-4" />
              Step-by-Step Tutorial
            </Link>
          </div>
        </div>
      </div>

      <LandingFooter embedded />
    </SectionShell>
  );
}
