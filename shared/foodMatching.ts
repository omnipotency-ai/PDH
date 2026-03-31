import Fuse, { type IFuseOptions } from "fuse.js";
import { parseLeadingQuantity } from "./foodParsing";
import {
  FOOD_REGISTRY,
  type FoodGroup,
  type FoodLine,
  type FoodRegistryEntry,
  type FoodZone,
} from "./foodRegistry";

export type FoodMatchResolver =
  | "alias"
  | "fuzzy"
  | "embedding"
  | "combined"
  | "llm"
  | "user";

export interface LearnedFoodAlias {
  aliasText: string;
  normalizedAlias: string;
  canonicalName: string;
  userId: string | null;
}

export interface PreprocessedFoodPhrase {
  rawPhrase: string;
  parsedName: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  quantityText: string | null;
}

export interface FoodSearchDocument {
  canonicalName: string;
  zone: FoodZone;
  group: FoodGroup;
  line: FoodLine;
  bucketKey: string;
  bucketLabel: string;
  examples: ReadonlyArray<string>;
  normalizedCanonicalName: string;
  normalizedExamples: ReadonlyArray<string>;
  normalizedAliases: ReadonlyArray<string>;
  notes?: string;
  embeddingText: string;
  embeddingSourceHash: string;
}

export interface FoodMatchCandidate {
  canonicalName: string;
  zone: FoodZone;
  group: FoodGroup;
  line: FoodLine;
  bucketKey: string;
  bucketLabel: string;
  resolver: Exclude<FoodMatchResolver, "user">;
  combinedConfidence: number;
  fuzzyScore: number | null;
  embeddingScore: number | null;
  examples: ReadonlyArray<string>;
}

export interface FoodMatchBucketOption {
  bucketKey: string;
  bucketLabel: string;
  canonicalOptions: ReadonlyArray<string>;
  bestConfidence: number;
}

export interface FoodMatcherContext {
  documents: ReadonlyArray<FoodSearchDocument>;
  fuse: Fuse<FoodSearchDocument>;
  exactAliasMap: ReadonlyMap<string, FoodSearchDocument>;
  documentMap: ReadonlyMap<string, FoodSearchDocument>;
}

export interface ConfidenceRoute {
  level: "high" | "medium" | "low";
  topCandidate: FoodMatchCandidate | null;
  candidates: ReadonlyArray<FoodMatchCandidate>;
  buckets: ReadonlyArray<FoodMatchBucketOption>;
}

const CONJUNCTION_SPLIT_PATTERN =
  /\s*(?:,|;|\/|&|\b(?:and|with|plus|y|con)\b)\s*/gi;

const PROTECTED_PHRASES = [
  "mac and cheese",
  "salt and vinegar",
  "peanut butter and jelly",
  "peanut butter and jam",
];
const MIN_FOOD_MATCH_CHARS = 3;

const DEFAULT_FUSE_OPTIONS: IFuseOptions<FoodSearchDocument> = {
  keys: [
    { name: "normalizedAliases", weight: 0.5 },
    { name: "normalizedCanonicalName", weight: 0.3 },
    { name: "normalizedExamples", weight: 0.2 },
  ],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: MIN_FOOD_MATCH_CHARS,
  shouldSort: true,
};

const LINE_BUCKET_LABELS: Record<FoodLine, string> = {
  meat_fish: "Gentle meat or fish",
  eggs_dairy: "Egg or dairy",
  vegetable_protein: "Soft plant protein",
  grains: "Bread, grain, or snack",
  vegetables: "Cooked or soft veg",
  fruit: "Soft fruit",
  oils: "Added fat",
  dairy_fats: "Cheese or dairy fat",
  nuts_seeds: "Fat or nut/seed food",
  sauces_condiments: "Sauce or condiment",
  herbs_spices: "Herb or spice",
};

const CANONICAL_BUCKET_LABELS: Array<{
  match: RegExp;
  label: string;
}> = [
  { match: /\bgrilled\b/, label: "Grilled meat or fish" },
  {
    match: /\bboiled\b|\bsteamed\b|\bpoached\b/,
    label: "Boiled or steamed food",
  },
  {
    match: /\bmashed\b|\bpureed\b|\bpurée\b|\bpuree\b/,
    label: "Puree or mash",
  },
  { match: /\bsoup\b|\bbroth\b/, label: "Soup or broth" },
  {
    match: /\bcracker\b|\bbreadstick\b|\bcrisp\b/,
    label: "Cracker or savoury snack",
  },
  {
    match: /\bbiscuit\b|\bcookie\b|\bcake\b|\bpudding\b|\bgelatin\b/,
    label: "Sweet snack",
  },
  { match: /\byogurt\b|\byoghurt\b|\bcheese\b|\bmilk\b/, label: "Dairy" },
];

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function stripFoodAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFoodMatchText(value: string): string {
  return stripFoodAccents(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function protectPhrases(raw: string): {
  protectedText: string;
  placeholders: Map<string, string>;
} {
  let protectedText = raw;
  const placeholders = new Map<string, string>();

  for (const phrase of PROTECTED_PHRASES) {
    const placeholder = `__food_match_${placeholders.size}__`;
    const pattern = new RegExp(phrase, "gi");
    if (!pattern.test(protectedText)) continue;
    protectedText = protectedText.replace(pattern, placeholder);
    placeholders.set(placeholder, phrase);
  }

  return { protectedText, placeholders };
}

function restoreProtectedPhrase(
  value: string,
  placeholders: ReadonlyMap<string, string>,
): string {
  let restored = value;
  for (const [placeholder, phrase] of placeholders) {
    restored = restored.replaceAll(placeholder, phrase);
  }
  return restored;
}

function sanitizeFoodPhrase(value: string): string {
  return value
    .replace(/^[\s.:;!?-]+/, "")
    .replace(/[\s.:;!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitMealIntoFoodPhrases(rawText: string): string[] {
  if (!rawText.trim()) return [];

  const { protectedText, placeholders } = protectPhrases(
    rawText.replace(/\n+/g, ", ").replace(/\s+/g, " ").trim(),
  );

  return protectedText
    .split(CONJUNCTION_SPLIT_PATTERN)
    .map((segment) => restoreProtectedPhrase(segment, placeholders))
    .map(sanitizeFoodPhrase)
    .filter((segment) => segment.length > 0);
}

function deriveQuantityText(
  rawPhrase: string,
  parsedName: string,
): string | null {
  const normalizedRaw = rawPhrase.trim().replace(/\s+/g, " ");
  if (!normalizedRaw || normalizedRaw === parsedName) return null;
  const rawIndex = normalizedRaw
    .toLowerCase()
    .lastIndexOf(parsedName.toLowerCase());
  if (rawIndex <= 0) return null;
  const quantityText = normalizedRaw.slice(0, rawIndex).trim();
  return quantityText.length > 0 ? quantityText : null;
}

export function preprocessMealText(rawText: string): PreprocessedFoodPhrase[] {
  return splitMealIntoFoodPhrases(rawText)
    .map((rawPhrase) => {
      const { parsedName, quantity, unit } = parseLeadingQuantity(rawPhrase);
      const safeParsedName = sanitizeFoodPhrase(parsedName || rawPhrase);
      // Guard against NaN/Infinity/negative from Number() parsing.
      // Null means "no quantity specified" which is a valid state.
      const safeQuantity =
        quantity !== null && Number.isFinite(quantity) && quantity > 0
          ? quantity
          : null;
      return {
        rawPhrase,
        parsedName: safeParsedName,
        normalizedName: normalizeFoodMatchText(safeParsedName),
        quantity: safeQuantity,
        unit: safeQuantity !== null ? unit : null,
        quantityText: deriveQuantityText(rawPhrase, safeParsedName),
      };
    })
    .filter((phrase) => phrase.normalizedName.length > 0);
}

function deriveBucketLabel(
  entry: Pick<FoodRegistryEntry, "canonical" | "line">,
): string {
  for (const rule of CANONICAL_BUCKET_LABELS) {
    if (rule.match.test(entry.canonical)) {
      return rule.label;
    }
  }
  return LINE_BUCKET_LABELS[entry.line];
}

function deriveBucketKey(
  entry: Pick<FoodRegistryEntry, "canonical" | "line">,
): string {
  const canonical = normalizeFoodMatchText(entry.canonical).replace(
    /\s+/g,
    "_",
  );
  if (canonical.includes("grilled")) return "grilled_protein";
  if (
    canonical.includes("boiled") ||
    canonical.includes("poached") ||
    canonical.includes("steamed")
  ) {
    return "boiled_or_steamed";
  }
  if (canonical.includes("soup") || canonical.includes("broth")) return "soups";
  if (canonical.includes("cracker") || canonical.includes("crisp"))
    return "crackers_and_snacks";
  if (
    canonical.includes("biscuit") ||
    canonical.includes("pudding") ||
    canonical.includes("gelatin")
  ) {
    return "sweet_snacks";
  }
  return `line_${entry.line}`;
}

function buildEmbeddingText(entry: FoodRegistryEntry): string {
  const macroProfile = entry.macros.join(", ") || "none";
  const exampleText = entry.examples.slice(0, 5).join(", ");
  return [
    `Food: ${entry.canonical}`,
    `Zone: ${entry.zone}`,
    `Group: ${entry.group}`,
    `Line: ${entry.line}`,
    `Macros: ${macroProfile}`,
    entry.notes ? `Notes: ${entry.notes}` : null,
    exampleText ? `Examples: ${exampleText}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(". ");
}

export function getFoodEmbeddingSourceHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildFoodSearchDocuments(
  aliases: ReadonlyArray<LearnedFoodAlias>,
): FoodSearchDocument[] {
  // TODO(review): the matcher currently projects from the legacy shared
  // transit-map registry so the rest of the app keeps working on this branch.
  // The richer Zone 1/2 schema from schema-food-zones.md should become the
  // matching corpus once downstream consumers are ready for the canonical rename.
  const aliasesByCanonical = new Map<string, string[]>();

  for (const alias of aliases) {
    const existing = aliasesByCanonical.get(alias.canonicalName) ?? [];
    existing.push(alias.aliasText);
    aliasesByCanonical.set(alias.canonicalName, existing);
  }

  return FOOD_REGISTRY.map((entry) => {
    const aliasTexts = aliasesByCanonical.get(entry.canonical) ?? [];
    const embeddingText = buildEmbeddingText(entry);
    return {
      canonicalName: entry.canonical,
      zone: entry.zone,
      group: entry.group,
      line: entry.line,
      bucketKey: deriveBucketKey(entry),
      bucketLabel: deriveBucketLabel(entry),
      examples: entry.examples,
      normalizedCanonicalName: normalizeFoodMatchText(entry.canonical),
      normalizedExamples: entry.examples.map(normalizeFoodMatchText),
      normalizedAliases: aliasTexts.map(normalizeFoodMatchText),
      ...(entry.notes ? { notes: entry.notes } : {}),
      embeddingText,
      embeddingSourceHash: getFoodEmbeddingSourceHash(embeddingText),
    };
  });
}

export function createFoodMatcherContext(
  aliases: ReadonlyArray<LearnedFoodAlias>,
): FoodMatcherContext {
  const documents = buildFoodSearchDocuments(aliases);
  const fuse = new Fuse(documents, DEFAULT_FUSE_OPTIONS);
  const exactAliasMap = new Map<string, FoodSearchDocument>();
  const documentMap = new Map<string, FoodSearchDocument>();

  for (const document of documents) {
    documentMap.set(document.canonicalName, document);

    exactAliasMap.set(document.normalizedCanonicalName, document);
    for (const normalizedExample of document.normalizedExamples) {
      exactAliasMap.set(normalizedExample, document);
    }
    for (const normalizedAlias of document.normalizedAliases) {
      exactAliasMap.set(normalizedAlias, document);
    }
  }

  // User-specific aliases are passed after global aliases and should win
  // over canonical/example exact matches for the same normalized phrase.
  for (const alias of aliases) {
    const document = documentMap.get(alias.canonicalName);
    if (!document) continue;
    exactAliasMap.set(alias.normalizedAlias, document);
  }

  return {
    documents,
    fuse,
    exactAliasMap,
    documentMap,
  };
}

function documentToCandidate(
  document: FoodSearchDocument,
  resolver: Exclude<FoodMatchResolver, "user">,
  fuzzyScore: number | null,
  embeddingScore: number | null,
  combinedConfidence: number,
): FoodMatchCandidate {
  return {
    canonicalName: document.canonicalName,
    zone: document.zone,
    group: document.group,
    line: document.line,
    bucketKey: document.bucketKey,
    bucketLabel: document.bucketLabel,
    resolver,
    fuzzyScore,
    embeddingScore,
    combinedConfidence: clampConfidence(combinedConfidence),
    examples: document.examples,
  };
}

export function findExactAliasCandidate(
  query: string,
  context: FoodMatcherContext,
): FoodMatchCandidate | null {
  const normalized = normalizeFoodMatchText(query);
  if (!normalized) return null;
  const document = context.exactAliasMap.get(normalized);
  if (!document) return null;
  return documentToCandidate(document, "alias", 1, null, 0.99);
}

export function fuzzySearchFoodCandidates(
  query: string,
  context: FoodMatcherContext,
  limit = 5,
): FoodMatchCandidate[] {
  const exact = findExactAliasCandidate(query, context);
  if (exact) return [exact];

  const normalized = normalizeFoodMatchText(query);
  if (!normalized) return [];

  const results = context.fuse.search(normalized, { limit });
  return results.map((result) => {
    const fuzzyScore = clampConfidence(1 - (result.score ?? 1));
    return documentToCandidate(
      result.item,
      "fuzzy",
      fuzzyScore,
      null,
      fuzzyScore,
    );
  });
}

function getTextSearchRank(
  document: FoodSearchDocument,
  normalizedQuery: string,
): number | null {
  if (!normalizedQuery) return null;

  const fields = [
    document.normalizedCanonicalName,
    ...document.normalizedAliases,
    ...document.normalizedExamples,
  ];

  if (fields.some((field) => field === normalizedQuery)) return 0;
  if (document.normalizedCanonicalName.startsWith(normalizedQuery)) return 1;
  if (
    document.normalizedAliases.some((field) =>
      field.startsWith(normalizedQuery),
    )
  ) {
    return 2;
  }
  if (
    document.normalizedExamples.some((field) =>
      field.startsWith(normalizedQuery),
    )
  ) {
    return 3;
  }
  if (document.normalizedCanonicalName.includes(normalizedQuery)) return 4;
  if (
    document.normalizedAliases.some((field) => field.includes(normalizedQuery))
  ) {
    return 5;
  }
  if (
    document.normalizedExamples.some((field) => field.includes(normalizedQuery))
  ) {
    return 6;
  }

  return null;
}

export function searchFoodDocuments(
  query: string,
  context: FoodMatcherContext,
  options?: {
    bucketKey?: string;
    limit?: number;
  },
): FoodSearchDocument[] {
  const limit = options?.limit ?? 50;
  const filteredDocuments =
    options?.bucketKey === undefined
      ? context.documents
      : context.documents.filter(
          (document) => document.bucketKey === options.bucketKey,
        );

  const normalizedQuery = normalizeFoodMatchText(query);
  if (!normalizedQuery) {
    return [...filteredDocuments]
      .sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      )
      .slice(0, limit);
  }

  const rankedTextMatches = filteredDocuments
    .map((document) => ({
      document,
      rank: getTextSearchRank(document, normalizedQuery),
    }))
    .filter(
      (
        match,
      ): match is {
        document: FoodSearchDocument;
        rank: number;
      } => match.rank !== null,
    )
    .sort((left, right) => {
      return (
        left.rank - right.rank ||
        left.document.canonicalName.localeCompare(right.document.canonicalName)
      );
    })
    .map((match) => match.document);

  if (normalizedQuery.length < MIN_FOOD_MATCH_CHARS) {
    return rankedTextMatches.slice(0, limit);
  }

  const fuse =
    filteredDocuments.length === context.documents.length
      ? context.fuse
      : new Fuse(filteredDocuments, DEFAULT_FUSE_OPTIONS);
  const fuzzyMatches = fuse
    .search(normalizedQuery, { limit })
    .map((result) => result.item);

  const mergedMatches = new Map<string, FoodSearchDocument>();
  for (const document of [...rankedTextMatches, ...fuzzyMatches]) {
    if (!mergedMatches.has(document.canonicalName)) {
      mergedMatches.set(document.canonicalName, document);
    }
  }

  return Array.from(mergedMatches.values()).slice(0, limit);
}

export function mergeFoodMatchCandidates(
  fuzzyCandidates: ReadonlyArray<FoodMatchCandidate>,
  embeddingCandidates: ReadonlyArray<{
    canonicalName: string;
    embeddingScore: number;
  }>,
  context: FoodMatcherContext,
): FoodMatchCandidate[] {
  const merged = new Map<string, FoodMatchCandidate>();

  for (const candidate of fuzzyCandidates) {
    merged.set(candidate.canonicalName, candidate);
  }

  for (const candidate of embeddingCandidates) {
    const existing = merged.get(candidate.canonicalName);
    if (existing) {
      // If the existing candidate is embedding-only (no fuzzy source),
      // overwrite it with the newer embedding score (last write wins).
      if (existing.resolver === "embedding") {
        merged.set(candidate.canonicalName, {
          ...existing,
          embeddingScore: candidate.embeddingScore,
          combinedConfidence: clampConfidence(candidate.embeddingScore),
        });
        continue;
      }

      const fuzzyScore = existing.fuzzyScore ?? 0;
      const combinedConfidence = clampConfidence(
        fuzzyScore * 0.65 + candidate.embeddingScore * 0.35,
      );
      merged.set(candidate.canonicalName, {
        ...existing,
        resolver: "combined",
        embeddingScore: candidate.embeddingScore,
        combinedConfidence,
      });
      continue;
    }

    const document = context.documentMap.get(candidate.canonicalName);
    if (!document) continue;
    merged.set(
      candidate.canonicalName,
      documentToCandidate(
        document,
        "embedding",
        null,
        candidate.embeddingScore,
        candidate.embeddingScore,
      ),
    );
  }

  return Array.from(merged.values()).sort((a, b) => {
    return (
      b.combinedConfidence - a.combinedConfidence ||
      (b.embeddingScore ?? -1) - (a.embeddingScore ?? -1) ||
      (b.fuzzyScore ?? -1) - (a.fuzzyScore ?? -1) ||
      a.canonicalName.localeCompare(b.canonicalName)
    );
  });
}

export function buildBucketOptions(
  candidates: ReadonlyArray<FoodMatchCandidate>,
  limit = 3,
): FoodMatchBucketOption[] {
  const buckets = new Map<string, FoodMatchBucketOption>();

  for (const candidate of candidates) {
    const existing = buckets.get(candidate.bucketKey);
    if (!existing) {
      buckets.set(candidate.bucketKey, {
        bucketKey: candidate.bucketKey,
        bucketLabel: candidate.bucketLabel,
        canonicalOptions: [candidate.canonicalName],
        bestConfidence: candidate.combinedConfidence,
      });
      continue;
    }

    const canonicalOptions = existing.canonicalOptions.includes(
      candidate.canonicalName,
    )
      ? existing.canonicalOptions
      : [...existing.canonicalOptions, candidate.canonicalName];

    buckets.set(candidate.bucketKey, {
      ...existing,
      canonicalOptions,
      bestConfidence: Math.max(
        existing.bestConfidence,
        candidate.combinedConfidence,
      ),
    });
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.bestConfidence - a.bestConfidence)
    .slice(0, limit);
}

export function routeFoodMatchConfidence(
  phrase: PreprocessedFoodPhrase,
  candidates: ReadonlyArray<FoodMatchCandidate>,
): ConfidenceRoute {
  const topCandidate = candidates[0] ?? null;
  const buckets = buildBucketOptions(candidates);

  if (topCandidate === null) {
    return {
      level: "low",
      topCandidate: null,
      candidates: [],
      buckets,
    };
  }

  const runnerUpConfidence = candidates[1]?.combinedConfidence ?? 0;
  const confidenceGap = topCandidate.combinedConfidence - runnerUpConfidence;
  const tokenCount = phrase.normalizedName.split(" ").filter(Boolean).length;

  if (
    topCandidate.combinedConfidence >= 0.86 &&
    (confidenceGap >= 0.08 ||
      tokenCount <= 2 ||
      topCandidate.resolver === "alias")
  ) {
    return {
      level: "high",
      topCandidate,
      candidates: candidates.slice(0, 3),
      buckets,
    };
  }

  if (topCandidate.combinedConfidence >= 0.56) {
    return {
      level: "medium",
      topCandidate,
      candidates: candidates.slice(0, 3),
      buckets,
    };
  }

  return {
    level: "low",
    topCandidate,
    candidates: candidates.slice(0, 3),
    buckets,
  };
}

export function isStructurallyAmbiguousPhrase(
  phrase: PreprocessedFoodPhrase,
): boolean {
  return (
    phrase.normalizedName.split(" ").filter(Boolean).length >= 5 ||
    /\b(style|mixed|combo|assorted|various|stuffed)\b/i.test(phrase.parsedName)
  );
}
