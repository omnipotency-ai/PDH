/**
 * Feature flags for gating work-in-progress features.
 *
 * Each flag is a simple boolean constant. When a feature is ready for
 * production, flip the flag to `true` and eventually remove the gate.
 *
 * Usage:
 *   import { FEATURE_FLAGS } from "@/lib/featureFlags";
 *   if (FEATURE_FLAGS.reproductiveHealth) { ... }
 */
export const FEATURE_FLAGS = {
  /**
   * When `true`, reproductive health UI (settings toggle, track panel,
   * today-log grouping, AI context) is visible and functional.
   * When `false`, all reproductive health surfaces are hidden.
   *
   * v1: Gated. Future requirements for v2:
   * - Conditional validation: male users cannot enable pregnancy tracking
   * - Pregnancy and menstruation are mutually exclusive states
   * - Menopause and active menstruation are mutually exclusive
   * - See ADR-0008 for scope decision rationale
   */
  reproductiveHealth: false,
} as const;
