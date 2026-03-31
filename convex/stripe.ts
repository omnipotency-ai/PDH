"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const createCheckoutSession = action({
  args: {
    priceId: v.string(),
    mode: v.union(v.literal("subscription"), v.literal("payment")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId: _userId } = await requireAuth(ctx);

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured in Convex environment variables.",
      );
    }
    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(stripeSecretKey)) {
      throw new Error(
        "STRIPE_SECRET_KEY has an invalid format. Expected a key starting with 'sk_test_' or 'sk_live_' followed by alphanumeric characters.",
      );
    }

    // Validate priceId against server-side allowlist
    const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
    const lifetimePriceId = process.env.STRIPE_LIFETIME_PRICE_ID;
    const validPriceIds = new Set<string>();
    if (monthlyPriceId) validPriceIds.add(monthlyPriceId);
    if (lifetimePriceId) validPriceIds.add(lifetimePriceId);

    if (validPriceIds.size === 0) {
      throw new Error("No valid price IDs configured in environment variables.");
    }
    if (!validPriceIds.has(args.priceId)) {
      throw new Error("Invalid price ID");
    }

    // Validate redirect URLs start with the app's origin
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      throw new Error("APP_URL is not configured in Convex environment variables.");
    }
    if (!args.successUrl.startsWith(appUrl)) {
      throw new Error("Invalid redirect URL");
    }
    if (!args.cancelUrl.startsWith(appUrl)) {
      throw new Error("Invalid redirect URL");
    }

    const body: Record<string, string> = {
      "line_items[0][price]": args.priceId,
      "line_items[0][quantity]": "1",
      mode: args.mode,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    };

    // Add 7-day trial for subscriptions
    if (args.mode === "subscription") {
      body["subscription_data[trial_period_days]"] = "7";
    }

    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(body).toString(),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Stripe API error:", response.status, errorBody);
      throw new Error("Payment processing failed. Please try again.");
    }

    const session = (await response.json()) as { url: string };
    return session.url;
  },
});
