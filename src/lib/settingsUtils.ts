import type { UsageFrequencyChoice } from "@/types/domain";

/**
 * Options for usage frequency dropdowns in settings forms.
 */
export const USAGE_FREQUENCY_OPTIONS: Array<{
  value: UsageFrequencyChoice;
  label: string;
}> = [
  { value: "", label: "Select frequency" },
  { value: "more_than_once_per_day", label: "More than once per day" },
  { value: "daily", label: "Once a day" },
  { value: "a_few_times_per_week", label: "A few times per week" },
  { value: "about_once_per_week", label: "About once per week" },
  { value: "a_few_times_per_month", label: "A few times per month" },
  { value: "about_once_per_month", label: "About once per month" },
  { value: "a_few_times_per_year", label: "A few times per year" },
  { value: "about_once_per_year_or_less", label: "About once per year or less" },
];

export const VALID_USAGE_FREQUENCIES = new Set([
  "more_than_once_per_day",
  "daily",
  "a_few_times_per_week",
  "about_once_per_week",
  "a_few_times_per_month",
  "about_once_per_month",
  "a_few_times_per_year",
  "about_once_per_year_or_less",
]);

/** Type guard: checks whether a value is a valid UsageFrequencyChoice (non-empty). */
function isUsageFrequency(value: unknown): value is UsageFrequencyChoice {
  return typeof value === "string" && VALID_USAGE_FREQUENCIES.has(value);
}

/**
 * Normalizes an unknown value to a valid UsageFrequencyChoice.
 * Returns empty string if the value is not a valid frequency.
 */
export function normalizeFrequency(value: unknown): UsageFrequencyChoice {
  return isUsageFrequency(value) ? value : "";
}
