/**
 * Input sanitization — shared core logic.
 *
 * This file MUST stay in sync with convex/lib/inputSafety.ts.
 * The Convex version is the superset (adds sanitizeRequiredText,
 * sanitizeOptionalText, sanitizeStringArray for server validation).
 * If you change core logic here, mirror the change there and vice-versa.
 */

// Matches non-printable control characters for stripping during sanitization.
// Built dynamically to avoid biome noControlCharactersInRegex on a regex literal.
const CONTROL_CHAR_RANGES = [
  "\\u0000-\\u0008", // NULL through BACKSPACE
  "\\u000B", // VERTICAL TAB
  "\\u000C", // FORM FEED
  "\\u000E-\\u001F", // SHIFT OUT through UNIT SEPARATOR
  "\\u007F", // DELETE
];
const CONTROL_CHARS_RE = new RegExp(`[${CONTROL_CHAR_RANGES.join("")}]`, "g");

export const INPUT_SAFETY_LIMITS = {
  conversationUserContent: 2500,
  conversationAssistantContent: 12000,
  searchKeyword: 120,
  aiPayloadString: 50000,
  genericStoredString: 5000,
} as const;

type SanitizeTextOptions = {
  trim?: boolean;
  preserveNewlines?: boolean;
};

type DeepSanitizeOptions = SanitizeTextOptions & {
  maxStringLength?: number;
  path?: string;
};

export function sanitizePlainText(value: string, options: SanitizeTextOptions = {}) {
  const { trim = true, preserveNewlines = true } = options;
  if (typeof value !== "string") {
    console.warn(`sanitizePlainText received non-string: ${typeof value}. Coercing to string.`);
  }
  let text = String(value);

  text = text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");

  if (!preserveNewlines) {
    text = text.replace(/\s+/g, " ");
  }

  return trim ? text.trim() : text;
}

export function sanitizeUnknownStringsDeep<T>(value: T, options: DeepSanitizeOptions = {}): T {
  const {
    maxStringLength = INPUT_SAFETY_LIMITS.genericStoredString,
    path = "value",
    ...textOptions
  } = options;

  const visit = (node: unknown, currentPath: string): unknown => {
    if (typeof node === "string") {
      const text = sanitizePlainText(node, textOptions);
      if (text.length > maxStringLength) {
        console.warn(
          `sanitizeUnknownStringsDeep: ${currentPath} is ${text.length} chars (max ${maxStringLength}); truncating.`,
        );
        return `${text.slice(0, maxStringLength)}...[truncated]`;
      }
      return text;
    }
    if (Array.isArray(node)) {
      return node.map((item, index) => visit(item, `${currentPath}[${index}]`));
    }
    if (node && typeof node === "object") {
      const entries = Object.entries(node);
      return Object.fromEntries(
        entries.map(([key, entryValue]) => [key, visit(entryValue, `${currentPath}.${key}`)]),
      );
    }
    return node;
  };

  return visit(value, path) as T;
}
