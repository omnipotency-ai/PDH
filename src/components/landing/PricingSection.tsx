import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { PricingCard } from "@/components/landing/PricingCard";
import { SectionShell } from "@/components/landing/SectionShell";
import { CHAKRA } from "@/lib/chakraColors";
import { getErrorMessage } from "@/lib/errors";
import { api } from "../../../convex/_generated/api";

const MONTHLY_FEATURES = [
  "Unlimited food and digestion logging",
  "AI services like Dr. Poo & photo parsing require your own OpenAI API key *",
  "Cloud storage across devices",
  "7-day free trial",
];

const LIFETIME_FEATURES = [
  "Everything in Monthly",
  "One-time payment, forever access",
  "7-day money-back guarantee",
];

export function PricingSection() {
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "lifetime" | null>(null);

  async function handleCheckout(mode: "subscription" | "payment") {
    const plan = mode === "subscription" ? "monthly" : "lifetime";
    setLoadingPlan(plan);
    try {
      const priceId =
        mode === "subscription"
          ? (import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID ?? "")
          : (import.meta.env.VITE_STRIPE_LIFETIME_PRICE_ID ?? "");

      if (!priceId) {
        toast.error("Payments are not configured yet. Check back soon!");
        return;
      }

      const url = await createCheckout({
        priceId,
        mode,
        successUrl: `${window.location.origin}/home?checkout=success`,
        cancelUrl: `${window.location.origin}/home?checkout=cancel`,
      });
      if (url) window.location.href = url;
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <SectionShell id="pricing" accent={CHAKRA.sacral}>
      <div className="mb-0 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#f97316]">
          Early Access Pricing
        </p>
        <h2 className="font-display text-2xl font-extrabold text-[var(--text)] md:text-4xl">
          Simple, Transparent Pricing
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-muted)]">
          Beta pricing — lock in these rates before launch.
        </p>
      </div>

      <div className="mt-10 mx-auto grid max-w-3xl gap-8 md:grid-cols-2">
        <PricingCard
          title="Monthly"
          price="$9"
          period="month"
          subtitle="Cancel anytime"
          features={MONTHLY_FEATURES}
          ctaLabel="Start Free Trial"
          onCtaClick={() => handleCheckout("subscription")}
          loading={loadingPlan === "monthly"}
        />
        <PricingCard
          title="Lifetime"
          price="$79"
          badge="Most Popular"
          subtitle="Pay once, own forever"
          features={LIFETIME_FEATURES}
          recommended
          ctaLabel="Get Lifetime Access"
          onCtaClick={() => handleCheckout("payment")}
          loading={loadingPlan === "lifetime"}
        />
      </div>

      <p className="mt-2 text-center text-xs text-[var(--text-faint)]">
        * OpenAI API key required for AI features. Billed separately by OpenAI based on usage.
      </p>
    </SectionShell>
  );
}
