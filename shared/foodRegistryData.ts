/**
 * Food Registry — the single source of truth for all canonical foods.
 *
 * Every canonical food in this app is defined here. Both the deterministic
 * canonicalization function and the LLM canonicalization prompt are derived
 * from this registry. To add, rename, or reclassify a food, edit this file only.
 *
 * Zone model (metro map metaphor):
 *   Zone 1A  – Clear and full liquids. Immediate post-op recovery.
 *   Zone 1B  – Soft, low-residue solids. First solid foods post-surgery.
 *   Zone 2   – Expanded but still defensive diet. More variety, mild herbs,
 *              more protein preparations, peeled/well-cooked veg. Still no
 *              garlic, onion, chili, fried foods, legumes, or raw salads.
 *   Zone 3   – Experimental. Anything outside Zones 1–2. Introduce one at a
 *              time only when stable on a Zone 2 baseline.
 *
 * Hierarchy:
 *   4 groups (protein, carbs, fats, seasoning) → 11 sub-lines.
 *   Every entry has a required group + line assignment.
 *
 * Clinical basis: <2 g fibre per serving for Zones 1–2; no skins/seeds/hulls;
 * no strong spices. Sources: NHS low-residue diet leaflets, UCSF ileostomy
 * diet, Bowel Cancer Australia, Leeds Teaching Hospitals ileostomy guide.
 */

export type FoodZone = 1 | 2 | 3;
export type FoodSubzone = "1A" | "1B";

export const FOOD_GROUP_LINES = {
  protein: ["meat_fish", "eggs_dairy", "vegetable_protein"],
  carbs: ["grains", "vegetables", "fruit"],
  fats: ["oils", "dairy_fats", "nuts_seeds"],
  seasoning: ["sauces_condiments", "herbs_spices"],
} as const;

export type FoodGroup = keyof typeof FOOD_GROUP_LINES;
export type FoodLine = (typeof FOOD_GROUP_LINES)[FoodGroup][number];

export type FoodCategory =
  | "protein"
  | "carbohydrate"
  | "fat"
  | "dairy"
  | "condiment"
  | "drink"
  | "beverage";

export type FoodSubcategory =
  | "meat"
  | "fish"
  | "egg"
  | "legume"
  | "grain"
  | "vegetable"
  | "root_vegetable"
  | "fruit"
  | "oil"
  | "butter_cream"
  | "nut_seed"
  | "nut"
  | "milk_yogurt"
  | "cheese"
  | "dairy"
  | "dairy_alternative"
  | "dessert"
  | "frozen"
  | "herb"
  | "spice"
  | "sauce"
  | "acid"
  | "thickener"
  | "seasoning"
  | "irritant"
  | "processed"
  | "composite_dish"
  | "sugar"
  | "broth"
  | "hot_drink"
  | "juice"
  | "supplement"
  | "water"
  | "alcohol"
  | "fizzy_drink";

export type FoodRiskLevel =
  | "none"
  | "low"
  | "low_moderate"
  | "moderate"
  | "moderate_high"
  | "high";

export type FoodResidueLevel =
  | "very_low"
  | "low"
  | "low_moderate"
  | "moderate"
  | "high";

export type FoodGasLevel = "no" | "possible" | "yes";
export type FoodDryTextureLevel = "no" | "low" | "yes";

export interface FoodDigestionMetadata {
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: FoodRiskLevel;
  fiberSolubleLevel?: FoodRiskLevel;
  gasProducing?: FoodGasLevel;
  dryTexture?: FoodDryTextureLevel;
  irritantLoad?: FoodRiskLevel;
  highFatRisk?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
}

interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  /** The tracking unit. This is what the transit map and trial system use. */
  canonical: string;
  zone: FoodZone;
  /** Only set for zone 1 entries: 1A = liquids, 1B = soft solids. */
  subzone?: FoodSubzone;
  category: FoodCategory;
  subcategory: FoodSubcategory;
  /** Primary macronutrients. Dual-role foods (dairy, legumes) list more than one. */
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  /**
   * Natural-language phrases a user might type that map to this canonical.
   * Used both for deterministic lookup (after normalization) and as LLM context.
   */
  examples: ReadonlyArray<string>;
  /** Macronutrient group for transit map display. */
  group: FoodGroup;
  /** Sub-line within the group. */
  line: FoodLine;
  /** Suggested exploration order within the sub-line (1 = try first). */
  lineOrder: number;
  /** Why this canonical is distinct — fed to the LLM as context. */
  notes?: string;
}

export type FoodRegistryEntry = {
  [Group in FoodGroup]: FoodRegistryEntryBase & {
    group: Group;
    line: (typeof FOOD_GROUP_LINES)[Group][number];
  };
}[FoodGroup];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 1A — Clear and full liquids
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_1A: ReadonlyArray<FoodRegistryEntry> = [
  {
    canonical: "clear broth",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "broth",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 1,
    examples: [
      "broth",
      "clear broth",
      "chicken broth",
      "chicken stock",
      "beef broth",
      "beef stock",
      "vegetable stock",
      "vegetable broth",
      "bone broth",
      "bouillon",
      "consommé",
      "clear soup",
      "stock",
    ],
    notes:
      "Clear, strained liquid only. No solids, cream, or blended vegetables.",
  },
  {
    canonical: "gelatin dessert",
    zone: 1,
    subzone: "1A",
    category: "carbohydrate",
    subcategory: "dessert",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 0,
    examples: [
      "gelatin dessert",
      "gelatin",
      "gelatine",
      "jelly",
      "jello",
      "jelly pot",
      "gelatin cup",
    ],
    notes:
      "Smooth gelatin dessert only. No fruit pieces, seeds, cream, or layered toppings.",
  },
  {
    canonical: "smooth soup",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "broth",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 0,
    examples: [
      "smooth soup",
      "blended soup",
      "pureed soup",
      "strained soup",
      "carrot soup",
      "butternut squash soup",
      "pumpkin soup",
      "potato soup",
      "cream of potato soup",
      "cream of pumpkin soup",
      "cream of carrot soup",
    ],
    notes:
      "Fully blended and strained. No chunks, seeds, or high-fat cream. Cream-of style soups are fine in small amounts.",
  },
  {
    canonical: "protein drink",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "milk_yogurt",
    macros: ["protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 6,
    examples: [
      "protein drink",
      "clear protein drink",
      "clear whey",
      "medical protein drink",
      "protein water",
      "clear protein shake",
    ],
    notes:
      "Clear whey or hospital-style protein water. Kept separate from milk because the texture and sugar load behave differently.",
    osmoticEffect: "moderate",
    totalResidue: "very_low",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "none",
    fiberSolubleLevel: "none",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "low",
    highFatRisk: "none",
    lactoseRisk: "low",
  },

  // ── beverages ──
  {
    canonical: "water",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "water",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 1,
    examples: [
      "water",
      "plain water",
      "still water",
      "tap water",
      "mineral water",
      "filtered water",
      "glass of water",
      "sparkling water",
    ],
    notes:
      "Most fundamental intake. Sparkling/carbonated water may cause gas — see carbonated drinks for Zone 3 fizzy beverages. Small sips recommended initially post-surgery.",
  },
  {
    canonical: "diluted juice",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "juice",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 0,
    examples: [
      "apple juice",
      "diluted juice",
      "clear juice",
      "strained juice",
      "grape juice",
      "diluted squash",
      "squash",
      "cordial",
      "diluted cordial",
      "fruit juice",
      "juice",
    ],
    notes:
      "Clear or strained juice only — no pulp. Dilute 50:50 with water initially to reduce osmotic load. Apple juice is the standard first juice post-surgery.",
  },
  {
    canonical: "tea",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "hot_drink",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 24,
    examples: [
      "tea",
      "weak tea",
      "plain tea",
      "black tea",
      "herbal tea",
      "chamomile tea",
      "peppermint tea",
      "green tea",
      "rooibos",
      "decaf tea",
      "cup of tea",
      "cuppa",
    ],
    notes:
      "Weak/plain tea without milk. Universally allowed on clear liquid diets. Herbal teas (chamomile, peppermint) are often recommended for post-surgical comfort. Caffeinated tea in moderation.",
  },
  {
    canonical: "electrolyte drink",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "supplement",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 25,
    examples: [
      "electrolyte drink",
      "dioralyte",
      "pedialyte",
      "oral rehydration",
      "ORS",
      "rehydration salts",
      "electrolyte water",
      "sports drink",
      "lucozade sport",
      "powerade",
      "gatorade",
    ],
    notes:
      "Essential for post-surgical hydration, especially after ileocolic resection. Osmotic effect can be moderate due to sugar/salt concentration.",
  },
  {
    canonical: "ice lolly",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "frozen",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 15,
    examples: [
      "ice lolly",
      "popsicle",
      "ice pop",
      "fruit ice",
      "frozen juice bar",
      "ice block",
      "calippo",
      "fab ice lolly",
      "mr freeze",
    ],
    notes:
      "Smooth ice lollies only — no fruit pieces, no cream/dairy. Essentially frozen diluted juice. Standard clear liquid diet item for patients with poor appetite.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 1B — Soft, low-residue solids
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_1B: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "boiled fish",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "fish",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 2,
    examples: [
      "fish",
      "boiled fish",
      "poached fish",
      "boiled cod",
      "poached haddock",
      "steamed white fish",
      "steamed fish",
      "poached white fish",
      "steamed cod",
      "poached cod",
      "steamed haddock",
      "steamed tilapia",
      "steamed sole",
      "steamed plaice",
      "steamed pollock",
      "plain fish",
      "fish cooked in water",
      "merluza fish poached",
      "merlusa fish poached",
      "poached merluza",
      "poached hake",
    ],
    notes: "White fish only, moist-heat, no added fat.",
  },
  {
    canonical: "boiled white meat",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "meat",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 3,
    examples: [
      "boiled chicken",
      "poached chicken",
      "boiled turkey",
      "poached turkey",
      "steamed chicken",
      "poached chicken breast",
      "boiled chicken breast",
      "steamed chicken breast",
      "poached chicken thigh",
      "boiled chicken thigh",
      "poached chicken fillet",
      "boiled chicken fillet",
      "chicken cooked in water",
      "slow cooked chicken in broth",
    ],
    notes:
      "Moist-heat only (poached, boiled, steamed). No added fat, no browning. The most gentle white meat preparation for Zone 1.",
  },

  // ── eggs_dairy ──
  {
    canonical: "plain yogurt",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 1,
    examples: [
      "yogurt",
      "yoghurt",
      "plain yogurt",
      "plain yoghurt",
      "natural yogurt",
      "desnatado yogurt",
      "desnatado yoghurt",
      "plain desnatado yogurt",
      "greek yogurt",
      "greek yoghurt",
      "low fat yogurt",
      "smooth yogurt",
      "probiotic yogurt",
      "live yogurt",
    ],
    notes:
      "Plain, smooth, no fruit pieces or granola. Greek yogurt included — high protein, easy to digest.",
  },
  {
    canonical: "egg",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 2,
    examples: [
      "egg",
      "eggs",
      "boiled egg",
      "soft boiled egg",
      "hard boiled egg",
      "dippy egg",
      "poached egg",
      "poached eggs",
      "scrambled egg",
      "scrambled eggs",
      // soft scrambled egg moved from Zone 2 buttered scrambled eggs to Zone 1B plain egg —
      // rationale: without butter, plain soft-scrambled is digestively equivalent to boiled egg
      "soft scrambled egg",
      "soft scrabled egg", // intentional typo alias for voice-to-text capture
      "omelette",
      "omelet",
      "plain omelette",
      "egg white",
      "egg whites",
      "frittata",
      "shirred egg",
      "coddled egg",
      "two egg omelette",
      "three scrambled eggs",
      "six poached eggs",
      "four boiled eggs",
    ],
    notes:
      "Any cooked egg preparation without added fat: boiled, poached, scrambled (no butter), plain omelette. Quantity variations all map here.",
  },
  {
    canonical: "milk",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 3,
    examples: [
      "milk",
      "whole milk",
      "full fat milk",
      "semi-skimmed milk",
      "skimmed milk",
      "low fat milk",
      "cow's milk",
      "glass of milk",
      "warm milk",
      "hot milk",
    ],
    notes:
      "Includes milk drunk plain or used in tea/coffee. Lactose intolerance post-surgery is possible — track tolerance.",
  },
  {
    canonical: "cottage cheese",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "cheese",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 4,
    examples: [
      "cottage cheese",
      "low fat cottage cheese",
      "smooth cottage cheese",
    ],
    notes: "Soft, smooth, high protein, low fat. Easy to digest.",
  },
  {
    canonical: "custard",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 5,
    examples: [
      "custard",
      "plain custard",
      "vanilla custard",
      "egg custard",
      "pouring custard",
      "crème anglaise",
      "creme anglaise",
    ],
    notes:
      "Smooth milk-and-egg custard only. No pastry shells, dried fruit, or baked skins.",
  },

  // ── grains ──
  {
    canonical: "white rice",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 2,
    examples: [
      "white rice",
      "rice",
      "plain rice",
      "boiled rice",
      "steamed rice",
      "long grain rice",
      "basmati rice",
      "jasmine rice",
      "arborio rice",
      "risotto rice",
      "congee",
      "rice porridge",
      "rice soup (rice)",
      "sm bowl white rice soup (rice)",
    ],
    notes:
      "Well-cooked, plain. Any white rice variety. Congee counts here — very well-cooked.",
  },
  {
    canonical: "toast",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 3,
    examples: [
      "toast",
      "white toast",
      "plain toast",
      "dry toast",
      "slice of toast",
      "two slices of toast",
    ],
    notes:
      "A BRAT-diet staple. Toasting dries the bread and makes it easier to digest than soft white bread. Distinct canonical — do not merge with white bread.",
  },
  {
    canonical: "soaked cracker",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 4,
    examples: [
      "soaked cracker",
      "soaked plain cracker",
      "cracker soaked in broth",
      "plain salted cracker soaked in broth",
    ],
    notes:
      "Zone 1 cracker only: softened in broth or soup until no longer dry. Dry refined crackers move to crispy cracker in Zone 2.",
  },
  {
    canonical: "white bread",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 5,
    examples: [
      // bare "bread" → white bread; specific bread types (sourdough, rye, etc.) have their own entries
      "bread",
      "white bread",
      "white loaf",
      "white roll",
      "white bread roll",
      "sliced white bread",
      "soft white bread",
      "crusty white bread",
      "crusty bread",
      "stale crusty bread",
      "stale bread",
      "baguette",
      "1/2 baguette",
      "1/2 a baguette",
      "fresh baked baguette",
      "white sandwich bread",
      "plain white roll",
      "white pitta",
      "french baguette",
      "baked baguette",
      "french bread",
      "soft white bread slice",
      "wrap",
      "flat bread tortilla",
      "wrap (flat bread tortilla)",
      "hamburger bun",
      "hot dog bun",
    ],
    notes:
      "Soft white bread. Slightly more fermentable than toast — users often tolerate toast first. No seeds, grains, or added fibre.",
  },
  {
    canonical: "white pasta",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 6,
    examples: [
      "pasta",
      "white pasta",
      "spaghetti",
      "penne",
      "fusilli",
      "tagliatelle",
      "linguine",
      "macaroni",
      "rigatoni",
      "orzo",
      "cooked pasta",
      "boiled pasta",
    ],
    notes:
      "White/refined pasta only, well-cooked. No wholemeal pasta (Zone 3).",
  },
  {
    canonical: "rice cracker",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 8,
    examples: [
      "rice cracker",
      "rice crackers",
      "plain rice cracker",
      "rice cake",
      "plain rice cake",
      "savoury rice cracker",
    ],
    notes: "Light crackers. Low residue, easy to digest.",
  },
  {
    canonical: "porridge",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 9,
    examples: [
      "porridge",
      "oatmeal",
      "oats",
      "smooth porridge",
      "rolled oats",
      "instant oats",
      "ready brek",
      "plain oat porridge",
    ],
    notes: "Smooth, plain, no added seeds or dried fruit.",
  },
  {
    canonical: "noodles",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 7,
    examples: [
      "noodles",
      "plain noodles",
      "egg noodles",
      "rice noodles",
      "udon",
      "vermicelli",
      "plain noodle soup noodles",
    ],
    notes:
      "Plain refined noodles only, well-cooked and not fried. No spicy broths, garlic-heavy sauces, or stir-fry preparations.",
  },
  {
    canonical: "rice pudding",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "carbs",
    line: "grains",
    lineOrder: 10,
    examples: [
      "rice pudding",
      "plain rice pudding",
      "creamed rice",
      "milky rice pudding",
      "rice pudding pot",
    ],
    notes:
      "Soft rice cooked in milk until very tender. No dried fruit, nuts, seeds, or cinnamon-heavy toppings.",
  },
  {
    canonical: "soft couscous",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 11,
    examples: [
      "soft couscous",
      "plain couscous",
      "soft plain couscous",
      "couscous soft",
      "fine couscous",
    ],
    notes:
      "Plain, fine couscous cooked very soft. No herbs, seeds, or vegetables.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "no",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "soft polenta",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 12,
    examples: [
      "soft polenta",
      "plain polenta",
      "soft fine polenta",
      "fine polenta",
      "polenta soft",
    ],
    notes:
      "Plain, fine polenta cooked until spoon-soft. No cheese, herbs, or coarse grit.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "no",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },

  // ── vegetables ──
  {
    canonical: "mashed potato",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 2,
    examples: [
      "mashed potato",
      "mashed potatoes",
      "mash",
      "mash potato",
      "pureed potato",
      "potato mash",
      "smooth mash",
      "creamed potato",
      "potato puree",
      "potato purée",
    ],
    notes:
      "Peeled, well-cooked, mashed smooth. Small amount of butter or milk is fine.",
  },
  {
    canonical: "mashed root vegetable",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 3,
    examples: [
      "pureed carrot",
      "mashed carrot",
      "carrot puree",
      "pureed parsnip",
      "pureed swede",
      "pureed pumpkin",
      "mashed butternut squash",
      "cooked carrot",
      "soft carrot",
      "baby carrot cooked",
      "well cooked carrot",
      "mashed pumpkin",
      "pumpkin puree",
      "calabaza",
      "pureed butternut squash",
      "acorn squash",
      "winter squash",
      "squash puree",
    ],
    notes:
      "Peeled, well-cooked, pureed or mashed. Replaces separate cooked carrot and cooked pumpkin entries for Zone 1B.",
  },

  // ── fruit ──
  {
    canonical: "ripe banana",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 1,
    examples: [
      "banana",
      "bananas",
      "ripe banana",
      "small banana",
      "sm banana",
      "mashed banana",
      "soft banana",
      "very ripe banana",
    ],
    notes:
      "Must be fully ripe — green or underripe bananas are harder to digest and can increase output.",
  },
  {
    canonical: "stewed apple",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 2,
    examples: [
      "stewed apple",
      "cooked apple",
      "baked apple",
      "apple sauce",
      "applesauce",
      "apple puree",
      "pureed apple",
      "stewed apple without skin",
      "peeled cooked apple",
    ],
    notes:
      "Peeled, stewed or cooked until soft. No raw apple (high fibre, firm texture).",
  },
  {
    canonical: "canned pear",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 3,
    examples: [
      "canned pear",
      "tinned pear",
      "pear in juice",
      "pear in syrup",
      "canned fruit",
      "tinned fruit",
      "peeled cooked pear",
      "stewed pear",
      "poached pear",
      "poached pears",
    ],
    notes:
      "Canned/tinned in juice, or freshly stewed, peeled. Very low residue.",
  },
  {
    canonical: "canned peach",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 4,
    examples: [
      "canned peach",
      "tinned peach",
      "peach in juice",
      "peach in syrup",
      "canned apricot",
      "tinned apricot",
      "canned nectarine",
    ],
    notes:
      "Canned/tinned in juice. Soft, very low residue. Zone changed from 2 to 1B.",
  },

  // ── oils ──
  {
    canonical: "olive oil",
    zone: 1,
    subzone: "1B",
    category: "fat",
    subcategory: "oil",
    macros: ["fat"],
    group: "fats",
    line: "oils",
    lineOrder: 1,
    examples: [
      "olive oil",
      "extra virgin olive oil",
      "olive oil extra virgin",
      "drizzle of olive oil",
      "teaspoon of olive oil",
      "tablespoon of olive oil",
    ],
    notes: "Small amounts in cooking. Monounsaturated fat.",
  },

  // ── sauces_condiments ──
  {
    canonical: "salt",
    zone: 1,
    subzone: "1B",
    category: "condiment",
    subcategory: "seasoning",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 1,
    examples: [
      "salt",
      "sea salt",
      "table salt",
      "rock salt",
      "a pinch of salt",
      "seasoned with salt",
    ],
  },

  // ── eggs_dairy (additional) ──
  {
    canonical: "smooth mousse",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "dessert",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 12,
    examples: [
      "mousse",
      "chocolate mousse",
      "vanilla mousse",
      "mousse pot",
      "whipped dessert",
      "aero mousse",
      "cadbury mousse",
      "gu mousse",
    ],
    notes:
      "Smooth, aerated desserts. Bridge between liquid gelatin (1A) and custard (1B). Must be smooth — no chunks, nuts, or fruit pieces.",
  },

  // ── grains (additional) ──
  {
    canonical: "semolina",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 19,
    examples: [
      "semolina",
      "semolina pudding",
      "cream of wheat",
      "semolina porridge",
      "semolina dessert",
      "farina",
    ],
    notes:
      "Refined wheat product, very gentle. Common in UK/European post-surgical recovery diets. Similar to porridge but from wheat rather than oats.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "mashed sweet potato",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 26,
    examples: [
      "mashed sweet potato",
      "sweet potato mash",
      "pureed sweet potato",
      "sweet potato puree",
      "whipped sweet potato",
    ],
    notes:
      "Peeled and mashed/pureed sweet potato. As gentle as regular mashed potato. Higher beta-carotene. No skin.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 2 — Expanded but still defensive diet
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_2: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "grilled white meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 4,
    examples: [
      "chicken",
      "grilled chicken",
      "baked chicken",
      "roasted chicken",
      "grilled turkey",
      "baked turkey",
      "grilled chicken breast",
      "grilled chicken fillet",
      "baked chicken breast",
      "roasted chicken breast",
      "roast chicken breast",
      "roast chicken",
      "air fried chicken",
      "oven chicken",
      "chicken bake",
      "turkey",
      "roast turkey",
      "sliced turkey",
      "turkey slices",
      "deli turkey",
      "cold turkey",
      "turkey breast",
      "roasted turkey",
    ],
    notes:
      "Dry-heat chicken or turkey (grilled, baked, roasted, air-fried) with little or no added fat. No skin. Distinct from Zone 1 boiled white meat (moist-heat).",
  },
  {
    canonical: "cooked fish",
    zone: 2,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 5,
    examples: [
      "baked fish",
      "grilled fish",
      "baked cod",
      "grilled haddock",
      "baked white fish",
      "grilled white fish",
      "grilled cod",
      "fish with butter",
      "baked tilapia",
      "baked sole",
      "fish in foil",
    ],
    notes:
      "White fish with small amount of butter or oil. Distinct from Zone 1 boiled fish.",
  },
  {
    canonical: "lean minced meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 6,
    examples: [
      "lean mince",
      "lean minced beef",
      "lean minced turkey",
      "minced beef",
      "minced turkey",
      "lean ground beef",
      "ground turkey",
      "lean meatballs",
      "minced meat patty",
    ],
    notes:
      "Finely minced, well-cooked meat without gristle or heavy browning. Distinct from chunkier red meat cuts.",
    osmoticEffect: "none",
    totalResidue: "low_moderate",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "low",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "none",
  },
  {
    canonical: "red meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 7,
    examples: [
      "beef",
      "lamb",
      "pork",
      "pork tenderloin",
      "roast beef",
      "lean pork",
      "pork fillet",
      "pork loin",
      "roast pork",
      "baked pork",
      "grilled pork",
    ],
    notes:
      "Whole-cut or chunked red meat, well cooked with excess fat drained off. No spicy seasoning.",
  },
  {
    canonical: "oily fish",
    zone: 2,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 8,
    examples: [
      "salmon",
      "tuna",
      "mackerel",
      "sardines",
      "baked salmon",
      "grilled salmon",
      "poached salmon",
      "salmon fillet",
      "steamed salmon",
      "salmon with lemon",
      "fresh salmon",
      "canned tuna",
      "tinned tuna",
      "tuna in water",
      "tuna in oil",
      "tuna in brine",
      "tuna flakes",
    ],
    notes:
      "Oily fish — healthy unsaturated fat. Small portions. Replaces separate salmon and tuna entries.",
  },
  {
    canonical: "ham",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 9,
    examples: [
      "roast ham",
      "ham",
      "thick ham",
      "thick sliced ham",
      "sliced ham",
      "carved ham",
      "ham off the bone",
      "deli roast ham",
      "roasted ham slices",
      "cooked roast ham",
      "cooked ham",
      "boiled ham",
      "lean ham",
      "ham slice",
      "honey ham",
    ],
    notes:
      "Thick-cut cooked ham or ham off the bone. Less processed than sausage-style meats, but still saltier than chicken or turkey.",
  },

  // ── eggs_dairy ──
  {
    canonical: "buttered scrambled eggs",
    zone: 2,
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 7,
    examples: [
      "buttered scrambled eggs",
      "scrambled eggs with butter",
      "scrambled eggs in butter",
      "creamy scrambled eggs",
    ],
    notes:
      "Scrambled eggs cooked with a small amount of butter. More satiating than plain scrambled eggs. Tolerated by most when Zone 1 eggs are established.",
  },
  {
    canonical: "flavoured yogurt",
    zone: 2,
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 8,
    examples: [
      "flavoured yogurt",
      "flavored yogurt",
      "fruit yogurt",
      "strawberry yogurt",
      "strawberry flavoured greek yogurt",
      "strawberry flavored greek yogurt",
      "greek strawberry yogurt",
      "vanilla yogurt",
      "peach yogurt",
      "smooth fruit yogurt",
    ],
    notes:
      "Smooth fruit-flavoured yogurt without fruit pieces or seeds. More sugar than plain yogurt — trial when plain yogurt is well tolerated.",
  },
  {
    canonical: "milk pudding",
    zone: 2,
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 9,
    examples: [
      "milk pudding",
      "panna cotta",
      "blancmange",
      "junket",
      "set milk pudding",
      "vanilla panna cotta",
      "plain panna cotta",
    ],
    notes:
      "Set milk-based desserts without added fruit pieces or nuts. Gentle protein and fat source.",
  },
  {
    canonical: "kefir",
    zone: 2,
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 10,
    examples: ["kefir", "milk kefir", "probiotic kefir", "kefir yogurt"],
    notes:
      "Fermented dairy. Unpredictable post-anastomosis — some tolerate well, others experience increased output. Trial cautiously from a stable Zone 2 baseline.",
  },
  {
    canonical: "fried egg",
    zone: 2,
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 11,
    examples: [
      "fried egg",
      "fried eggs",
      "pan fried egg",
      "sunny side up",
      "over easy",
      "over hard",
      "eggs fried in butter",
      "butter fried egg",
      "egg in butter",
    ],
    notes:
      "Egg cooked in added fat (butter, oil). Moved from Zone 3 to Zone 2 — buttered scrambled eggs are already Zone 2, so fried egg is consistent.",
  },

  // ── vegetable_protein ──
  {
    canonical: "tofu",
    zone: 2,
    category: "protein",
    subcategory: "legume",
    macros: ["protein", "fat"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 1,
    examples: [
      "tofu",
      "plain tofu",
      "silken tofu",
      "soft tofu",
      "firm tofu",
      "steamed tofu",
    ],
    notes:
      "Plain tofu only. Soft soy protein without the skins and fibre load of whole legumes. No fried, smoked, or spicy tofu dishes.",
  },

  // ── grains ──
  {
    canonical: "crispy cracker",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 13,
    examples: [
      "crispy cracker",
      "quelitas",
      "quelitas snacks",
      "quelitas mediterranean snacks",
      "quelitos",
      "kelitos",
      "chelitas",
      "tuc",
      "tuc plain",
      "tuck cracker",
      "tuc crackers",
      "tuck crackers",
      "ritz",
      "ritz original",
      "ritz crackers",
      "water biscuit",
      "water biscuits",
      "cream cracker",
      "cream crackers",
      "saltines",
      "cracker",
      "crackers",
      "breadstick",
      "breadsticks",
      "bread snacks",
      "baked bread snacks",
      "toasted bread snacks",
      "grissini",
      "mini grissini",
      "bayonetas",
      "tostada",
      "tostadas",
    ],
    notes:
      "Thin, crispy refined crackers and breadsticks. Low fibre, moderately fatty, and notably dry compared with soaked Zone 1 crackers.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low",
    lactoseRisk: "none",
  },
  {
    canonical: "plain biscuit",
    zone: 2,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 14,
    examples: [
      "plain biscuit",
      "plain biscuits",
      "biscuit",
      "biscuits",
      "digestive",
      "digestive biscuit",
      "rich tea",
      "rich tea biscuit",
      "shortbread",
      "maria biscuit",
      "maria biscuits",
      "maria biscuits (plain)",
      "maria",
    ],
    notes:
      "Plain, low-fibre tea biscuits such as Maria biscuits. Drier and less sugary than Biscoff-style biscuits, but still more processed than toast or white bread.",
    osmoticEffect: "low_moderate",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "low",
  },
  {
    canonical: "low-fiber cereal",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 15,
    examples: [
      "low fiber cereal",
      "cornflakes",
      "rice krispies",
      "puffed rice cereal",
      "cream of rice cereal",
      "sugar puff",
      "sugar puffs",
    ],
    notes:
      "Refined breakfast cereals without nuts, seeds, dried fruit, or bran. Use milk cautiously if lactose is still unsettled.",
    osmoticEffect: "low_moderate",
    totalResidue: "low",
    fiberTotalApproxG: 2,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low_moderate",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "basic savoury snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 16,
    examples: [
      "plain crisps",
      "plain potato crisps",
      "plain salted lays",
      "salted crisps",
      "mini pretzels",
      "soft pretzel",
      "plain corn puffs",
      "cheese puffs",
      "cheese crackers",
      "baked cheese snacks",
      "wotsits",
      "cheetos",
      "cheese straws",
    ],
    notes:
      "Plain savoury snacks with low fibre but a dry, bulky texture. Start with small portions and pair with fluids.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "none",
  },
  {
    canonical: "low-fiber sweet snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 17,
    examples: [
      "gummy bears",
      "fruit jelly sweets",
      "fruit snack gummies",
      "marshmallows",
      "jelly babies",
      "wine gums",
      "haribo",
      "fruit pastilles",
      "meringue",
      "turkish delight",
    ],
    notes:
      "Low-residue sweets with almost no fibre. The main risk is osmotic looseness from concentrated sugar.",
    osmoticEffect: "moderate_high",
    totalResidue: "very_low",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "simple chocolate snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 18,
    examples: [
      "plain milk chocolate bar",
      "plain chocolate biscuit",
      "chocolate coated plain biscuit",
      "chocolate bar",
      "milk chocolate bar",
      "small chocolate bar",
      "kit kat",
    ],
    notes:
      "Small portions of plain chocolate or simple chocolate biscuits with no nuts, caramel, or dried fruit.",
    osmoticEffect: "moderate",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "moderate",
    lactoseRisk: "low",
  },

  // ── vegetables ──
  {
    canonical: "boiled carrot",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 4,
    examples: [
      "boiled carrot",
      "steamed carrot",
      "carrot sticks cooked",
      "soft cooked carrot",
    ],
    notes:
      "Boiled, not pureed. Distinct from Zone 1B mashed root vegetable (pureed).",
  },
  {
    canonical: "baked potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 5,
    examples: [
      "baked potato",
      "jacket potato",
      "oven potato",
      "baked potato flesh",
      "jacket potato without skin",
    ],
    notes: "Flesh only — no skin (Zone 3). Skin holds significant fibre.",
  },
  {
    canonical: "sweet potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 6,
    examples: [
      "sweet potato",
      "baked sweet potato",
      "boiled sweet potato",
      "yam",
    ],
    notes:
      "Peeled, well-cooked. No skin. Mashed/pureed sweet potato has its own Zone 1B entry.",
  },
  {
    canonical: "cooked pumpkin",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 7,
    examples: [
      "baked pumpkin",
      "roasted pumpkin",
      "baked butternut squash",
      "roasted butternut squash",
      "steamed pumpkin",
      "boiled pumpkin",
      "steamed butternut squash",
    ],
    notes:
      "Boiled/baked pumpkin (not pureed — pureed is under mashed root vegetable in Zone 1B).",
  },
  {
    canonical: "courgette",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 8,
    examples: [
      "courgette",
      "zucchini",
      "cooked courgette",
      "steamed courgette",
      "boiled courgette",
      "peeled courgette",
      "courgette without skin",
    ],
    notes:
      "Peeled, well-cooked. Skin can be included if very well cooked and soft.",
  },
  {
    canonical: "peeled cucumber",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 9,
    examples: [
      "peeled cucumber",
      "cucumber without skin",
      "deseeded cucumber",
      "cucumber flesh",
    ],
    notes:
      "Peeled and de-seeded only. Cucumber with skin stays in Zone 3. Exception to the no-raw-vegetables guidance: peeled, de-seeded cucumber is >95% water with near-zero fiber.",
  },
  {
    canonical: "cooked spinach",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 11,
    examples: [
      "spinach",
      "cooked spinach",
      "steamed spinach",
      "boiled spinach",
      "wilted spinach",
      "baby spinach cooked",
    ],
    notes: "Well-wilted, no raw spinach in Zones 1–2.",
  },
  {
    canonical: "cooked tomato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 12,
    examples: [
      "cooked tomato",
      "roasted tomato",
      "baked tomato",
      "peeled tomato",
      "de-seeded tomato",
      "canned tomato",
      "tinned tomato",
      "passata",
      "strained tomato",
    ],
    notes:
      "Peeled and de-seeded, or canned/passata. No raw tomato with skin or seeds.",
  },
  {
    canonical: "cooked bell pepper",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 13,
    examples: [
      "cooked bell pepper",
      "roasted pepper",
      "grilled pepper",
      "cooked capsicum",
      "roasted capsicum",
      "peeled pepper",
      "pepper in sauce",
    ],
    notes: "Well-cooked or roasted, peeled, no seeds. Not raw (Zone 3).",
  },
  {
    canonical: "swede",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 14,
    examples: [
      "swede",
      "rutabaga",
      "cooked swede",
      "boiled swede",
      "mashed swede",
      "turnip",
      "cooked turnip",
    ],
    notes: "Peeled, well-cooked.",
  },
  {
    canonical: "parsnip",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    // lineOrder 10: parsnip is well-tolerated early in vegetable reintroduction
    lineOrder: 10,
    examples: [
      "parsnip",
      "cooked parsnip",
      "boiled parsnip",
      "roasted parsnip",
      "mashed parsnip",
    ],
    notes: "Peeled, well-cooked.",
  },
  {
    canonical: "cauliflower",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 15,
    examples: [
      "cauliflower",
      "coliflower",
      "cooked cauliflower",
      "steamed cauliflower",
      "boiled cauliflower",
      "cauliflower florets",
      "cauliflower mash",
      "mashed cauliflower",
    ],
    notes:
      "Florets only, no tough stalks, well-cooked. End of Zone 2 — gassy but tolerable.",
    gasProducing: "yes",
  },

  // ── fruit ──
  {
    canonical: "melon",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 5,
    examples: [
      "melon",
      "honeydew melon",
      "cantaloupe",
      "rockmelon",
      "watermelon",
      "ripe melon",
    ],
    notes: "Ripe, no skin. Low fibre, very high water content.",
  },
  {
    canonical: "ripe mango",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 6,
    examples: [
      "mango",
      "ripe mango",
      "fresh mango",
      "mango flesh",
      "sliced mango",
    ],
    notes:
      "Ripe, no skin. Good source of soluble fibre — tolerated well in Zone 2.",
  },
  {
    canonical: "peeled apple",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 7,
    examples: [
      "peeled apple",
      "apple without skin",
      "skinless apple",
      "apple peeled",
    ],
    notes:
      "Peeled raw apple — skin removed reduces insoluble fibre. Easier to digest than raw apple with skin (Zone 3), harder than stewed apple (Zone 1).",
  },

  // ── oils ──
  {
    canonical: "vegetable oil",
    zone: 2,
    category: "fat",
    subcategory: "oil",
    macros: ["fat"],
    group: "fats",
    line: "oils",
    lineOrder: 2,
    examples: [
      "vegetable oil",
      "sunflower oil",
      "rapeseed oil",
      "canola oil",
      "cooking oil",
      "neutral oil",
    ],
    notes:
      "For cooking. Small amounts only. Coconut oil has its own Zone 3 entry under coconut.",
  },

  // ── dairy_fats ──
  {
    canonical: "butter",
    zone: 2,
    category: "fat",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 1,
    examples: [
      "butter",
      "a little butter",
      "small amount of butter",
      "teaspoon of butter",
      "butter on toast",
      "margarine",
      "flora spreadable",
    ],
    notes:
      "Small amounts as spread or in cooking. Saturated fat — use sparingly. Zone changed from 1B to 2.",
  },
  {
    canonical: "cream cheese",
    zone: 2,
    category: "dairy",
    subcategory: "cheese",
    macros: ["fat", "protein"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 2,
    examples: [
      "cream cheese",
      "soft cheese",
      "Philadelphia",
      "soft white cheese",
      "ricotta",
      "quark",
      "lactose free cream cheese",
      "spreadable cheese",
      "lactose-free cream cheese",
      "dairy free cream cheese",
    ],
    notes:
      "Soft, smooth dairy. Ricotta and quark included — lower fat than cream cheese.",
  },
  {
    canonical: "hard cheese",
    zone: 2,
    category: "dairy",
    subcategory: "cheese",
    macros: ["protein", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 3,
    examples: [
      "four cheeses",
      "cheddar",
      "cheddar cheese",
      "hard cheese",
      "edam",
      "gouda",
      "mild cheddar",
      "mature cheddar",
      "grated cheese",
      "cheese slice",
    ],
    notes:
      "Small amounts. Hard cheeses are dense in saturated fat — use as a topping, not a main dish.",
  },
  {
    canonical: "cream",
    zone: 2,
    category: "dairy",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 5,
    examples: [
      "cream",
      "single cream",
      "light cream",
      "cooking cream",
      "cream in sauce",
      "splash of cream",
      "crème fraîche",
      "sour cream",
    ],
    notes:
      "Small amounts in cooking only. High fat — too much can worsen loose stools.",
  },
  {
    canonical: "plain ice cream",
    zone: 2,
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 6,
    examples: [
      "ice cream",
      "plain ice cream",
      "vanilla ice cream",
      "dairy ice cream",
      "gelato",
    ],
    notes:
      "Plain vanilla or similar. Small portion. High fat and sugar — limit to occasional small serving.",
  },

  // ── nuts_seeds ──
  {
    canonical: "avocado",
    zone: 2,
    category: "fat",
    subcategory: "fruit",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 1,
    examples: [
      "avocado",
      "ripe avocado",
      "avocado flesh",
      "mashed avocado",
      "smashed avocado",
    ],
    notes:
      "Primarily healthy monounsaturated fat. Small portions — high fat content can increase output if eaten in large amounts. Moved from fruit to nuts_seeds.",
  },
  {
    canonical: "smooth nut butter",
    zone: 2,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 2,
    examples: [
      "nut butter",
      "peanut butter",
      "smooth peanut butter",
      "almond butter",
      "smooth almond butter",
      "cashew butter",
      "hazelnut butter",
      "smooth nut butter",
    ],
    notes:
      "Smooth nut butters only — no crunchy. No chunks or pieces. Trial cautiously from a stable Zone 2 baseline.",
  },

  // ── sauces_condiments ──
  {
    canonical: "soy sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 2,
    examples: [
      "soy sauce",
      "soya sauce",
      "tamari",
      "light soy sauce",
      "low sodium soy sauce",
    ],
    notes: "Small amounts. Tamari is gluten-free equivalent.",
  },
  {
    canonical: "smooth tomato sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 3,
    examples: [
      "smooth tomato sauce",
      "tomato sauce",
      "passata sauce",
      "marinara sauce",
      "plain tomato sauce",
      "homemade tomato sauce",
      "ketchup",
      "tomato ketchup",
    ],
    notes:
      "Smooth only — no chunks, seeds, or garlic/onion. Ketchup in small amounts.",
  },
  {
    canonical: "mild mustard",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 4,
    examples: [
      "mustard",
      "mild mustard",
      "smooth mustard",
      "dijon mustard",
      "french mustard",
      "english mustard",
    ],
    notes:
      "Small amounts as a condiment. Wholegrain mustard has seeds — borderline, use sparingly.",
  },
  {
    canonical: "white sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate", "fat"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 5,
    examples: [
      "white sauce",
      "béchamel",
      "bechamel sauce",
      "cheese sauce",
      "cream sauce",
      "mild cream sauce",
      "béchamel sauce",
    ],
    notes: "Milk-based sauce thickened with flour. No garlic or onion base.",
  },
  {
    canonical: "gravy",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate", "fat"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 6,
    examples: [
      "gravy",
      "plain gravy",
      "brown gravy",
      "chicken gravy",
      "beef gravy",
      "smooth gravy",
    ],
    notes:
      "Smooth gravy only. Best treated like a flour-thickened sauce, not a broth. No onion pieces or peppercorn-heavy gravy.",
  },
  {
    canonical: "honey",
    zone: 2,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 7,
    examples: [
      "honey",
      "runny honey",
      "clear honey",
      "honey drizzle",
      "teaspoon of honey",
    ],
    notes:
      "Small amounts as a smooth sweetener or spread. Concentrated sugar load, so treat as a condiment not a free food.",
  },
  {
    canonical: "jam",
    zone: 2,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 8,
    examples: [
      "jam",
      "smooth jam",
      "seedless jam",
      "fruit jam",
      "strawberry jam",
      "raspberry jam",
      "grape jelly",
      "crema de membrillo",
      "pico's crema de membrillo",
      "quince paste",
      "quince jelly",
    ],
    notes:
      "Smooth or seedless fruit spread only. Keep this separate from gelatin dessert and from chunky preserves with skins or seeds.",
  },

  // ── herbs_spices ──
  {
    canonical: "mild herb",
    zone: 2,
    category: "condiment",
    subcategory: "herb",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 2,
    examples: [
      "thyme",
      "rosemary",
      "sage",
      "basil",
      "oregano",
      "tarragon",
      "dried parsley",
      "dried chives",
      "mixed herbs",
      "herbes de provence",
      "bay leaf",
      "fresh thyme",
      "fresh rosemary",
      "fresh basil",
      "fresh sage",
    ],
    notes:
      "Dried or fresh culinary herbs in moderate cooking amounts. More robust than Zone 1 garnish herbs. Not the same as spicy or hot seasonings.",
  },
  {
    canonical: "mild spice",
    zone: 2,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 3,
    examples: [
      "cinnamon",
      "nutmeg",
      "vanilla",
      "vanilla extract",
      "mild paprika",
      "sweet paprika",
      "turmeric",
      "ground ginger",
      "cardamom",
      "allspice",
      "mixed spice",
    ],
    notes:
      "Mild, non-hot ground spices in small cooking amounts. Ground ginger and turmeric are generally well-tolerated. Not hot/chili spices.",
  },

  // ── grains (additional) ──
  {
    canonical: "plain pancake",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate", "protein", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 20,
    examples: [
      "pancake",
      "crepe",
      "plain pancake",
      "plain crepe",
      "scotch pancake",
      "drop scone",
      "pikelets",
      "american pancake",
      "thin pancake",
    ],
    notes:
      "Plain pancake/crepe made from white flour, egg, milk. Essentially cooked batter — digestively similar to white bread + egg. No rich fillings.",
  },
  {
    canonical: "bagel",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 28,
    examples: ["bagel", "toasted bagel", "plain bagel", "white bagel"],
    notes:
      "Denser than soft white bread. Requires more chewing, which aids digestion. Plain/white only — seeded or wholegrain bagels are Zone 3.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "boiled potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 27,
    examples: [
      "boiled potatoes",
      "boiled potato",
      "new potatoes",
      "boiled new potatoes",
      "boiled white potato",
      "plain potatoes",
      "steamed potatoes",
      "peeled potatoes",
    ],
    notes:
      "Peeled, boiled/steamed potatoes. Softer than baked, not mashed. Bridge between mashed (1B) and baked (Zone 2).",
  },
  {
    canonical: "cooked beetroot",
    zone: 2,
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 28,
    examples: [
      "beetroot",
      "cooked beetroot",
      "boiled beetroot",
      "roasted beetroot",
      "pickled beetroot",
      "beet",
      "beets",
    ],
    notes:
      "Peeled, well-cooked beetroot. Low fiber when peeled and boiled. Common in NHS low-residue guidance. May cause red/purple stool discoloration — this is harmless.",
  },
  {
    canonical: "plant milk",
    zone: 2,
    category: "beverage",
    subcategory: "dairy_alternative",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 29,
    examples: [
      "oat milk",
      "almond milk",
      "soy milk",
      "plant milk",
      "coconut milk",
      "rice milk",
      "oat drink",
      "soya milk",
      "dairy-free milk alternative",
      "lactose-free plant milk",
    ],
    notes:
      "Dairy alternatives. Generally well-tolerated for patients avoiding lactose. Oat milk and rice milk are gentlest. Soy milk has moderate protein. Coconut milk (carton, not canned) is low-residue.",
  },

  // ── fruit (additional) ──
  {
    canonical: "grapes",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 17,
    examples: [
      "grapes",
      "green grapes",
      "red grapes",
      "black grapes",
      "seedless grapes",
    ],
    notes:
      "Peeled or seedless preferred. Grape skin can be tough — peel if early in Zone 2. Moderate fructose.",
  },
  {
    canonical: "canned mandarin",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 18,
    examples: [
      "canned mandarin",
      "tinned mandarin",
      "mandarin segments in juice",
      "mandarin segments in syrup",
      "canned satsuma",
      "canned clementine",
    ],
    notes:
      "Canned mandarin in juice or syrup is much milder than fresh citrus. Acid is neutralized by the canning process. Similar tolerance profile to canned peach (Zone 1B).",
  },

  // ── dairy_fats (additional) ──
  {
    canonical: "mozzarella",
    zone: 2,
    category: "fat",
    subcategory: "dairy",
    macros: ["protein", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 4,
    examples: [
      "mozzarella",
      "fresh mozzarella",
      "buffalo mozzarella",
      "mozzarella cheese",
      "halloumi",
      "paneer",
      "queso fresco",
      "feta",
    ],
    notes:
      "Soft fresh cheeses. Lower lactose than aged cheese due to whey drainage. Distinct from cream cheese (spreadable) and hard cheese (aged).",
  },

  // ── sauces_condiments (additional) ──
  {
    canonical: "citrus juice",
    zone: 2,
    category: "condiment",
    subcategory: "acid",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 12,
    examples: [
      "lemon juice",
      "lime juice",
      "lemon",
      "lime",
      "squeeze of lemon",
      "squeeze of lime",
      "lemon wedge",
      "lime wedge",
      "lemon dressing",
    ],
    notes:
      "Condiment-quantity citrus juice. Small amounts as flavoring (on fish, in dressings, in water). Not eating whole citrus fruit — see 'citrus fruit' for Zone 3.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 3 — Experimental. Introduce one at a time from a stable Zone 2 baseline.
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_3: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "fast food burger",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 10,
    examples: [
      "hamburger",
      "burger",
      "cheeseburger",
      "Big Mac",
      "fast food burger",
      "chicken burger",
      "hamburger and chips",
      "McDonalds",
      "Burger King",
      "Wendy's",
      "drive through",
      "takeaway burger",
    ],
    notes:
      "High fat, high salt, often with garlic/onion. Full Zone 3 challenge. Renamed from fast food.",
  },
  {
    canonical: "processed meat",
    zone: 3,
    category: "protein",
    subcategory: "processed",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 11,
    examples: [
      "sausage",
      "sausages",
      "bacon",
      "salami",
      "pepperoni",
      "chorizo",
      "hot dog",
      "frankfurter",
      "black pudding",
      "pâté",
      "streaky bacon",
    ],
    notes:
      "High fat, high salt, strong spicing. Covers sausage-style and cured meats such as chorizo, salami, bacon, and hot dogs.",
  },
  {
    canonical: "battered fish",
    zone: 3,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat", "carbohydrate"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 12,
    examples: [
      "fish and chips",
      "battered fish",
      "deep fried fish",
      "fish in batter",
    ],
    notes: "Deep fried in batter. New entry.",
  },
  {
    canonical: "chili con carne",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 13,
    examples: [
      "chili con carne",
      "bean chili",
      "veggie chili",
      "chilli con carne",
    ],
    notes:
      "Composite dish: meat, legumes, spicy. Combines three Zone 3 ingredients: chili, garlic/onion, and legumes.",
  },
  {
    canonical: "stir fry",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 14,
    examples: [
      "stir fry",
      "chicken stir fry",
      "beef stir fry",
      "vegetable stir fry",
      "noodle stir fry",
      "soy stir fry",
    ],
    notes:
      "Composite dish: meat, vegetables, fried. High-heat oil-based mixed dish. Often includes garlic, onion, soy sauce, and fibrous vegetables. Keep separate from curry-style dishes.",
  },
  {
    canonical: "curry dish",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 15,
    examples: [
      "curry",
      "chicken tikka masala",
      "korma",
      "vindaloo",
      "Thai curry",
      "green curry",
      "red curry",
      "massaman curry",
      "Indian takeaway",
      "butter chicken",
    ],
    notes:
      "Composite dish: meat, vegetables, spicy. Restaurant/takeaway curries almost always contain garlic, onion, and chili in significant quantities.",
  },

  // ── vegetable_protein ──
  {
    canonical: "legumes",
    zone: 3,
    category: "protein",
    subcategory: "legume",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 3,
    examples: [
      "beans",
      "kidney beans",
      "black beans",
      "cannellini beans",
      "baked beans",
      "lentils",
      "red lentils",
      "green lentils",
      "chickpeas",
      "hummus",
      "split peas",
      "edamame",
      "butter beans",
      "haricot beans",
    ],
    notes:
      "Flagged for both blockage risk and high gas/wind in all ileostomy and post-surgical guidelines.",
  },
  {
    canonical: "mild veggie burger",
    zone: 3,
    category: "protein",
    subcategory: "processed",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 4,
    examples: [
      "mild veggie burger",
      "veggie patty",
      "rice potato patty",
      "simple veggie patty",
      "non bean veggie burger",
    ],
    notes:
      "Soft, non-bean veggie burger or patty built from potato, rice, or tofu rather than whole legumes or seeds.",
    osmoticEffect: "low",
    totalResidue: "low_moderate",
    fiberTotalApproxG: 2,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low_moderate",
    gasProducing: "possible",
    dryTexture: "low",
    irritantLoad: "low",
    highFatRisk: "low",
    lactoseRisk: "none",
  },

  // ── grains ──
  {
    canonical: "pizza",
    zone: 3,
    category: "carbohydrate",
    subcategory: "composite_dish",
    macros: ["carbohydrate", "fat", "protein"],
    group: "carbs",
    line: "grains",
    lineOrder: 21,
    examples: [
      "pizza",
      "cheese pizza",
      "pepperoni pizza",
      "margarita pizza",
      "takeaway pizza",
      "frozen pizza",
    ],
    notes: "High fat, often contains garlic, onion, and spiced toppings.",
  },
  {
    canonical: "wholegrain bread",
    zone: 3,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 22,
    examples: [
      "wholegrain bread",
      "wholemeal bread",
      "brown bread",
      "seeded bread",
      "multigrain bread",
      "rye bread",
      "sourdough",
      "brown toast",
      "wholewheat bread",
    ],
    notes:
      "High insoluble fibre. Move to Zone 3 when ready to reintroduce higher-fibre grains.",
  },
  {
    canonical: "brown rice",
    zone: 3,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 23,
    examples: [
      "brown rice",
      "wholegrain rice",
      "wild rice",
      "red rice",
      "black rice",
      "quinoa",
      "bulgur wheat",
      "freekeh",
      "farro",
    ],
    notes:
      "Higher fibre than white rice. Quinoa and bulgur also included here.",
  },
  {
    canonical: "sweet biscuit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 24,
    examples: [
      "sweet biscuit",
      "cookie",
      "cookies",
      "oreo",
      "custard cream",
      "bourbon biscuit",
      "jammie dodgers",
      "ginger nut",
      "lemon cream biscuit",
      "chocolate digestive",
      "choc chip cookies",
      "hobnob",
      "maryland cookie",
      "chips ahoy",
      "mikado",
      "coconut cream biscuits",
    ],
    notes:
      "Sweeter or richer biscuits and cookies. Higher sugar and fat than plain biscuits, with more filling, chocolate, or frosting risk.",
  },
  {
    canonical: "high-sugar refined snack",
    zone: 3,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 25,
    examples: [
      "high sugar refined snack",
      "biscoff",
      "biscoff biscuit",
      "biscoff biscuits",
      "lotus biscoff",
      "pastries",
      "confectionery",
      "flapjacks",
      "pop tarts",
      "rice krispie treats",
    ],
    notes:
      "Highly refined, sugary snack foods with a stronger osmotic-risk profile than plain biscuits. Includes pastries, flapjacks, and similar.",
    osmoticEffect: "moderate_high",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "moderate",
    lactoseRisk: "low",
  },
  {
    canonical: "non-sugar sweetener",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 11,
    examples: [
      "stevia",
      "sweetener",
      "artificial sweetener",
      "sucralose",
      "aspartame",
      "saccharin",
    ],
    notes:
      "Non-sugar sweeteners. Low residue, but keep separate from sugar because they behave differently and often appear in tiny add-on amounts.",
  },
  {
    canonical: "dark chocolate",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 26,
    examples: [
      "dark chocolate",
      "dark chocolate square",
      "dark chocolate 85% cocoa",
      "dark chocolate 90% cocoa",
    ],
    notes:
      "Separate from generic confectionery because the sugar load is lower, but cocoa solids and fat still make it a Zone 3 challenge.",
  },
  {
    canonical: "refined confectionery",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 27,
    examples: [
      "refined confectionery",
      "concentrated sweet food",
      "concentrated sweets",
      "chocolate",
      "milk chocolate",
      "white chocolate",
      "caramel",
      "caramel sweets",
      "candy",
      "sweets",
      "cough sweets",
      "halls honey & lemon cough sweets",
      "halls honey lemon cough sweets",
      "cake",
      "doughnut",
      "brownie",
      "rich dessert",
      "fudge",
      "toffee",
      "croissant",
      "danish pastry",
    ],
    notes:
      "Concentrated fructose and sugar load can cause osmotic diarrhea and high output. Small occasional amounts (tablespoon-level) may be tolerated — test from a stable baseline.",
  },

  // ── vegetables ──
  {
    canonical: "roasted potato",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 16,
    examples: [
      "roasted potato",
      "roast potato",
      "roasties",
      "oven roasted potato",
      "potatoes roasted in oil",
    ],
    notes:
      "Peeled, roasted with oil. Zone changed from 2 to 3 (roasted in fat).",
  },
  {
    canonical: "broccoli",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 17,
    examples: [
      "broccoli",
      "cooked broccoli",
      "steamed broccoli",
      "boiled broccoli",
      "broccoli florets",
      "well cooked broccoli",
    ],
    notes:
      "Zone changed from 2 to 3. Cruciferous, gassy, high output risk for anastomosis. Florets only, no stalks.",
  },
  {
    canonical: "green beans",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 18,
    examples: [
      "green beans",
      "french beans",
      "fine beans",
      "steamed green beans",
      "boiled green beans",
      "cooked green beans",
    ],
    notes: "Zone changed from 2 to 3. Stringy, gassy.",
  },
  {
    canonical: "leek",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 19,
    examples: [
      "leek",
      "cooked leek",
      "steamed leek",
      "boiled leek",
      "braised leek",
      "leek in sauce",
    ],
    notes: "Zone changed from 2 to 3. Basically an onion.",
  },
  {
    canonical: "onion",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 20,
    examples: [
      "onion",
      "onions",
      "raw onion",
      "cooked onion",
      "fried onion",
      "shallot",
      "spring onion",
      "scallion",
      "red onion",
      "white onion",
      "brown onion",
    ],
    notes:
      "Moved from condiment to vegetables. Gas, odour, and high output risk. Even cooked onion can cause problems early on.",
  },
  {
    canonical: "sweetcorn",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 21,
    examples: [
      "corn",
      "sweetcorn",
      "corn on the cob",
      "sweet corn",
      "corn kernels",
      "popcorn",
    ],
    notes:
      "Hulls pass through undigested — blockage risk even when cooked. Popcorn is also Zone 3.",
  },
  {
    canonical: "raw salad",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 22,
    examples: [
      "salad",
      "green salad",
      "mixed salad",
      "lettuce",
      "rocket",
      "arugula",
      "coleslaw",
      "raw cabbage",
      "beansprouts",
      "raw celery",
      "celery",
      "raw carrot",
      "grated carrot",
      "raw pepper",
      "raw mushrooms",
      "spinach salad",
    ],
    notes:
      "Raw vegetables are consistently Zone 3 in post-surgical guidelines regardless of type.",
  },
  {
    canonical: "mushrooms",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 23,
    examples: [
      "mushrooms",
      "button mushrooms",
      "field mushrooms",
      "portobello mushroom",
      "shiitake",
      "oyster mushroom",
      "cooked mushrooms",
      "fried mushrooms",
    ],
    notes:
      "Spongy texture with polysaccharides that can cause high output and gas. Zone 3 even when cooked.",
  },

  // ── fruit ──
  {
    canonical: "mandarin",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 8,
    examples: [
      "mandarin",
      "tangerine",
      "clementine",
      "mandarin segments",
      "satsuma",
    ],
    notes:
      "Fresh mandarin/tangerine/clementine. Zone 3 due to citrus acid. Canned mandarin has its own Zone 2 entry.",
  },
  {
    canonical: "kiwi",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 9,
    examples: ["kiwi", "kiwi fruit", "kiwifruit", "green kiwi", "golden kiwi"],
    notes:
      "Actinidin enzyme stimulates bowel motility. Seeds throughout flesh. Reliably causes increased output.",
  },
  {
    canonical: "citrus fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 10,
    examples: [
      "orange",
      "oranges",
      "whole orange",
      "orange segments",
      "orange juice",
      "fresh orange juice",
      "grapefruit",
      "pomelo",
    ],
    notes:
      "Pith and membrane are tough fibre. Concentrated vitamin C in juice can increase output. Mandarin segments (no pith) are Zone 3 instead.",
  },
  {
    canonical: "pineapple",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 11,
    examples: [
      "pineapple",
      "fresh pineapple",
      "canned pineapple",
      "pineapple chunks",
      "pineapple rings",
    ],
    notes: "Bromelain enzyme and fibrous flesh. Can be very stimulating.",
  },
  {
    canonical: "strawberries",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 12,
    examples: [
      "strawberries",
      "strawberry",
      "fresh strawberries",
      "blueberries",
      "raspberries",
      "blackberries",
      "mixed berries",
      "berries",
    ],
    notes:
      "Seeds on skin of strawberries and inside raspberries/blackberries. Small amounts of very ripe strawberries may be tolerated in late Zone 2, but keep to Zone 3 until stable.",
  },
  {
    canonical: "dried fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 13,
    examples: [
      "dried fruit",
      "raisins",
      "sultanas",
      "prunes",
      "dates",
      "dried apricots",
      "dried mango",
      "cranberries dried",
      "currants",
    ],
    notes:
      "Very concentrated fibre and fructose. Prunes especially well-known as bowel stimulants.",
  },
  {
    canonical: "exotic fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 14,
    examples: [
      "papaya",
      "dragon fruit",
      "passion fruit",
      "lychee",
      "guava",
      "jackfruit",
      "durian",
      "starfruit",
      "persimmon",
    ],
    notes: "Variable fibre, seeds, and enzymes. Trial one at a time.",
  },
  {
    canonical: "apple",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 16,
    examples: [
      "apple",
      "raw apple",
      "green apple",
      "red apple",
      "gala apple",
      "granny smith",
      "fuji apple",
      "braeburn",
      "apple with skin",
    ],
    notes:
      "Raw apple with skin — high insoluble fibre, firm texture. Zone 3. Peeled apple is Zone 2, stewed apple is Zone 1.",
  },

  // ── oils ──
  {
    canonical: "deep fried food",
    zone: 3,
    category: "fat",
    subcategory: "processed",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "oils",
    lineOrder: 3,
    examples: [
      "chips",
      "french fries",
      "deep fried food",
      "KFC",
      "fried chicken",
      "chicken nuggets",
      "onion rings",
      "tempura",
      "battered food",
    ],
    notes:
      "High fat from deep frying consistently causes diarrhea and high output. Chips/fries are Zone 3 regardless of base ingredient.",
  },

  // ── dairy_fats ──
  {
    canonical: "soft rind cheese",
    zone: 3,
    category: "dairy",
    subcategory: "cheese",
    macros: ["fat", "protein"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 7,
    examples: [
      "brie",
      "camembert",
      "gorgonzola",
      "blue cheese",
      "stilton",
      "roquefort",
      "soft rind cheese",
      "mould-ripened cheese",
    ],
    notes:
      "Very high fat. Can worsen loose stools. Trial small amounts from a stable Zone 2 baseline.",
  },
  {
    canonical: "double cream",
    zone: 3,
    category: "dairy",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 8,
    examples: [
      "double cream",
      "heavy cream",
      "whipped cream",
      "clotted cream",
      "whipping cream",
    ],
    notes:
      "Very high saturated fat. More concentrated than the Zone 2 single/cooking cream.",
  },

  // ── nuts_seeds ──
  {
    canonical: "nuts",
    zone: 3,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 3,
    examples: [
      "nuts",
      "peanuts",
      "almonds",
      "cashews",
      "walnuts",
      "pistachios",
      "hazelnuts",
      "pecans",
      "macadamia",
    ],
    notes:
      "Blockage risk from skins. Smooth nut butters have their own Zone 2 entry.",
  },
  {
    canonical: "seeds",
    zone: 3,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 4,
    examples: [
      "seeds",
      "sunflower seeds",
      "pumpkin seeds",
      "chia seeds",
      "flax seeds",
      "linseed",
      "sesame seeds",
      "hemp seeds",
      "poppy seeds",
    ],
    notes: "Blockage risk — small seeds can accumulate.",
  },
  {
    canonical: "guacamole",
    zone: 3,
    category: "fat",
    subcategory: "fruit",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 5,
    examples: ["guacamole", "guac", "avocado dip"],
    notes:
      "Contains avocado plus additional ingredients (onion, lime, cilantro, chili) that may irritate. Zone 3 because of the combined irritant load — test only when plain avocado is well tolerated.",
  },

  // ── sauces_condiments ──
  {
    canonical: "miso soup",
    zone: 3,
    category: "drink",
    subcategory: "broth",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 9,
    examples: [
      "miso soup",
      "plain miso soup",
      "miso broth",
      "strained miso soup",
    ],
    notes:
      "Fermented soy broth. Keep separate from clear stock because it carries soy solids/seasoning and is often served with tofu, seaweed, or scallion.",
  },
  {
    canonical: "hot sauce",
    zone: 3,
    category: "condiment",
    subcategory: "irritant",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 10,
    examples: [
      "hot sauce",
      "sriracha",
      "tabasco",
      "chili sauce",
      "sambal",
      "harissa",
      "peri peri sauce",
      "piri piri",
      "buffalo sauce",
    ],
    notes:
      "Capsaicin-based sauces. Direct GI irritant that increases motility and output even in small quantities.",
  },

  // ── herbs_spices ──
  {
    canonical: "black pepper",
    zone: 3,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 4,
    examples: [
      "black pepper",
      "lots of pepper",
      "freshly ground pepper",
      "cracked black pepper",
      "white pepper",
    ],
    notes:
      "Piperine in black pepper is a mild GI irritant. Zone changed from 2 to 3.",
  },
  {
    canonical: "garlic",
    zone: 3,
    category: "condiment",
    subcategory: "herb",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 5,
    examples: [
      "garlic",
      "garlic clove",
      "minced garlic",
      "garlic powder",
      "garlic paste",
      "roasted garlic",
      "garlic bread",
      "garlic butter",
    ],
    notes:
      "Moved to herbs_spices. Consistently flagged in ileostomy and bowel surgery guidelines for gas, odour, and high output.",
  },
  {
    canonical: "chili",
    zone: 3,
    category: "condiment",
    subcategory: "irritant",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 6,
    examples: [
      "chili",
      "chilli",
      "chili pepper",
      "fresh chili",
      "red chili",
      "green chili",
      "cayenne",
      "cayenne pepper",
      "chili flakes",
      "red pepper flakes",
      "hot pepper",
      "jalapeño",
      "scotch bonnet",
      "bird's eye chili",
    ],
    notes:
      "Capsaicin directly stimulates bowel motility and is the most consistent GI irritant in all guidelines.",
  },
  {
    canonical: "hot spice blend",
    zone: 3,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 7,
    examples: [
      "curry powder",
      "hot curry powder",
      "garam masala",
      "Chinese five spice",
      "ras el hanout",
      "za'atar",
      "berbere",
      "jerk seasoning",
      "cajun seasoning",
    ],
    notes:
      "Complex spice blends, especially those containing chili, garlic powder, or onion powder.",
  },

  // ── grains (additional) ──
  {
    canonical: "alcohol",
    zone: 3,
    category: "beverage",
    subcategory: "alcohol",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 29,
    examples: [
      "beer",
      "wine",
      "red wine",
      "white wine",
      "spirits",
      "vodka",
      "gin",
      "whisky",
      "rum",
      "cider",
      "lager",
      "ale",
      "prosecco",
      "champagne",
      "cocktail",
      "shandy",
      "pint",
    ],
    notes:
      "GI irritant that increases output and dehydrates. Beer/cider also carbonated. Wine contains tannins and acid. Spirits are concentrated irritants. Start with small amounts, always with food, never on an empty stomach. Very common patient question.",
  },
  {
    canonical: "carbonated drink",
    zone: 3,
    category: "beverage",
    subcategory: "fizzy_drink",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 30,
    examples: [
      "coke",
      "coca cola",
      "pepsi",
      "lemonade",
      "fizzy drink",
      "soda",
      "pop",
      "tonic water",
      "7up",
      "sprite",
      "fanta",
      "diet coke",
      "energy drink",
      "red bull",
      "monster",
      "irn bru",
      "ginger beer",
      "ginger ale",
    ],
    notes:
      "Gas from carbonation causes bloating and discomfort. Sugar versions have high osmotic load. Diet versions contain artificial sweeteners. Energy drinks combine caffeine + carbonation + sugar. Flat/degassed versions are better tolerated.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "coffee",
    zone: 3,
    category: "beverage",
    subcategory: "hot_drink",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 30,
    examples: [
      "coffee",
      "black coffee",
      "espresso",
      "americano",
      "latte",
      "cappuccino",
      "flat white",
      "instant coffee",
      "decaf coffee",
      "iced coffee",
      "cold brew",
    ],
    notes:
      "WARNING: Coffee stimulates colonic motility and gastric acid secretion. Can significantly increase output frequency. Even decaf has some effect. Introduce very cautiously — small amounts, not on an empty stomach. Many patients find coffee is the last thing they can reintroduce.",
  },

  // ── fruit (additional) ──
  {
    canonical: "fig",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 19,
    examples: [
      "fig",
      "figs",
      "fresh fig",
      "dried fig",
      "fig roll",
      "fig bar",
      "fig newton",
    ],
    notes:
      "Very high fiber and full of small seeds. Both fresh and dried are Zone 3. Dried figs are especially high in concentrated fiber and fructose. A common natural laxative.",
  },
  {
    canonical: "pomegranate",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 20,
    examples: [
      "pomegranate",
      "pomegranate seeds",
      "pomegranate arils",
      "pomegranate juice",
    ],
    notes:
      "Seeds are the defining characteristic — hundreds of small seeds per fruit. Pomegranate juice (strained) may be tolerated earlier but whole seeds are a blockage concern.",
  },

  // ── nuts_seeds (additional) ──
  {
    canonical: "coconut",
    zone: 3,
    category: "fat",
    subcategory: "nut",
    macros: ["fat"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 6,
    examples: [
      "coconut",
      "desiccated coconut",
      "coconut flakes",
      "coconut cream",
      "canned coconut milk",
      "coconut oil",
      "coconut butter",
      "fresh coconut",
      "toasted coconut",
    ],
    notes:
      "High fat and fiber. Desiccated coconut is very high fiber. Canned coconut milk (thick, for cooking) is high fat — distinct from carton coconut milk (Zone 2 plant milk). Common in baked goods and curries.",
  },
];

type FoodEntryEnrichment = FoodDigestionMetadata & {
  addExamples?: ReadonlyArray<string>;
};

const CLEAR_LIQUID_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const SMOOTH_LIQUID_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low_moderate",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low",
  lactoseRisk: "low",
};

const REFINED_GRAIN_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "low",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const DRY_REFINED_GRAIN_PROFILE: FoodDigestionMetadata = {
  ...REFINED_GRAIN_PROFILE,
  dryTexture: "yes",
};

const PORRIDGE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 2,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low_moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "low",
};

const PUDDING_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low_moderate",
  lactoseRisk: "low_moderate",
};

const ROOT_VEG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 2.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const LOW_FIBER_VEG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low_moderate",
  fiberTotalApproxG: 2,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const LEAN_PROTEIN_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const DRY_HEAT_PROTEIN_PROFILE: FoodDigestionMetadata = {
  ...LEAN_PROTEIN_PROFILE,
  dryTexture: "low",
};

const EGG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const MILK_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low_moderate",
  lactoseRisk: "moderate",
};

const YOGURT_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low_moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "moderate",
};

const SOFT_CHEESE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low_moderate",
  lactoseRisk: "low_moderate",
};

const HARD_CHEESE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "low",
  irritantLoad: "low",
  highFatRisk: "moderate",
  lactoseRisk: "low",
};

const OIL_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "moderate",
  lactoseRisk: "none",
};

const BUTTER_PROFILE: FoodDigestionMetadata = {
  ...OIL_PROFILE,
  highFatRisk: "moderate",
  lactoseRisk: "low",
};

const CREAM_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "high",
  lactoseRisk: "moderate",
};

const SOFT_FRUIT_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "low_moderate",
  fiberTotalApproxG: 2.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const MELON_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "low",
  fiberTotalApproxG: 1,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const FERMENTED_DAIRY_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low_moderate",
  highFatRisk: "low",
  lactoseRisk: "moderate",
};

const SWEET_SNACK_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "low",
};

const DEEP_FRIED_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "yes",
  irritantLoad: "low",
  highFatRisk: "high",
  lactoseRisk: "none",
};

const FOOD_ENTRY_ENRICHMENTS: ReadonlyMap<string, FoodEntryEnrichment> =
  new Map([
    [
      "clear broth",
      {
        addExamples: [
          "clear vegetable broth",
          "clear chicken broth",
          "clear beef broth",
        ],
        ...CLEAR_LIQUID_PROFILE,
      },
    ],
    ["gelatin dessert", { ...SWEET_SNACK_PROFILE }],
    [
      "smooth soup",
      {
        addExamples: [
          "clear strained tomato broth",
          "strained vegetable soup",
          "carrot and potato soup",
          "strained chicken puree soup",
        ],
        ...SMOOTH_LIQUID_PROFILE,
      },
    ],
    ["boiled fish", { ...LEAN_PROTEIN_PROFILE }],
    ["boiled white meat", { ...LEAN_PROTEIN_PROFILE }],
    ["plain yogurt", { addExamples: ["strained yogurt"], ...YOGURT_PROFILE }],
    ["egg", { ...EGG_PROFILE }],
    ["milk", { ...MILK_PROFILE }],
    [
      "cottage cheese",
      {
        ...SOFT_CHEESE_PROFILE,
      },
    ],
    ["custard", { ...PUDDING_PROFILE }],
    ["white rice", { ...REFINED_GRAIN_PROFILE }],
    [
      "toast",
      {
        ...DRY_REFINED_GRAIN_PROFILE,
        highFatRisk: "low",
      },
    ],
    ["white bread", { ...REFINED_GRAIN_PROFILE }],
    [
      "white pasta",
      {
        addExamples: ["plain macaroni", "plain spaghetti"],
        ...REFINED_GRAIN_PROFILE,
      },
    ],
    ["rice cracker", { ...DRY_REFINED_GRAIN_PROFILE }],
    ["porridge", { ...PORRIDGE_PROFILE }],
    ["noodles", { ...REFINED_GRAIN_PROFILE }],
    [
      "rice pudding",
      { addExamples: ["tapioca pudding", "sago pudding"], ...PUDDING_PROFILE },
    ],
    ["mashed potato", { ...ROOT_VEG_PROFILE }],
    ["mashed root vegetable", { ...ROOT_VEG_PROFILE }],
    ["ripe banana", { ...SOFT_FRUIT_PROFILE }],
    ["stewed apple", { ...SOFT_FRUIT_PROFILE }],
    [
      "canned pear",
      {
        addExamples: ["peeled soft pear", "pear puree"],
        ...SOFT_FRUIT_PROFILE,
      },
    ],
    [
      "canned peach",
      {
        addExamples: [
          "peeled ripe peach",
          "peeled ripe nectarine",
          "peeled ripe apricot",
          "canned apricots in juice",
        ],
        ...SOFT_FRUIT_PROFILE,
      },
    ],
    ["olive oil", { ...OIL_PROFILE }],
    [
      "grilled white meat",
      {
        addExamples: [
          "grilled chicken breast lightly oiled",
          "baked chicken breast no heavy crust",
          "grilled turkey breast",
          "roast turkey breast",
        ],
        ...DRY_HEAT_PROTEIN_PROFILE,
      },
    ],
    [
      "ham",
      {
        ...DRY_HEAT_PROTEIN_PROFILE,
        irritantLoad: "low_moderate",
        highFatRisk: "low_moderate",
      },
    ],
    [
      "cooked fish",
      {
        addExamples: [
          "baked cod light oil",
          "baked haddock",
          "grilled hake",
          "grilled sole",
        ],
        ...DRY_HEAT_PROTEIN_PROFILE,
      },
    ],
    [
      "buttered scrambled eggs",
      { ...EGG_PROFILE, dryTexture: "low", highFatRisk: "low_moderate" },
    ],
    ["flavoured yogurt", { ...YOGURT_PROFILE, osmoticEffect: "moderate" }],
    ["milk pudding", { ...PUDDING_PROFILE }],
    [
      "boiled carrot",
      { addExamples: ["boiled carrots"], ...LOW_FIBER_VEG_PROFILE },
    ],
    [
      "baked potato",
      {
        addExamples: ["peeled potato pieces"],
        ...ROOT_VEG_PROFILE,
      },
    ],
    [
      "sweet potato",
      { addExamples: ["boiled sweet potato"], ...ROOT_VEG_PROFILE },
    ],
    [
      "cooked pumpkin",
      { addExamples: ["boiled butternut squash"], ...LOW_FIBER_VEG_PROFILE },
    ],
    [
      "courgette",
      {
        addExamples: [
          "boiled peeled courgette",
          "boiled peeled zucchini",
          "boiled peeled marrow",
        ],
        ...LOW_FIBER_VEG_PROFILE,
      },
    ],
    [
      "swede",
      { addExamples: ["boiled swede", "boiled turnip"], ...ROOT_VEG_PROFILE },
    ],
    ["parsnip", { ...ROOT_VEG_PROFILE }],
    ["melon", { ...MELON_PROFILE }],
    ["ripe mango", { ...SOFT_FRUIT_PROFILE }],
    ["peeled apple", { ...SOFT_FRUIT_PROFILE }],
    ["vegetable oil", { ...OIL_PROFILE }],
    ["butter", { ...BUTTER_PROFILE }],
    [
      "non-sugar sweetener",
      {
        osmoticEffect: "none",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "none",
        highFatRisk: "none",
        lactoseRisk: "none",
      },
    ],
    ["cream cheese", { ...SOFT_CHEESE_PROFILE }],
    [
      "hard cheese",
      {
        addExamples: [
          "mild sliced cheese",
          "grated mild cheese",
          "grated mild cheese on pasta",
          "melted cheese on potato",
        ],
        ...HARD_CHEESE_PROFILE,
      },
    ],
    ["cream", { ...CREAM_PROFILE }],
    [
      "plain ice cream",
      {
        osmoticEffect: "moderate",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "none",
        highFatRisk: "moderate",
        lactoseRisk: "moderate",
      },
    ],
    [
      "tofu",
      {
        addExamples: [
          "firm tofu cubes in mild sauce",
          "plain tofu stir fry with peeled soft veg",
        ],
        ...SOFT_CHEESE_PROFILE,
        highFatRisk: "low",
        lactoseRisk: "none",
      },
    ],
    ["kefir", { addExamples: ["plain kefir"], ...FERMENTED_DAIRY_PROFILE }],
    [
      "sweet biscuit",
      {
        osmoticEffect: "moderate",
        totalResidue: "low",
        fiberTotalApproxG: 1.5,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "yes",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    [
      "dark chocolate",
      {
        osmoticEffect: "low_moderate",
        totalResidue: "low",
        fiberTotalApproxG: 2,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "low",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    [
      "refined confectionery",
      {
        osmoticEffect: "high",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    ["deep fried food", { ...DEEP_FRIED_PROFILE }],
  ]);

function mergeExamples(
  existing: ReadonlyArray<string>,
  additions: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const seen = new Set(existing.map((example) => example.toLowerCase()));
  const merged = [...existing];

  for (const addition of additions) {
    const key = addition.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(addition);
    }
  }

  return merged;
}

function applyFoodEntryEnrichment(entry: FoodRegistryEntry): FoodRegistryEntry {
  const enrichment = FOOD_ENTRY_ENRICHMENTS.get(entry.canonical);
  if (!enrichment) return entry;

  const { addExamples, ...metadata } = enrichment;

  return {
    ...entry,
    ...(addExamples
      ? { examples: mergeExamples(entry.examples, addExamples) }
      : {}),
    ...metadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined registry
// ─────────────────────────────────────────────────────────────────────────────

const BASE_FOOD_REGISTRY: ReadonlyArray<FoodRegistryEntry> = [
  ...ZONE_1A,
  ...ZONE_1B,
  ...ZONE_2,
  ...ZONE_3,
];

export const FOOD_REGISTRY: ReadonlyArray<FoodRegistryEntry> =
  BASE_FOOD_REGISTRY.map(applyFoodEntryEnrichment);

function isFoodLineInGroup(group: FoodGroup, line: FoodLine): boolean {
  return (FOOD_GROUP_LINES[group] as ReadonlyArray<FoodLine>).includes(line);
}

function assertFoodRegistryInvariants(
  registry: ReadonlyArray<FoodRegistryEntry>,
): void {
  const canonicals = new Set<string>();
  const lineOrders = new Map<FoodLine, Map<number, string>>();

  for (const entry of registry) {
    if (canonicals.has(entry.canonical)) {
      throw new Error(
        `Duplicate canonical found in FOOD_REGISTRY: ${entry.canonical}`,
      );
    }
    canonicals.add(entry.canonical);

    if (entry.zone === 1 && entry.subzone === undefined) {
      throw new Error(
        `Zone 1 registry entry is missing a subzone: ${entry.canonical}`,
      );
    }
    if (entry.zone !== 1 && entry.subzone !== undefined) {
      throw new Error(
        `Only Zone 1 entries may declare subzone: ${entry.canonical}`,
      );
    }
    if (!isFoodLineInGroup(entry.group, entry.line)) {
      throw new Error(
        `Invalid group/line combination in FOOD_REGISTRY: ${entry.canonical} (${entry.group} -> ${entry.line})`,
      );
    }
    if (!Number.isInteger(entry.lineOrder) || entry.lineOrder < 0) {
      throw new Error(
        `Invalid lineOrder for FOOD_REGISTRY entry "${entry.canonical}": ${entry.lineOrder}`,
      );
    }
    if (entry.examples.length === 0) {
      throw new Error(
        `Registry entry must define at least one example: ${entry.canonical}`,
      );
    }

    const lineOrderMap =
      lineOrders.get(entry.line) ?? new Map<number, string>();
    const existingLineOrderOwner = lineOrderMap.get(entry.lineOrder);
    if (existingLineOrderOwner && existingLineOrderOwner !== entry.canonical) {
      throw new Error(
        `Duplicate lineOrder ${entry.lineOrder} on ${entry.line}: ${existingLineOrderOwner} and ${entry.canonical}`,
      );
    }
    lineOrderMap.set(entry.lineOrder, entry.canonical);
    lineOrders.set(entry.line, lineOrderMap);
  }
}

assertFoodRegistryInvariants(FOOD_REGISTRY);
