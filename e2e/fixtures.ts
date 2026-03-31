import { test as base } from "@playwright/test";

// Re-export expect for convenience
export { expect } from "@playwright/test";

// The storageState in the config already handles auth.
// This fixture file exists for future extension (e.g., adding
// page object models, custom helpers, multiple auth roles).
export const test = base;
