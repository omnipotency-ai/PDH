import { Clock3, FlaskConical, Route, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import type { FoodStat } from "@/lib/analysis";
import { digestionBadgeClassName, getFoodDigestionBadges } from "@/lib/foodDigestionMetadata";
import {
  confidenceLabel,
  serviceRecord,
  stationSignalFromStatus,
  type TransitCorridor,
  type TransitStation,
  tendencyLabel,
} from "@/types/transitMap";

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

export interface RegistryTransitMapProps {
  foodStats: FoodStat[];
}

export default function RegistryTransitMap({ foodStats }: RegistryTransitMapProps) {
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

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <section
        data-slot="registry-transit-map"
        className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)]"
      >
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

                <div className="grid gap-3 lg:grid-cols-2">
                  {corridor.lines.map((line) => (
                    <div
                      key={line.line}
                      className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
                            {line.displayName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {line.testedCount}/{line.totalCount} tested
                          </p>
                        </div>
                        {line.nextStop !== null && (
                          <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            Next {line.nextStop.displayName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {line.stations.map((station) => (
                          <StationButton
                            key={station.canonical}
                            station={station}
                            selected={station.canonical === selectedStation?.canonical}
                            onSelect={setSelectedCanonical}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside className="rounded-[1.35rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5">
        {selectedStation === null || selectedLocation === undefined ? (
          <p className="text-sm text-slate-400">No station selected.</p>
        ) : (
          <StationDetail
            station={selectedStation}
            corridor={selectedLocation.corridor}
            lineName={selectedLocation.line.displayName}
          />
        )}
      </aside>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
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

function StationButton({
  station,
  selected,
  onSelect,
}: {
  station: TransitStation;
  selected: boolean;
  onSelect: (canonical: string) => void;
}) {
  const signal = stationSignalFromStatus(station.primaryStatus);
  const record = serviceRecord(station);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(station.canonical)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${signalDotClass(signal)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-100">{station.displayName}</p>
            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Z{station.zone}
              {station.subzone ?? ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{record ?? "No transit evidence yet"}</p>
        </div>
      </div>
    </button>
  );
}

function StationDetail({
  station,
  corridor,
  lineName,
}: {
  station: TransitStation;
  corridor: TransitCorridor;
  lineName: string;
}) {
  const digestionBadges = getFoodDigestionBadges(station.digestion);
  const service = serviceRecord(station);
  const theme = GROUP_THEME[corridor.group];

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Selected station
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {station.displayName}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {corridor.displayName} · {lineName}
            </p>
          </div>
          <div
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
          >
            Zone {station.zone}
            {station.subzone !== undefined ? ` · ${station.subzone}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          icon={<Route className="h-4 w-4" />}
          label="Status"
          value={station.primaryStatus ?? "Untested"}
        />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Confidence"
          value={confidenceLabel(station.confidence)}
        />
        <MetricCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Tendency"
          value={tendencyLabel(station.tendency) ?? "No signal"}
        />
      </div>

      {station.notes !== undefined && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Registry note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{station.notes}</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Digestion profile
          </p>
        </div>
        {digestionBadges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No digestion metadata attached yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {digestionBadges.map((badge) => (
              <span key={badge.key} className={digestionBadgeClassName(badge.tone)}>
                {badge.label}: {badge.value}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Evidence overlay
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceStat label="Trials logged" value={`${station.totalTrials}`} />
          <EvidenceStat label="Resolved transits" value={`${station.resolvedTransits}`} />
          <EvidenceStat
            label="Avg transit"
            value={
              station.avgTransitMinutes === null
                ? "Pending"
                : // Convert minutes to hours with 1 decimal: divide by 60, round via integer trick to avoid floating-point string issues
                  `${Math.round(station.avgTransitMinutes / 6) / 10}h`
            }
          />
          <EvidenceStat label="Service record" value={service ?? "No record yet"} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function signalDotClass(signal: ReturnType<typeof stationSignalFromStatus>): string {
  switch (signal) {
    case "green":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-400";
    case "red":
      return "bg-rose-400";
    case "blue":
      return "bg-sky-400";
    case "grey":
      return "bg-slate-500";
  }
}
