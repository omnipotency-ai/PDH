import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import {
  FOOD_GROUPS,
  FOOD_REGISTRY,
  getFoodsByLine,
  getLinesByGroup,
  pickFoodDigestionMetadata,
} from "@shared/foodRegistry";
import { describe, expect, it } from "vitest";
import type { FoodStat } from "@/lib/analysis";
import type { TransitStation } from "@/types/transitMap";
import {
  confidenceLabel,
  serviceRecord,
  stationSignalFromStatus,
  tendencyLabel,
} from "@/types/transitMap";

// Minimal FoodStat factory for testing
function makeFoodStat(overrides: Partial<FoodStat> & { key: string }): FoodStat {
  return {
    name: overrides.key,
    totalTrials: 0,
    recentOutcomes: [],
    badCount: 0,
    looseCount: 0,
    hardCount: 0,
    goodCount: 0,
    avgDelayHours: null,
    lastTrialAt: 0,
    status: "testing",
    primaryStatus: "building",
    tendency: "neutral",
    confidence: 0,
    codeScore: 0,
    aiScore: 0,
    combinedScore: 0,
    recentSuspect: false,
    clearedHistory: false,
    learnedTransitCenterMinutes: 720,
    learnedTransitSpreadMinutes: 360,
    bristolBreakdown: {},
    avgTransitMinutes: null,
    resolvedTransits: 0,
    ...overrides,
  };
}

// Pure network builder (mirrors hook internals, no React dependency)
function buildTransitNetworkForTest(foodStats: FoodStat[]) {
  const statsByKey = new Map<string, FoodStat>();
  for (const stat of foodStats) {
    statsByKey.set(stat.key, stat);
  }

  const corridors = FOOD_GROUPS.map((group) => {
    const groupLines = getLinesByGroup(group);
    const lines = groupLines.map((line) => {
      const entries = getFoodsByLine(line);
      const stations: TransitStation[] = entries.map((entry) => {
        const stat = statsByKey.get(entry.canonical);
        const displayName = formatCanonicalFoodDisplayName(entry.canonical);

        if (!stat || stat.totalTrials === 0) {
          return {
            canonical: entry.canonical,
            displayName,
            zone: entry.zone,
            subzone: entry.subzone,
            lineOrder: entry.lineOrder,
            notes: entry.notes,
            digestion: pickFoodDigestionMetadata(entry) ?? null,
            primaryStatus: null,
            tendency: null,
            totalTrials: 0,
            resolvedTransits: 0,
            avgTransitMinutes: null,
            confidence: null,
            bristolBreakdown: {},
            latestAiVerdict: null,
            latestAiReasoning: null,
            lastTrialAt: 0,
            firstSeenAt: 0,
          };
        }

        return {
          canonical: entry.canonical,
          displayName,
          zone: entry.zone,
          subzone: entry.subzone,
          lineOrder: entry.lineOrder,
          notes: entry.notes,
          digestion: pickFoodDigestionMetadata(entry) ?? null,
          primaryStatus: stat.primaryStatus,
          tendency: stat.tendency,
          totalTrials: stat.totalTrials,
          resolvedTransits: stat.resolvedTransits,
          avgTransitMinutes: stat.avgTransitMinutes,
          confidence: stat.confidence,
          bristolBreakdown: stat.bristolBreakdown,
          latestAiVerdict: null,
          latestAiReasoning: null,
          lastTrialAt: stat.lastTrialAt,
          firstSeenAt: stat.lastTrialAt,
        };
      });

      const testedCount = stations.filter((s) => s.totalTrials > 0).length;
      const nextStop =
        stations.find((s) => s.primaryStatus === null || s.primaryStatus === "building") ?? null;

      return {
        line,
        displayName: "",
        stations,
        testedCount,
        totalCount: stations.length,
        nextStop,
      };
    });

    const testedCount = lines.reduce((sum, l) => sum + l.testedCount, 0);
    const totalCount = lines.reduce((sum, l) => sum + l.totalCount, 0);

    return {
      group,
      displayName: "",
      lines,
      testedCount,
      totalCount,
    };
  });

  const stationsByCanonical = new Map<string, TransitStation>();
  for (const corridor of corridors) {
    for (const line of corridor.lines) {
      for (const station of line.stations) {
        stationsByCanonical.set(station.canonical, station);
      }
    }
  }

  return {
    corridors,
    totalStations: FOOD_REGISTRY.length,
    testedStations: [...stationsByCanonical.values()].filter((s) => s.totalTrials > 0).length,
    stationsByCanonical,
  };
}

describe("Transit Map Data Foundation", () => {
  describe("Network structure", () => {
    it("produces corridors matching FOOD_GROUPS", () => {
      const network = buildTransitNetworkForTest([]);
      expect(network.corridors).toHaveLength(FOOD_GROUPS.length);
      expect(network.corridors.map((c) => c.group)).toEqual([...FOOD_GROUPS]);
    });

    it("has correct line counts per corridor (derived from registry)", () => {
      const network = buildTransitNetworkForTest([]);
      const expectedLineCounts = FOOD_GROUPS.map((group) => getLinesByGroup(group).length);
      const actualLineCounts = network.corridors.map((c) => c.lines.length);
      expect(actualLineCounts).toEqual(expectedLineCounts);
    });

    it("total stations equals registry size", () => {
      const network = buildTransitNetworkForTest([]);
      expect(network.totalStations).toBe(FOOD_REGISTRY.length);

      let stationCount = 0;
      for (const corridor of network.corridors) {
        for (const line of corridor.lines) {
          stationCount += line.stations.length;
        }
      }
      expect(stationCount).toBe(FOOD_REGISTRY.length);
    });

    it("stations are sorted by lineOrder within each line", () => {
      const network = buildTransitNetworkForTest([]);
      for (const corridor of network.corridors) {
        for (const line of corridor.lines) {
          for (let i = 1; i < line.stations.length; i++) {
            expect(line.stations[i].lineOrder).toBeGreaterThanOrEqual(
              line.stations[i - 1].lineOrder,
            );
          }
        }
      }
    });

    it("every registry entry appears in stationsByCanonical", () => {
      const network = buildTransitNetworkForTest([]);
      for (const entry of FOOD_REGISTRY) {
        expect(network.stationsByCanonical.has(entry.canonical)).toBe(true);
      }
    });
  });

  describe("Evidence integration", () => {
    it("untested stations have null primaryStatus", () => {
      const network = buildTransitNetworkForTest([]);
      const toast = network.stationsByCanonical.get("toast");
      if (toast === undefined) throw new Error("expected toast station");
      expect(toast.displayName).toBe("White Toast");
      expect(toast.primaryStatus).toBeNull();
      expect(toast.totalTrials).toBe(0);
      expect(toast.confidence).toBeNull();
    });

    it("tested stations reflect evidence data", () => {
      const stats: FoodStat[] = [
        makeFoodStat({
          key: "toast",
          totalTrials: 12,
          resolvedTransits: 10,
          primaryStatus: "safe",
          tendency: "neutral",
          confidence: 0.85,
          avgTransitMinutes: 720,
          bristolBreakdown: { 3: 2, 4: 6, 5: 2 },
          lastTrialAt: Date.now(),
        }),
      ];

      const network = buildTransitNetworkForTest(stats);
      const toast = network.stationsByCanonical.get("toast");
      if (toast === undefined) throw new Error("expected toast station");
      expect(toast.primaryStatus).toBe("safe");
      expect(toast.tendency).toBe("neutral");
      expect(toast.totalTrials).toBe(12);
      expect(toast.resolvedTransits).toBe(10);
      expect(toast.confidence).toBe(0.85);
      expect(toast.avgTransitMinutes).toBe(720);
    });

    it("stations carry registry digestion metadata", () => {
      const network = buildTransitNetworkForTest([]);
      const crispyCracker = network.stationsByCanonical.get("crispy cracker");
      const registryEntry = FOOD_REGISTRY.find((e) => e.canonical === "crispy cracker");
      if (registryEntry === undefined) throw new Error("expected crispy cracker in registry");
      const registryMetadata = pickFoodDigestionMetadata(registryEntry);
      if (registryMetadata === undefined) throw new Error("expected registry digestion metadata");
      expect(crispyCracker?.digestion?.dryTexture).toBe(registryMetadata.dryTexture);
      expect(crispyCracker?.digestion?.highFatRisk).toBe(registryMetadata.highFatRisk);
    });

    it("testedStations count reflects evidence", () => {
      const stats: FoodStat[] = [
        makeFoodStat({ key: "toast", totalTrials: 5 }),
        makeFoodStat({ key: "ripe banana", totalTrials: 3 }),
        makeFoodStat({ key: "egg", totalTrials: 8 }),
      ];

      const network = buildTransitNetworkForTest(stats);
      expect(network.testedStations).toBe(3);
    });

    it("non-registry food stats are ignored (no ghost stations)", () => {
      const stats: FoodStat[] = [makeFoodStat({ key: "unicorn meat", totalTrials: 99 })];

      const network = buildTransitNetworkForTest(stats);
      expect(network.stationsByCanonical.has("unicorn meat")).toBe(false);
      expect(network.totalStations).toBe(FOOD_REGISTRY.length);
    });
  });

  describe("Next stop logic", () => {
    it("next stop is first untested station by lineOrder on an empty network", () => {
      const network = buildTransitNetworkForTest([]);

      for (const corridor of network.corridors) {
        for (const line of corridor.lines) {
          if (line.stations.length > 0) {
            if (line.nextStop === null) throw new Error("expected nextStop for non-empty line");
            expect(line.nextStop.lineOrder).toBe(line.stations[0].lineOrder);
          }
        }
      }
    });

    it("next stop skips safe stations to find building/untested", () => {
      const grainsStations = getFoodsByLine("grains");
      const firstCanonical = grainsStations[0].canonical;
      const secondCanonical = grainsStations.length > 1 ? grainsStations[1].canonical : null;

      const stats: FoodStat[] = [
        makeFoodStat({
          key: firstCanonical,
          totalTrials: 10,
          primaryStatus: "safe",
        }),
      ];

      const network = buildTransitNetworkForTest(stats);
      const grainsLine = network.corridors
        .find((c) => c.group === "carbs")
        ?.lines.find((l) => l.line === "grains");

      expect(grainsLine?.nextStop).not.toBeNull();
      if (secondCanonical) {
        expect(grainsLine?.nextStop?.canonical).toBe(secondCanonical);
      }
    });
  });
});

describe("Transit Map helpers", () => {
  describe("stationSignalFromStatus", () => {
    it("maps statuses to signal colours", () => {
      expect(stationSignalFromStatus("safe")).toBe("green");
      expect(stationSignalFromStatus("building")).toBe("blue");
      expect(stationSignalFromStatus("watch")).toBe("amber");
      expect(stationSignalFromStatus("avoid")).toBe("red");
      expect(stationSignalFromStatus(null)).toBe("grey");
    });
  });

  describe("tendencyLabel", () => {
    it("maps tendencies to transit-themed labels", () => {
      expect(tendencyLabel("neutral")).toBe("On time");
      expect(tendencyLabel("loose")).toBe("Express");
      expect(tendencyLabel("hard")).toBe("Delayed");
      expect(tendencyLabel(null)).toBeNull();
    });
  });

  describe("confidenceLabel", () => {
    it("maps confidence to human labels", () => {
      expect(confidenceLabel(null)).toBe("Untested");
      expect(confidenceLabel(0)).toBe("Untested");
      expect(confidenceLabel(0.1)).toBe("More transits needed");
      expect(confidenceLabel(0.4)).toBe("Building signal");
      expect(confidenceLabel(0.8)).toBe("Strong signal");
    });
  });

  describe("serviceRecord", () => {
    it("returns null for untested stations", () => {
      expect(
        serviceRecord({
          resolvedTransits: 0,
          bristolBreakdown: {},
        } as unknown as TransitStation),
      ).toBeNull();
    });

    it("formats a service record string", () => {
      const record = serviceRecord({
        resolvedTransits: 7,
        bristolBreakdown: { 1: 1, 3: 1, 4: 3, 6: 1, 7: 1 },
      } as unknown as TransitStation);
      expect(record).toContain("7 transits");
      expect(record).toContain("on time");
      expect(record).toContain("express");
      expect(record).toContain("delayed");
    });
  });
});
