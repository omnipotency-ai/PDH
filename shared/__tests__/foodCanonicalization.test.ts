import { describe, expect, it } from "vitest";
import {
  canonicalizeKnownFoodName,
  FOOD_REGISTRY,
  getFoodDigestionMetadata,
  getFoodEntry,
  getLinesByGroup,
} from "../foodCanonicalization";
import { normalizeFoodName } from "../foodNormalize";

describe("canonicalizeKnownFoodName", () => {
  it("has no duplicate normalized aliases across canonicals", () => {
    const aliases = new Map<string, string>();

    for (const entry of FOOD_REGISTRY) {
      for (const candidate of [entry.canonical, ...entry.examples]) {
        const normalized = normalizeFoodName(candidate);
        if (!normalized) continue;
        const existing = aliases.get(normalized);
        if (existing && existing !== entry.canonical) {
          throw new Error(
            `Duplicate normalized alias "${normalized}" maps to both "${existing}" and "${entry.canonical}"`,
          );
        }
        aliases.set(normalized, entry.canonical);
      }
    }
  });

  it("keeps lineOrder unique within each line", () => {
    const seen = new Map<string, Map<number, string>>();

    for (const entry of FOOD_REGISTRY) {
      const byLine = seen.get(entry.line) ?? new Map<number, string>();
      const existing = byLine.get(entry.lineOrder);
      if (existing && existing !== entry.canonical) {
        throw new Error(
          `Duplicate lineOrder ${entry.lineOrder} on ${entry.line}: ${existing} and ${entry.canonical}`,
        );
      }
      byLine.set(entry.lineOrder, entry.canonical);
      seen.set(entry.line, byLine);
    }
  });

  it("keeps every registry line attached to its declared group", () => {
    for (const entry of FOOD_REGISTRY) {
      expect(getLinesByGroup(entry.group)).toContain(entry.line);
    }
  });

  // ─── Egg collapsing ──────────────────────────────────────────────────────
  // All no-fat egg preparations collapse to "egg".
  // Fried egg (added fat) is a separate canonical.

  describe("eggs", () => {
    it("collapses all no-fat preparations to egg", () => {
      expect(canonicalizeKnownFoodName("egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("boiled egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("soft boiled egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("hard boiled egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("poached egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("scrambled egg")).toBe("egg");
      expect(canonicalizeKnownFoodName("scrambled eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("omelette")).toBe("egg");
      expect(canonicalizeKnownFoodName("omelet")).toBe("egg");
      expect(canonicalizeKnownFoodName("plain omelette")).toBe("egg");
      expect(canonicalizeKnownFoodName("frittata")).toBe("egg");
      expect(canonicalizeKnownFoodName("egg white")).toBe("egg");
    });

    it("strips leading quantity words before matching", () => {
      expect(canonicalizeKnownFoodName("three scrambled eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("six poached eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("two egg omelette")).toBe("egg");
      expect(canonicalizeKnownFoodName("a boiled egg")).toBe("egg");
    });

    it("keeps fried egg as a separate canonical", () => {
      expect(canonicalizeKnownFoodName("fried egg")).toBe("fried egg");
      expect(canonicalizeKnownFoodName("sunny side up")).toBe("fried egg");
      expect(canonicalizeKnownFoodName("over easy")).toBe("fried egg");
    });
  });

  // ─── Zone 1 foods ────────────────────────────────────────────────────────

  describe("Zone 1 — liquids", () => {
    it("resolves broth variations", () => {
      expect(canonicalizeKnownFoodName("chicken stock")).toBe("clear broth");
      expect(canonicalizeKnownFoodName("beef broth")).toBe("clear broth");
      expect(canonicalizeKnownFoodName("bone broth")).toBe("clear broth");
      expect(canonicalizeKnownFoodName("bouillon")).toBe("clear broth");
    });

    it("resolves gelatin dessert variations", () => {
      expect(canonicalizeKnownFoodName("jelly")).toBe("gelatin dessert");
      expect(canonicalizeKnownFoodName("gelatin")).toBe("gelatin dessert");
      expect(canonicalizeKnownFoodName("jello")).toBe("gelatin dessert");
    });

    it("resolves smooth soups", () => {
      expect(canonicalizeKnownFoodName("blended soup")).toBe("smooth soup");
      expect(canonicalizeKnownFoodName("pureed soup")).toBe("smooth soup");
      expect(canonicalizeKnownFoodName("butternut squash soup")).toBe(
        "smooth soup",
      );
    });
  });

  describe("Zone 1 — soft solids", () => {
    it("collapses all white rice varieties", () => {
      expect(canonicalizeKnownFoodName("rice")).toBe("white rice");
      expect(canonicalizeKnownFoodName("basmati rice")).toBe("white rice");
      expect(canonicalizeKnownFoodName("jasmine rice")).toBe("white rice");
      expect(canonicalizeKnownFoodName("congee")).toBe("white rice");
    });

    it("keeps toast as its own canonical, separate from white bread", () => {
      expect(canonicalizeKnownFoodName("toast")).toBe("toast");
      expect(canonicalizeKnownFoodName("white toast")).toBe("toast");
      expect(canonicalizeKnownFoodName("dry toast")).toBe("toast");
      expect(canonicalizeKnownFoodName("two slices of toast")).toBe("toast");
      // white bread is a separate canonical
      expect(canonicalizeKnownFoodName("white bread")).toBe("white bread");
      expect(canonicalizeKnownFoodName("white roll")).toBe("white bread");
    });

    it("routes generic crackers to crispy cracker unless they are explicit rice crackers", () => {
      expect(canonicalizeKnownFoodName("plain cracker")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("rice crackers")).toBe("rice cracker");
      expect(canonicalizeKnownFoodName("plain rice crackers")).toBe(
        "rice cracker",
      );
    });

    it("collapses mashed and pureed potato", () => {
      expect(canonicalizeKnownFoodName("mashed potato")).toBe("mashed potato");
      expect(canonicalizeKnownFoodName("mash")).toBe("mashed potato");
      expect(canonicalizeKnownFoodName("potato puree")).toBe("mashed potato");
    });

    it("resolves boiled white meat (moist heat chicken/turkey)", () => {
      expect(canonicalizeKnownFoodName("poached chicken")).toBe(
        "boiled white meat",
      );
      expect(canonicalizeKnownFoodName("boiled chicken")).toBe(
        "boiled white meat",
      );
      expect(canonicalizeKnownFoodName("steamed chicken")).toBe(
        "boiled white meat",
      );
      expect(canonicalizeKnownFoodName("boiled turkey")).toBe(
        "boiled white meat",
      );
    });

    it("resolves boiled fish (moist heat fish)", () => {
      expect(canonicalizeKnownFoodName("boiled fish")).toBe("boiled fish");
      expect(canonicalizeKnownFoodName("steamed fish")).toBe("boiled fish");
      expect(canonicalizeKnownFoodName("poached cod")).toBe("boiled fish");
    });

    it("resolves yogurt spellings and varieties", () => {
      expect(canonicalizeKnownFoodName("yoghurt")).toBe("plain yogurt");
      expect(canonicalizeKnownFoodName("natural yogurt")).toBe("plain yogurt");
      expect(canonicalizeKnownFoodName("greek yogurt")).toBe("plain yogurt");
    });

    it("resolves custard, noodles, and rice pudding", () => {
      expect(canonicalizeKnownFoodName("custard")).toBe("custard");
      expect(canonicalizeKnownFoodName("egg noodles")).toBe("noodles");
      expect(canonicalizeKnownFoodName("rice pudding")).toBe("rice pudding");
    });

    it("resolves the new soft grain additions", () => {
      expect(canonicalizeKnownFoodName("plain couscous")).toBe("soft couscous");
      expect(canonicalizeKnownFoodName("fine couscous")).toBe("soft couscous");
      expect(canonicalizeKnownFoodName("plain polenta")).toBe("soft polenta");
      expect(canonicalizeKnownFoodName("fine polenta")).toBe("soft polenta");
      expect(canonicalizeKnownFoodName("clear whey")).toBe("protein drink");
    });

    it("resolves pureed/mashed root vegetables", () => {
      expect(canonicalizeKnownFoodName("pureed pumpkin")).toBe(
        "mashed root vegetable",
      );
      expect(canonicalizeKnownFoodName("mashed butternut squash")).toBe(
        "mashed root vegetable",
      );
      expect(canonicalizeKnownFoodName("cooked carrot")).toBe(
        "mashed root vegetable",
      );
    });
  });

  // ─── Zone 2 foods ────────────────────────────────────────────────────────

  describe("Zone 2 — expanded diet", () => {
    it("keeps grilled white meat distinct from boiled white meat", () => {
      expect(canonicalizeKnownFoodName("grilled chicken")).toBe(
        "grilled white meat",
      );
      expect(canonicalizeKnownFoodName("baked chicken")).toBe(
        "grilled white meat",
      );
      expect(canonicalizeKnownFoodName("roasted chicken")).toBe(
        "grilled white meat",
      );
      expect(canonicalizeKnownFoodName("air fried chicken")).toBe(
        "grilled white meat",
      );
    });

    it("resolves oily fish variations", () => {
      expect(canonicalizeKnownFoodName("salmon")).toBe("oily fish");
      expect(canonicalizeKnownFoodName("baked salmon")).toBe("oily fish");
      expect(canonicalizeKnownFoodName("grilled salmon")).toBe("oily fish");
    });

    it("resolves cooked fish (dry-heat white fish)", () => {
      expect(canonicalizeKnownFoodName("baked fish")).toBe("cooked fish");
      expect(canonicalizeKnownFoodName("grilled fish")).toBe("cooked fish");
      expect(canonicalizeKnownFoodName("baked cod")).toBe("cooked fish");
    });

    it("resolves red meat", () => {
      expect(canonicalizeKnownFoodName("lean mince")).toBe("lean minced meat");
      expect(canonicalizeKnownFoodName("lean minced beef")).toBe(
        "lean minced meat",
      );
      expect(canonicalizeKnownFoodName("lean pork")).toBe("red meat");
      expect(canonicalizeKnownFoodName("beef")).toBe("red meat");
    });

    it("resolves pasta variations", () => {
      expect(canonicalizeKnownFoodName("pasta")).toBe("white pasta");
      expect(canonicalizeKnownFoodName("spaghetti")).toBe("white pasta");
      expect(canonicalizeKnownFoodName("penne")).toBe("white pasta");
    });

    it("resolves crispy cracker aliases to the new canonical", () => {
      expect(canonicalizeKnownFoodName("Quelitas")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("Chelitas")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("Quelitos")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("TUC")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("Ritz")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("water biscuits")).toBe(
        "crispy cracker",
      );
      expect(canonicalizeKnownFoodName("cream crackers")).toBe(
        "crispy cracker",
      );
      expect(canonicalizeKnownFoodName("breadsticks")).toBe("crispy cracker");
      expect(canonicalizeKnownFoodName("baked bread snacks")).toBe(
        "crispy cracker",
      );
    });

    it("resolves the new snack stations", () => {
      expect(canonicalizeKnownFoodName("Maria Biscuits")).toBe("plain biscuit");
      expect(canonicalizeKnownFoodName("Biscuits")).toBe("plain biscuit");
      expect(canonicalizeKnownFoodName("Biscoff")).toBe(
        "high-sugar refined snack",
      );
      expect(canonicalizeKnownFoodName("cornflakes")).toBe("low-fiber cereal");
      expect(canonicalizeKnownFoodName("plain crisps")).toBe(
        "basic savoury snack",
      );
      expect(canonicalizeKnownFoodName("cheese puffs")).toBe(
        "basic savoury snack",
      );
      expect(canonicalizeKnownFoodName("gummy bears")).toBe(
        "low-fiber sweet snack",
      );
      expect(canonicalizeKnownFoodName("plain milk chocolate bar")).toBe(
        "simple chocolate snack",
      );
    });

    it("resolves Zone 2 vegetables", () => {
      expect(canonicalizeKnownFoodName("boiled carrot")).toBe("boiled carrot");
      expect(canonicalizeKnownFoodName("steamed carrot")).toBe("boiled carrot");
      expect(canonicalizeKnownFoodName("cooked pumpkin")).toBe(
        "cooked pumpkin",
      );
      expect(canonicalizeKnownFoodName("courgette")).toBe("courgette");
      expect(canonicalizeKnownFoodName("zucchini")).toBe("courgette");
      expect(canonicalizeKnownFoodName("swede")).toBe("swede");
      expect(canonicalizeKnownFoodName("rutabaga")).toBe("swede");
      expect(canonicalizeKnownFoodName("canned tomato")).toBe("cooked tomato");
      expect(canonicalizeKnownFoodName("passata")).toBe("cooked tomato");
    });

    it("resolves Zone 2 fruit", () => {
      expect(canonicalizeKnownFoodName("honeydew melon")).toBe("melon");
      expect(canonicalizeKnownFoodName("watermelon")).toBe("melon");
      expect(canonicalizeKnownFoodName("ripe mango")).toBe("ripe mango");
    });

    it("resolves smooth nut butter", () => {
      expect(canonicalizeKnownFoodName("nut butter")).toBe("smooth nut butter");
      expect(canonicalizeKnownFoodName("peanut butter")).toBe(
        "smooth nut butter",
      );
      expect(canonicalizeKnownFoodName("almond butter")).toBe(
        "smooth nut butter",
      );
    });

    it("resolves added sauces and spreads", () => {
      expect(canonicalizeKnownFoodName("gravy")).toBe("gravy");
      expect(canonicalizeKnownFoodName("honey")).toBe("honey");
      expect(canonicalizeKnownFoodName("grape jelly")).toBe("jam");
      expect(canonicalizeKnownFoodName("jam")).toBe("jam");
      expect(canonicalizeKnownFoodName("tofu")).toBe("tofu");
    });
  });

  // ─── Zone 3 foods ────────────────────────────────────────────────────────

  describe("Zone 3 — experimental", () => {
    it("resolves key irritants", () => {
      expect(canonicalizeKnownFoodName("garlic")).toBe("garlic");
      expect(canonicalizeKnownFoodName("onion")).toBe("onion");
      expect(canonicalizeKnownFoodName("chili")).toBe("chili");
      expect(canonicalizeKnownFoodName("chili pepper")).toBe("chili");
      expect(canonicalizeKnownFoodName("cayenne")).toBe("chili");
      expect(canonicalizeKnownFoodName("sriracha")).toBe("hot sauce");
    });

    it("resolves legumes", () => {
      expect(canonicalizeKnownFoodName("lentils")).toBe("legumes");
      expect(canonicalizeKnownFoodName("chickpeas")).toBe("legumes");
      expect(canonicalizeKnownFoodName("baked beans")).toBe("legumes");
      expect(canonicalizeKnownFoodName("hummus")).toBe("legumes");
    });

    it("resolves fried/fast food", () => {
      expect(canonicalizeKnownFoodName("fish and chips")).toBe("battered fish");
      expect(canonicalizeKnownFoodName("KFC")).toBe("deep fried food");
      expect(canonicalizeKnownFoodName("chicken nuggets")).toBe(
        "deep fried food",
      );
      expect(canonicalizeKnownFoodName("hamburger")).toBe("fast food burger");
      expect(canonicalizeKnownFoodName("Big Mac")).toBe("fast food burger");
      expect(canonicalizeKnownFoodName("battered fish")).toBe("battered fish");
    });

    it("resolves processed meat", () => {
      expect(canonicalizeKnownFoodName("sausage")).toBe("processed meat");
      expect(canonicalizeKnownFoodName("chorizo")).toBe("processed meat");
      expect(canonicalizeKnownFoodName("salami")).toBe("processed meat");
    });

    it("resolves cooked ham to ham", () => {
      expect(canonicalizeKnownFoodName("ham")).toBe("ham");
      expect(canonicalizeKnownFoodName("boiled ham")).toBe("ham");
      expect(canonicalizeKnownFoodName("sliced ham")).toBe("ham");
    });

    it("resolves curry dish", () => {
      expect(canonicalizeKnownFoodName("chicken tikka masala")).toBe(
        "curry dish",
      );
      expect(canonicalizeKnownFoodName("korma")).toBe("curry dish");
      expect(canonicalizeKnownFoodName("vindaloo")).toBe("curry dish");
    });

    it("keeps stir fry distinct from curry dish", () => {
      expect(canonicalizeKnownFoodName("stir fry")).toBe("stir fry");
      expect(canonicalizeKnownFoodName("vegetable stir fry")).toBe("stir fry");
    });

    it("resolves kefir", () => {
      expect(canonicalizeKnownFoodName("kefir")).toBe("kefir");
      expect(canonicalizeKnownFoodName("milk kefir")).toBe("kefir");
    });

    it("resolves Zone 3 fruit", () => {
      expect(canonicalizeKnownFoodName("kiwi")).toBe("kiwi");
      expect(canonicalizeKnownFoodName("kiwi fruit")).toBe("kiwi");
      expect(canonicalizeKnownFoodName("orange")).toBe("citrus fruit");
      expect(canonicalizeKnownFoodName("pineapple")).toBe("pineapple");
      expect(canonicalizeKnownFoodName("prunes")).toBe("dried fruit");
      expect(canonicalizeKnownFoodName("raisins")).toBe("dried fruit");
    });

    it("resolves mandarin (Zone 3)", () => {
      expect(canonicalizeKnownFoodName("mandarin")).toBe("mandarin");
      expect(canonicalizeKnownFoodName("clementine")).toBe("mandarin");
    });
  });

  describe("alias uniqueness for key strings", () => {
    it("maps chili to the chili canonical only", () => {
      expect(canonicalizeKnownFoodName("chili")).toBe("chili");
    });

    it("resolves rice cake to the rice cracker canonical", () => {
      expect(canonicalizeKnownFoodName("rice cake")).toBe("rice cracker");
    });

    it("keeps mild herb tied to the mild herb canonical", () => {
      expect(canonicalizeKnownFoodName("mild herb")).toBe("mild herb");
    });

    it("does not leave misleading aliases on the wrong canonicals", () => {
      expect(canonicalizeKnownFoodName("nut butter")).not.toBe("nuts");
      expect(canonicalizeKnownFoodName("stir fry")).not.toBe("curry dish");
    });
  });

  // ─── normalizeFoodName — standalone unit stripping ──────────────────────────

  describe("normalizeFoodName — standalone unit stripping", () => {
    // Unit abbreviations without digits
    it("strips leading 'g' unit", () => {
      expect(normalizeFoodName("G Pasta")).toBe("pasta");
      expect(normalizeFoodName("g pasta")).toBe("pasta");
    });
    it("strips leading 'ml' unit", () => {
      expect(normalizeFoodName("ml juice")).toBe("juice");
    });
    it("strips leading 'tsp' unit", () => {
      expect(normalizeFoodName("tsp jam")).toBe("jam");
    });

    // Full unit words without digits
    it("strips leading 'grams of'", () => {
      expect(normalizeFoodName("Grams of Cottage Cheese")).toBe(
        "cottage cheese",
      );
    });
    it("strips leading 'grams' without 'of'", () => {
      expect(normalizeFoodName("Grams Turkey")).toBe("turkey");
    });
    it("strips leading 'teaspoon of'", () => {
      expect(normalizeFoodName("Teaspoon Of Jam")).toBe("jam");
    });
    it("strips leading 'tablespoon of'", () => {
      expect(normalizeFoodName("Tablespoon of butter")).toBe("butter");
    });
    it("strips leading 'cup of'", () => {
      expect(normalizeFoodName("Cup of rice")).toBe("rice");
    });
    it("strips leading 'slice of'", () => {
      expect(normalizeFoodName("Slice of bread")).toBe("bread");
    });

    // Leading punctuation
    it("strips leading slash + digits + unit", () => {
      expect(normalizeFoodName("/2tsp jam")).toBe("jam");
    });
    it("strips leading punctuation", () => {
      expect(normalizeFoodName("/jam")).toBe("jam");
      expect(normalizeFoodName("-pasta")).toBe("pasta");
      expect(normalizeFoodName("*rice")).toBe("rice");
    });

    // Hyphens, filler phrases, and trailing punctuation
    it("normalizes hyphens and strips lactose free", () => {
      expect(normalizeFoodName("lactose-free cream cheese")).toBe(
        "cream cheese",
      );
    });
    it("strips trailing periods", () => {
      expect(normalizeFoodName("cream cheese.")).toBe("cream cheese");
    });
    it("handles combined punctuation issues", () => {
      expect(normalizeFoodName("Lactose-Free Cream Cheese.")).toBe(
        "cream cheese",
      );
    });
    it("strips percentage patterns", () => {
      expect(normalizeFoodName("dark chocolate 85% cocoa")).toBe(
        "dark chocolate",
      );
    });
    it("strips word-form number quantities", () => {
      expect(normalizeFoodName("six tuck crackers")).toBe("tuck cracker");
      expect(normalizeFoodName("one banana")).toBe("banana");
      expect(normalizeFoodName("four cheeses")).toBe("cheese");
    });
  });

  // ─── Registry gap coverage ──────────────────────────────────────────────────

  describe("registry — missing food coverage", () => {
    it("resolves bare turkey to grilled white meat", () => {
      expect(canonicalizeKnownFoodName("turkey")).toBe("grilled white meat");
    });
    it("resolves turkey slices to grilled white meat", () => {
      expect(canonicalizeKnownFoodName("turkey slices")).toBe(
        "grilled white meat",
      );
    });
    it("resolves roast turkey to grilled white meat", () => {
      expect(canonicalizeKnownFoodName("roast turkey")).toBe(
        "grilled white meat",
      );
    });

    it("resolves bare apple to apple (Zone 3)", () => {
      expect(canonicalizeKnownFoodName("apple")).toBe("apple");
    });
    it("resolves peeled apple (Zone 2)", () => {
      expect(canonicalizeKnownFoodName("peeled apple")).toBe("peeled apple");
    });

    it("resolves baguette to white bread", () => {
      expect(canonicalizeKnownFoodName("baguette")).toBe("white bread");
    });
    it("resolves fresh baked baguette to white bread", () => {
      expect(canonicalizeKnownFoodName("fresh baked baguette")).toBe(
        "white bread",
      );
    });

    it("resolves wraps to white bread", () => {
      // bagel removed from white bread — will become a separate Zone 2 entry
      expect(canonicalizeKnownFoodName("wrap (flat bread tortilla)")).toBe(
        "white bread",
      );
    });

    it("resolves lactose free cream cheese to cream cheese", () => {
      expect(canonicalizeKnownFoodName("lactose free cream cheese")).toBe(
        "cream cheese",
      );
    });

    it("resolves the legacy mismatch aliases from the cleanup audit", () => {
      // Meats
      expect(canonicalizeKnownFoodName("boiled chicken fillet")).toBe(
        "boiled white meat",
      );
      expect(canonicalizeKnownFoodName("roast chicken breast")).toBe(
        "grilled white meat",
      );
      expect(canonicalizeKnownFoodName("thick ham")).toBe("ham");
      expect(canonicalizeKnownFoodName("merluza fish poached")).toBe(
        "boiled fish",
      );

      // Dairy & eggs
      expect(canonicalizeKnownFoodName("desnatado yogurt")).toBe(
        "plain yogurt",
      );
      expect(
        canonicalizeKnownFoodName("strawberry flavoured greek yogurt"),
      ).toBe("flavoured yogurt");
      expect(canonicalizeKnownFoodName("flora spreadable")).toBe("butter");
      expect(canonicalizeKnownFoodName("soft scrabled egg")).toBe("egg");

      // Breads & cereals
      expect(canonicalizeKnownFoodName("1/2 a baguette")).toBe("white bread");
      expect(canonicalizeKnownFoodName("sugar puffs")).toBe("low-fiber cereal");

      // Fruits & vegetables
      expect(canonicalizeKnownFoodName("poached pear")).toBe("canned pear");
      expect(canonicalizeKnownFoodName("sm banana")).toBe("ripe banana");
      expect(canonicalizeKnownFoodName("mash potato")).toBe("mashed potato");
      expect(canonicalizeKnownFoodName("calabaza")).toBe(
        "mashed root vegetable",
      );

      // Oils & seasonings
      expect(canonicalizeKnownFoodName("olive oil extra virgin")).toBe(
        "olive oil",
      );
      // bare "pepper" intentionally removed from black pepper — ambiguous with bell pepper
      expect(canonicalizeKnownFoodName("pepper")).toBeNull();
      expect(canonicalizeKnownFoodName("stevia")).toBe("non-sugar sweetener");

      // Condiments & sweets
      expect(canonicalizeKnownFoodName("pico's crema de membrillo")).toBe(
        "jam",
      );
      expect(canonicalizeKnownFoodName("concentrated sweet food")).toBe(
        "refined confectionery",
      );
      expect(canonicalizeKnownFoodName("dark chocolate 85% cocoa")).toBe(
        "dark chocolate",
      );
    });

    it("attaches digestion metadata to enriched stations", () => {
      expect(getFoodEntry("crispy cracker")?.dryTexture).toBe("yes");
      expect(getFoodEntry("clear broth")?.totalResidue).toBe("very_low");
      expect(getFoodEntry("kefir")?.lactoseRisk).toBe("moderate");
    });

    it("returns undefined digestion metadata for foods without enrichment", () => {
      // "salt" is a registry entry that has no digestion metadata fields set
      expect(getFoodDigestionMetadata("salt")).toBeUndefined();
    });
  });

  // ─── Quantity word stripping (second pass — lines 159-162) ──────────────────

  describe("quantity word stripping (second pass)", () => {
    it("strips word-form quantities before matching", () => {
      expect(canonicalizeKnownFoodName("a couple of eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("some scrambled eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("several boiled eggs")).toBe("egg");
    });

    it("strips digit quantities in second pass", () => {
      expect(canonicalizeKnownFoodName("3 boiled eggs")).toBe("egg");
      expect(canonicalizeKnownFoodName("2 slices of toast")).toBe("toast");
    });

    it("handles 'a few' style multi-word quantities", () => {
      expect(canonicalizeKnownFoodName("a few eggs")).toBe("egg");
    });

    it("returns null when stripping still leaves unknown food", () => {
      expect(canonicalizeKnownFoodName("three mystery items")).toBeNull();
      expect(canonicalizeKnownFoodName("a couple of whatsits")).toBeNull();
    });
  });

  // ─── Unknown foods → null ─────────────────────────────────────────────────

  describe("unknown foods", () => {
    it("returns null for foods not in the registry", () => {
      expect(canonicalizeKnownFoodName("tikka masala")).toBeNull();
      expect(canonicalizeKnownFoodName("pad thai")).toBeNull();
      expect(canonicalizeKnownFoodName("something unrecognised")).toBeNull();
    });

    it("returns null for empty input", () => {
      expect(canonicalizeKnownFoodName("")).toBeNull();
      expect(canonicalizeKnownFoodName("   ")).toBeNull();
    });
  });
});
