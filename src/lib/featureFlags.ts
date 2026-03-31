/**
 * Feature flags for gating work-in-progress features.
 *
 * Each flag is a simple boolean constant. When a feature is ready for
 * production, flip the flag to `true` and eventually remove the gate.
 *
 * Usage:
 *   import { FEATURE_FLAGS } from "@/lib/featureFlags";
 *   if (FEATURE_FLAGS.someFlag) { ... }
 */
export const FEATURE_FLAGS = {
  /** UI Migration Lab — dev-only route for testing component variants. */
  UI_MIGRATION_LAB: import.meta.env.DEV,
} as const;
