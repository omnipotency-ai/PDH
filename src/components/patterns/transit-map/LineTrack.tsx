import type { FoodGroup } from "@shared/foodRegistry";
import type { TransitLine, TransitStation } from "@/types/transitMap";
import StationNode from "./StationNode";

export interface LineTrackProps {
  line: TransitLine;
  corridorGroup: FoodGroup;
  selectedCanonical: string | null;
  onSelectStation: (canonical: string) => void;
}

// ── Zone label helpers ────────────────────────────────────────────────────

function zoneKey(station: TransitStation): string {
  if (station.subzone !== undefined) {
    return station.subzone; // "1A" or "1B"
  }
  return String(station.zone); // "2" or "3"
}

function zoneLabel(station: TransitStation): string {
  if (station.subzone !== undefined) {
    return `Zone ${station.subzone}`;
  }
  return `Zone ${station.zone}`;
}

// ── Progress bar ─────────────────────────────────────────────────────────

interface ProgressBarProps {
  testedCount: number;
  totalCount: number;
}

function ProgressBar({ testedCount, totalCount }: ProgressBarProps) {
  const fraction = totalCount === 0 ? 0 : testedCount / totalCount;
  const pct = Math.round(fraction * 100);

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-slate-500">{pct}%</span>
    </div>
  );
}

// ── Zone divider ─────────────────────────────────────────────────────────

interface ZoneDividerProps {
  label: string;
}

function ZoneDivider({ label }: ZoneDividerProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-slate-800/80" />
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-800/80" />
    </div>
  );
}

// ── LineTrack ─────────────────────────────────────────────────────────────

export default function LineTrack({
  line,
  corridorGroup: _corridorGroup,
  selectedCanonical,
  onSelectStation,
}: LineTrackProps) {
  return (
    <div
      data-slot="line-track"
      className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3"
    >
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
            {line.displayName}
          </h4>
          <p className="text-xs text-slate-500">
            {line.testedCount}/{line.totalCount} tested
          </p>
        </div>
        {line.nextStop !== null && (
          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Next {line.nextStop.displayName}
          </span>
        )}
      </div>

      {/* Progress indicator */}
      <ProgressBar testedCount={line.testedCount} totalCount={line.totalCount} />

      {/* Stations */}
      <div className="mt-3 space-y-2">
        {line.stations.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">No stations on this line</p>
        ) : (
          line.stations.map((station, index) => {
            const prevStation = index > 0 ? line.stations[index - 1] : undefined;
            const showZoneDivider =
              index === 0 ||
              (prevStation !== undefined && zoneKey(station) !== zoneKey(prevStation));

            return (
              <div key={station.canonical}>
                {showZoneDivider && <ZoneDivider label={zoneLabel(station)} />}
                <StationNode
                  station={station}
                  selected={station.canonical === selectedCanonical}
                  onSelect={onSelectStation}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
