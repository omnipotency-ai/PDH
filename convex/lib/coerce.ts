type TrimmedStringOptions = {
  normalizeWhitespace?: boolean;
};

type NumberOptions = {
  coerceString?: boolean;
};

type StringArrayOptions = {
  normalizeWhitespace?: boolean;
  dedupe?: boolean;
  maxItems?: number;
};

export function asTrimmedString(
  value: unknown,
  options: TrimmedStringOptions = {},
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = options.normalizeWhitespace
    ? value.trim().replace(/\s+/g, " ")
    : value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function asNumber(
  value: unknown,
  options: NumberOptions = {},
): number | undefined {
  const numeric =
    options.coerceString && typeof value !== "number" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric)
    ? numeric
    : undefined;
}

export function asStringArray(
  value: unknown,
  options: StringArrayOptions = {},
): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const row of value) {
    const normalized = asTrimmedString(row, {
      ...(options.normalizeWhitespace !== undefined && {
        normalizeWhitespace: options.normalizeWhitespace,
      }),
    });
    if (!normalized) continue;
    if (options.dedupe && seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (
      options.maxItems !== undefined &&
      out.length >= options.maxItems
    ) {
      break;
    }
  }

  return out;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function slugifyName(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "custom";
}

export function inferHabitTypeFromName(name: string): string {
  const key = name.toLowerCase().trim().replace(/\s+/g, "_");
  if (/sleep|nap/.test(key)) return "sleep";
  if (/walk|movement|steps|run|yoga|stretch|breath|swim|workout/.test(key)) {
    return "activity";
  }
  if (/water|hydrat|tea|coffee|electrolyte|juice/.test(key)) return "fluid";
  if (/cig|smok|nicotine|alcohol|beer|wine|spirit|sweet|candy|drug/.test(key)) {
    return "destructive";
  }
  if (/med|pill|tablet|medicine|dressing|wound/.test(key)) return "checkbox";
  if (/weight|weigh/.test(key)) return "weight";
  return "count";
}
