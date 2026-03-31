import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { sanitizeOptionalText, sanitizeRequiredText } from "./lib/inputSafety";

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO: Add rate limiting per IP or email to prevent abuse.
// Convex does not expose client IP natively, so this would require
// an HTTP action wrapper or a per-email cooldown check.

export const join = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    surgeryType: v.optional(v.string()),
    recoveryStage: v.optional(v.string()),
    gdprConsent: v.boolean(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const name = sanitizeRequiredText(args.name, "Waitlist name", 80, {
      preserveNewlines: false,
    });
    const email = sanitizeRequiredText(args.email, "Waitlist email", 254, {
      preserveNewlines: false,
    });

    if (!EMAIL_FORMAT_REGEX.test(email)) {
      throw new Error("Invalid email address format.");
    }

    const surgeryType =
      sanitizeOptionalText(args.surgeryType, "Surgery type", 120, {
        preserveNewlines: false,
      }) ?? undefined;
    const recoveryStage =
      sanitizeOptionalText(args.recoveryStage, "Recovery stage", 120, {
        preserveNewlines: false,
      }) ?? undefined;

    if (!args.gdprConsent) {
      throw new Error("GDPR consent is required to join the waitlist.");
    }

    const now = args.now ?? Date.now();

    // Upsert by email — update existing entry if found
    const existing = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        ...(surgeryType !== undefined && {
          surgeryType,
        }),
        ...(recoveryStage !== undefined && {
          recoveryStage,
        }),
        gdprConsent: args.gdprConsent,
        subscribedAt: now,
        unsubscribedAt: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("waitlistEntries", {
      name,
      email,
      ...(surgeryType !== undefined && {
        surgeryType,
      }),
      ...(recoveryStage !== undefined && {
        recoveryStage,
      }),
      gdprConsent: args.gdprConsent,
      subscribedAt: now,
    });
  },
});

export const unsubscribe = mutation({
  args: { email: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const email = sanitizeRequiredText(args.email, "Waitlist email", 254, {
      preserveNewlines: false,
    });

    if (!EMAIL_FORMAT_REGEX.test(email)) {
      throw new Error("Invalid email address format.");
    }

    const entry = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (entry) {
      const now = args.now ?? Date.now();
      await ctx.db.patch(entry._id, { unsubscribedAt: now });
    }
  },
});
