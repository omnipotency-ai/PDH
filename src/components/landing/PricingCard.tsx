import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  title: string;
  price: string;
  period?: string;
  badge?: string;
  subtitle: string;
  features: string[];
  recommended?: boolean;
  ctaLabel: string;
  onCtaClick: () => void;
  loading?: boolean;
}

export function PricingCard({
  title,
  price,
  period,
  badge,
  subtitle,
  features,
  recommended = false,
  ctaLabel,
  onCtaClick,
  loading = false,
}: PricingCardProps) {
  /* Scope CSS vars to coral so base-component styles don't bleed teal */
  const coralVars = {
    "--input": "rgba(255, 124, 100, 0.22)",
    "--ring": "#ff7c64",
    "--border": "rgba(255, 124, 100, 0.18)",
    "--primary": "#ff7c64",
    "--primary-foreground": "#080c14",
    "--color-accent-teal": "#ff7c64",
    "--color-border-strong": "rgba(255, 124, 100, 0.35)",
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "glass-card relative flex flex-col p-4 transition-all duration-300 md:p-8",
        recommended
          ? "glass-card-pricing-recommended hover:translate-y-[-4px]"
          : "border-[rgba(255,124,100,0.12)] hover:border-[rgba(255,124,100,0.25)]",
      )}
      style={coralVars}
    >
      {/* Coral gradient top accent for recommended */}
      {recommended && (
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #ff7c64, #f97316, #ff7c64, transparent)",
          }}
          aria-hidden="true"
        />
      )}

      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#ff7c64]/30 bg-[#0c1420] px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff7c64] shadow-[0_0_12px_rgba(255,124,100,0.15)]">
          {badge}
        </div>
      )}

      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3
            className={cn(
              "font-display text-lg font-bold uppercase tracking-wide",
              recommended ? "text-[#ff7c64]" : "text-[var(--text)]",
            )}
          >
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">{subtitle}</p>
        </div>
        <div className="text-right">
          <span className="font-display text-4xl font-extrabold text-[var(--text)]">{price}</span>
          {period && <span className="ml-1 text-sm text-[var(--text-muted)]">/{period}</span>}
        </div>
      </div>

      {/* Coral separator line */}
      <div
        className="mb-3 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, #ff7c64, transparent)",
        }}
      />

      {/* Features */}
      <ul className="mb-4 flex-1 space-y-1.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                recommended ? "text-[#ff7c64]" : "text-[#ff7c64]/70",
              )}
            />
            <span className="text-sm leading-relaxed text-[var(--text-muted)]">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <button
        type="button"
        onClick={onCtaClick}
        disabled={loading}
        className={cn(
          "w-full rounded-lg py-2 font-semibold transition-all disabled:opacity-50",
          recommended
            ? "bg-gradient-to-r from-[#ff7c64] to-[#f97316] text-[#080c14] hover:shadow-[0_0_24px_rgba(255,124,100,0.3)] hover:brightness-110"
            : "border-2 border-[#ff7c64] text-[#ff7c64] hover:bg-[#ff7c64] hover:text-[#080c14]",
        )}
      >
        {loading ? "Redirecting..." : ctaLabel}
      </button>
    </div>
  );
}
