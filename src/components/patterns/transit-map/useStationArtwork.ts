import { useEffect, useRef, useState } from "react";
import type { Station } from "@/data/transitData";
import { normalizeSearchValue } from "./utils";

/**
 * Lazy glob — Vite returns a Record of () => Promise<module> functions.
 * Images are only loaded when invoked, NOT bundled into the initial JS.
 */
const ARTWORK_LOADERS = import.meta.glob("../../../assets/transit-map/*.png", {
  eager: false,
  import: "default",
}) as Record<string, () => Promise<string>>;

/**
 * Map from short key (e.g. "avocado") to its lazy loader function.
 */
const LOADER_BY_KEY = Object.fromEntries(
  Object.entries(ARTWORK_LOADERS).map(([path, loader]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(/\.png$/i, "");
    return [key, loader];
  }),
) as Record<string, () => Promise<string>>;

// Pre-compiled regex patterns for artwork key resolution.
// Module-level constants avoid re-compiling on every call to resolveArtworkKey.
const RX_SWEET_POTATO = /sweet potato|pumpkin/;
const RX_MASHED_POTATO = /mashed.*potato|potato.*mashed|pureed.*potato/;
const RX_POTATO = /potato/;
const RX_CARROT = /carrot/;
const RX_ZUCCHINI = /zucchini|courgette|cucumber/;
const RX_BROCCOLI = /broccoli|cauliflower/;
const RX_LEAFY = /spinach|lettuce|mixed greens|bok choy|greens|edamame|leafy/;
const RX_HERB =
  /herb|parsley|chives|dill|basil|thyme|oregano|rosemary|sage|mint|coriander|lemongrass|kaffir|fennel/;
const RX_GREEN_HERBS =
  /parsley|chives|dill|basil|thyme|oregano|rosemary|bay leaf|sage|tarragon|mint|coriander|lemongrass|kaffir|fennel/;
const RX_PEPPER = /pepper|capsicum|chilli|mustard|bbq sauce|hot sauce|worcestershire/;
const RX_ONION = /onion/;
const RX_BANANA = /banana/;
const RX_BERRIES = /strawberry|blueberry|berries/;
const RX_RICE = /rice|porridge|semolina|polenta|couscous|quinoa/;
const RX_TOAST = /toast/;
const RX_BREAD = /bread|crumpet|cracker|pretzel|muffin|biscuit|cake/;
const RX_PASTA = /pasta|spaghetti/;
const RX_CHIPS = /chip|fries|tempura/;
const RX_POULTRY = /chicken|turkey/;
const RX_SALMON = /salmon|tuna|sardine/;
const RX_FISH = /white fish|fish|prawn|crab/;
const RX_EGG = /egg/;
const RX_BEEF = /beef|lamb/;
const RX_PORK = /pork|ham|salami|sausage|bacon/;
const RX_COTTAGE_CHEESE = /cottage cheese/;
const RX_YOGURT = /yoghurt|yogurt|milk|ice cream|gelato/;
const RX_CHEESE = /ricotta|feta|mozzarella|cheddar|parmesan|gruyere|cheese|brie|camembert/;
const RX_AVOCADO = /avocado/;
const RX_CINNAMON = /cinnamon|nutmeg/;
const RX_BROTH = /broth|miso|soy sauce|oyster sauce|fish sauce/;

/**
 * Module-level cache: station ID → resolved artwork key (or null = no artwork).
 * Persists for the lifetime of the module, so repeated calls for the same station
 * (e.g. across re-renders or buildScene calls) never re-run the regex battery.
 *
 * NOTE: This cache survives HMR reloads. During development, stale entries may
 * persist across hot updates. Call `clearArtworkKeyCache()` in tests to reset.
 */
const artworkKeyCache = new Map<string, string | null>();

/**
 * Clear the module-level artwork key cache.
 * Intended for test cleanup so cached results don't leak between test cases.
 */
export function clearArtworkKeyCache(): void {
  artworkKeyCache.clear();
}

function matchArtworkKey(key: string): string | undefined {
  if (RX_SWEET_POTATO.test(key)) return "baked_sweet_potato";
  if (RX_MASHED_POTATO.test(key)) return "mashed_potatoes";
  if (RX_POTATO.test(key)) return "raw_potato";
  if (RX_CARROT.test(key)) return "raw_carrot";
  if (RX_ZUCCHINI.test(key)) return "raw_zucchini";
  if (RX_BROCCOLI.test(key)) return "fresh_broccoli";
  if (RX_LEAFY.test(key) && !RX_HERB.test(key)) return "leafy_greens";
  if (RX_GREEN_HERBS.test(key)) return "green_herbs";
  if (RX_PEPPER.test(key)) return "pepper";
  if (RX_ONION.test(key)) return "onion_group";
  if (RX_BANANA.test(key)) return "fresh_banana";
  if (RX_BERRIES.test(key)) return "mixed_berries";
  if (RX_RICE.test(key)) return "rice_bowl";
  if (RX_TOAST.test(key)) return "golden_toast";
  if (RX_BREAD.test(key)) return "bread_basket";
  if (RX_PASTA.test(key)) return "spaghetti_pasta";
  if (RX_CHIPS.test(key)) return "french_fries";
  if (RX_POULTRY.test(key)) return "poultry_drumstick";
  if (RX_SALMON.test(key)) return "salmon_fillet";
  if (RX_FISH.test(key)) return "white_fish";
  if (RX_EGG.test(key)) return "soft_boiled_egg";
  if (RX_BEEF.test(key)) return "beef_steak";
  if (RX_PORK.test(key)) return "pork_chop";
  if (RX_COTTAGE_CHEESE.test(key)) return "cottage_cheese";
  if (RX_YOGURT.test(key)) return "yogurt_pot";
  if (RX_CHEESE.test(key)) return "wedge_of_cheese";
  if (RX_AVOCADO.test(key)) return "avocado";
  if (RX_CINNAMON.test(key)) return "cinnamon";
  if (RX_BROTH.test(key)) return "clear_broth";
  return undefined;
}

/**
 * Given a station, return the artwork key it should use (or undefined).
 * Results are memoized by station ID to avoid re-running 30+ regexes on repeated calls.
 */
export function resolveArtworkKey(station: Station): string | undefined {
  const cached = artworkKeyCache.get(station.id);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const key = normalizeSearchValue(`${station.name} ${station.preparation}`);
  const resolved = matchArtworkKey(key);
  artworkKeyCache.set(station.id, resolved ?? null);
  return resolved;
}

/**
 * Collect unique artwork keys needed for a set of stations.
 */
function collectNeededKeys(stations: Station[]): string[] {
  const keys = new Set<string>();
  for (const station of stations) {
    const artworkKey = resolveArtworkKey(station);
    if (artworkKey !== undefined) {
      keys.add(artworkKey);
    }
  }
  return Array.from(keys);
}

/**
 * Hook that lazily loads station artwork PNGs on demand.
 *
 * Given a list of stations currently visible, it loads only the images
 * needed for those stations. Returns a map from artwork key to resolved URL.
 */
export function useStationArtwork(stations: Station[]): Record<string, string> {
  const [loaded, setLoaded] = useState<Record<string, string>>({});

  // Track loaded state via ref to avoid including it in the effect dependency array.
  // Including `loaded` directly would cause an infinite re-render cycle: the effect
  // loads images -> updates `loaded` -> triggers the effect again.
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    const neededKeys = collectNeededKeys(stations);
    const currentLoaded = loadedRef.current;
    const keysToLoad = neededKeys.filter(
      (k) => currentLoaded[k] === undefined && LOADER_BY_KEY[k] !== undefined,
    );

    if (keysToLoad.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      const results: Array<[string, string]> = [];

      await Promise.all(
        keysToLoad.map(async (artworkKey) => {
          const loader = LOADER_BY_KEY[artworkKey];
          if (!loader) return;
          try {
            const url = await loader();
            results.push([artworkKey, url]);
          } catch (error) {
            // Log but don't crash — missing artwork is non-fatal
            console.error(`Failed to load transit map artwork: ${artworkKey}`, error);
          }
        }),
      );

      if (!cancelled && results.length > 0) {
        setLoaded((prev) => {
          const next = { ...prev };
          for (const [key, url] of results) {
            next[key] = url;
          }
          return next;
        });
      }
    };

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [stations]);

  return loaded;
}
