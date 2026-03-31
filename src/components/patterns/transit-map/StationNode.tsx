import { serviceRecord, stationSignalFromStatus, type TransitStation } from "@/types/transitMap";

export interface StationNodeProps {
  station: TransitStation;
  selected: boolean;
  onSelect: (canonical: string) => void;
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

export default function StationNode({ station, selected, onSelect }: StationNodeProps) {
  const signal = stationSignalFromStatus(station.primaryStatus);
  const record = serviceRecord(station);
  const isBuilding = station.primaryStatus === "building";

  return (
    <button
      type="button"
      data-slot="station-node"
      aria-pressed={selected}
      onClick={() => onSelect(station.canonical)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${signalDotClass(signal)} ${isBuilding ? "animate-pulse" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-100">{station.displayName}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              {station.totalTrials > 0 && (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                  {station.totalTrials}
                </span>
              )}
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Z{station.zone}
                {station.subzone ?? ""}
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">{record ?? "No transit evidence yet"}</p>
        </div>
      </div>
    </button>
  );
}
