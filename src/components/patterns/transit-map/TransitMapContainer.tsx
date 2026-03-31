import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import type { FoodStat } from "@/lib/analysis";
import type { TransitCorridor } from "@/types/transitMap";
import LineTrack from "./LineTrack";
import StationInspector from "./StationInspector";

// ── Corridor theme map ────────────────────────────────────────────────────

const GROUP_THEME: Record<
  TransitCorridor["group"],
  { panel: string; accent: string; chip: string }
> = {
  protein: {
    panel:
      "border-orange-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-orange-200",
    chip: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  },
  carbs: {
    panel:
      "border-sky-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-sky-200",
    chip: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  },
  fats: {
    panel:
      "border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-emerald-200",
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  },
  seasoning: {
    panel:
      "border-rose-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-rose-200",
    chip: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────

export interface TransitMapContainerProps {
  foodStats: FoodStat[];
}

// ── Summary card ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p
        className={`mt-1 font-display ${compact ? "text-base" : "text-xl"} font-semibold text-slate-100`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function TransitMapContainer({ foodStats }: TransitMapContainerProps): ReactNode {
  const network = useTransitMapData(foodStats);

  const firstStation = useMemo(
    () =>
      network.corridors.flatMap((corridor) => corridor.lines.flatMap((line) => line.stations))[0] ??
      null,
    [network.corridors],
  );

  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  // Ref avoids re-triggering the effect when the user selects a station.
  // The effect only needs to run when the network data or firstStation changes.
  const selectedCanonicalRef = useRef(selectedCanonical);
  selectedCanonicalRef.current = selectedCanonical;

  useEffect(() => {
    const current = selectedCanonicalRef.current;
    if (current !== null && network.stationsByCanonical.has(current)) {
      return;
    }
    setSelectedCanonical(firstStation?.canonical ?? null);
  }, [firstStation, network.stationsByCanonical]);

  const selectedStation =
    (selectedCanonical !== null ? network.stationsByCanonical.get(selectedCanonical) : undefined) ??
    firstStation ??
    null;

  const selectedLocation =
    selectedStation !== null ? network.stationLocation.get(selectedStation.canonical) : undefined;

  const nextSuggested = network.corridors.find((c) => c.nextStop !== null)?.nextStop ?? null;
  const untestedStations = network.totalStations - network.testedStations;

  // Empty state: no food evidence logged yet
  if (foodStats.length === 0 && network.testedStations === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)] p-8 text-center">
        <p className="max-w-sm text-sm leading-6 text-slate-400">
          No food evidence yet. Log some food and bowel movements to build your transit map.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <section
        data-slot="transit-map-container"
        className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)]"
      >
        {/* Header with summary cards */}
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Live Registry
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50">
                Transit map from your data
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Stations, notes, and digestion flags come directly from the canonical food registry.
                Evidence overlays on top of those stations without a separate transit taxonomy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Stations" value={network.totalStations} />
              <SummaryCard label="Tested" value={network.testedStations} />
              <SummaryCard label="Untested" value={untestedStations} />
              <SummaryCard
                label="Next stop"
                value={nextSuggested?.displayName ?? "Pick any"}
                compact
              />
            </div>
          </div>
        </div>

        {/* Corridor sections */}
        <div className="space-y-4 p-4">
          {network.corridors.map((corridor) => {
            const theme = GROUP_THEME[corridor.group];

            return (
              <section
                key={corridor.group}
                className={`rounded-[1.15rem] border p-4 ${theme.panel}`}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Corridor
                    </p>
                    <h3 className={`font-display text-xl font-semibold ${theme.accent}`}>
                      {corridor.displayName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
                    >
                      {corridor.testedCount}/{corridor.totalCount} tested
                    </span>
                    {corridor.nextStop !== null && (
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        Next: {corridor.nextStop.displayName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lines within corridor */}
                <div className="grid gap-3 lg:grid-cols-2">
                  {corridor.lines.map((line) => (
                    <LineTrack
                      key={line.line}
                      line={line}
                      corridorGroup={corridor.group}
                      selectedCanonical={selectedCanonical}
                      onSelectStation={setSelectedCanonical}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* Station inspector sidebar */}
      <aside className="rounded-[1.35rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5">
        {selectedStation === null || selectedLocation === undefined ? (
          <p className="text-sm text-slate-400">No station selected.</p>
        ) : (
          <StationInspector
            station={selectedStation}
            corridorGroup={selectedLocation.corridor.group}
            corridorDisplayName={selectedLocation.corridor.displayName}
            lineName={selectedLocation.line.displayName}
          />
        )}
      </aside>
    </div>
  );
}
