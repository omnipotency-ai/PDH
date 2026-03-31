/**
 * Shared utility: resolveCanonicalFoodName
 *
 * Single canonical implementation of "resolve a food name to its canonical
 * form". Every call site in the codebase should import from here.
 *
 * This module exists separately from foodNormalize.ts because it depends on
 * both foodNormalize (normalizeFoodName) and foodCanonicalization
 * (canonicalizeKnownFoodName). Since foodCanonicalization already imports
 * from foodNormalize at module scope, adding the reverse import to
 * foodNormalize would create a circular dependency that breaks module
 * initialization.
 */

import { canonicalizeKnownFoodName } from "./foodCanonicalization";
import { normalizeFoodName } from "./foodNormalize";

/**
 * Resolve a food name to its canonical form: prefer the registry lookup,
 * fall back to rule-based normalization.
 */
export function resolveCanonicalFoodName(value: string): string {
  return canonicalizeKnownFoodName(value) ?? normalizeFoodName(value);
}
