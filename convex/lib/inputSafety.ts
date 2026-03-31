/**
 * Input sanitization — server version (superset of shared core).
 *
 * Core logic (CONTROL_CHARS_RE, INPUT_SAFETY_LIMITS, SanitizeTextOptions,
 * DeepSanitizeOptions, sanitizePlainText, sanitizeUnknownStringsDeep,
 * assertMaxLength) MUST stay in sync with src/lib/inputSafety.ts.
 *
 * This file adds server-only helpers: sanitizeRequiredText,
 * sanitizeOptionalText, sanitizeStringArray.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — sanitizes control characters from user input
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

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
  let text = String(value ?? "");

  // Normalize unicode forms and line endings, then strip non-printable control chars.
  text = text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");

  if (!preserveNewlines) {
    text = text.replace(/\s+/g, " ");
  }

  return trim ? text.trim() : text;
}

export function sanitizeRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  const text = sanitizePlainText(value, options);
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  assertMaxLength(text, fieldName, maxLength);
  return text;
}

export function sanitizeOptionalText(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  if (value === null || value === undefined) return value;
  const text = sanitizePlainText(value, options);
  if (!text) return "";
  assertMaxLength(text, fieldName, maxLength);
  return text;
}

export function sanitizeStringArray(
  values: string[] | undefined,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  if (!values) return values;
  return values.map((value, index) =>
    sanitizeRequiredText(value, `${fieldName}[${index}]`, maxLength, options),
  );
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
      assertMaxLength(text, currentPath, maxStringLength);
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

function assertMaxLength(value: string, fieldName: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} exceeds the maximum length of ${maxLength} characters.`);
  }
}
