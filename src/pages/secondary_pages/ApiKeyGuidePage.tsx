import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle, ExternalLink } from "lucide-react";

const STEPS = [
  {
    number: 1,
    title: "Create an OpenAI Developer Account",
    description:
      "Go to platform.openai.com and sign up for a developer account. If you already have a ChatGPT account, you can use those same credentials — but developer access is a separate dashboard.",
    link: "https://platform.openai.com/signup",
    linkLabel: "Go to OpenAI Platform",
  },
  {
    number: 2,
    title: "Set Up Billing",
    description:
      "Once logged in, navigate to Settings → Billing in the left sidebar. Add a payment method. OpenAI charges based on usage — costs vary depending on whether you use GPT-5 mini or GPT-5.2. You can set a monthly spending limit for peace of mind.",
    link: "https://platform.openai.com/settings/organization/billing/overview",
    linkLabel: "Open Billing Settings",
  },
  {
    number: 3,
    title: "Create an API Key",
    description:
      'In the left sidebar, go to API Keys. Click "Create new secret key". Give it a name like "Caca Traca" so you remember what it\'s for. Important: Copy the key immediately — OpenAI only shows it once.',
    link: "https://platform.openai.com/api-keys",
    linkLabel: "Go to API Keys",
  },
  {
    number: 4,
    title: "Paste It Into Caca Traca",
    description:
      "Open Caca Traca, go to Settings, and paste your API key into the OpenAI API Key field. That's it — Dr. Poo and all AI features will start working immediately.",
  },
] satisfies ReadonlyArray<{
  number: number;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
}>;

const TIPS = [
  "Your API key is stored securely on our servers using AES-256-GCM encryption. It is only used to make AI requests on your behalf and is never shared with third parties.",
  "GPT-5 mini costs $0.25 per million input tokens and $2 per million output tokens — a typical Dr. Poo report costs around 1-2 cents. For most users, that's under $5/month.",
  "GPT-5.2 delivers deeper analysis at $1.75/$14 per million tokens. Expect roughly 10-12 cents per report. If you have a complex recovery, the extra insight is worth it.",
  "You can switch between GPT-5 mini and GPT-5.2 in settings at any time — no need to get a new API key.",
  "You can revoke or regenerate your key at any time from the OpenAI dashboard.",
  "If anything goes wrong, the founder is available to walk you through it personally.",
];

export default function ApiKeyGuidePage() {
  return (
    <div
      data-theme="dark"
      className="min-h-dvh scroll-smooth text-[rgba(240,248,255,0.95)]"
      style={{
        background: `
          radial-gradient(ellipse 120% 80% at 20% 30%, #09182d, transparent 70%),
          radial-gradient(ellipse 100% 100% at 80% 70%, #09182d, transparent 60%),
          #04091b
        `,
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
        {/* Back link */}
        <Link
          to="/home"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[#FFC700]/70 transition-colors hover:text-[#FFC700]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to landing page
        </Link>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#FFC700]">
            Tutorial
          </p>
          <h1 className="mb-3 font-display text-3xl font-extrabold text-[var(--text)] md:text-4xl">
            How to Get Your OpenAI API Key
          </h1>
          <p className="text-base leading-relaxed text-[var(--text-muted)]">
            It takes about 5 minutes. Follow these four steps and you'll have Dr. Poo up and
            running.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-[#FFC700]/15 bg-[#FFC700]/[0.03] p-5 md:p-6"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFC700] text-sm font-bold text-[#04091b]">
                  {step.number}
                </div>
                <h2 className="font-display text-lg font-bold text-[#FFC700]">{step.title}</h2>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-[var(--text-muted)]">
                {step.description}
              </p>
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FFC700] transition-colors hover:text-[#ffe066]"
                >
                  {step.linkLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="mt-10 rounded-xl border border-[#FFC700]/10 bg-[#FFC700]/[0.02] p-5 md:p-6">
          <h3 className="mb-4 font-display text-base font-bold text-[#FFC700]">Good to Know</h3>
          <ul className="space-y-3">
            {TIPS.map((tip) => (
              <li key={tip} className="flex items-start gap-2.5">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC700]/70" />
                <span className="text-sm leading-relaxed text-[var(--text-muted)]">{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Need help? Get in touch and we'll walk you through it.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="rounded-lg bg-[#FFC700] px-6 py-3 font-semibold text-[#04091b] transition-all hover:bg-[#ffe066]"
            >
              Open Caca Traca
            </Link>
            <Link
              to="/home"
              className="rounded-lg border-2 border-[#FFC700]/40 px-6 py-3 font-semibold text-[#FFC700] transition-all hover:border-[#FFC700] hover:bg-[#FFC700] hover:text-[#04091b]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
