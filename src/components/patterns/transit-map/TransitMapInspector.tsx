import { useState } from "react";
import { type FoodStatus, STATUS_COLORS, STATUS_LABELS } from "@/data/transitData";
import type { FocusedStation } from "./types";
import { getInitials } from "./utils";

function StatusPill({ status }: { status: FoodStatus }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: `${STATUS_COLORS[status]}18`,
        borderColor: `${STATUS_COLORS[status]}38`,
        color: STATUS_COLORS[status],
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {status}
    </span>
  );
}

export { StatusPill };

interface TransitMapInspectorProps {
  activeStation: FocusedStation;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}

export function TransitMapInspector({
  activeStation,
  selectedStationId,
  onSelectStation,
}: TransitMapInspectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <aside className="flex flex-col gap-4 xl:max-h-[46rem]">
      <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_92%,transparent)]">
        <div className="relative overflow-hidden border-b border-[var(--border)] px-5 py-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_34%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                Station Inspector
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-[var(--text)]">
                {activeStation.station.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {activeStation.station.preparation}
              </p>
            </div>
            <StatusPill status={activeStation.station.status} />
          </div>
          <div className="relative mt-5 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-0)] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
              {activeStation.imageSrc ? (
                <img
                  src={activeStation.imageSrc}
                  alt={activeStation.station.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-mono text-2xl font-bold text-[var(--text-muted)]">
                  {getInitials(activeStation.station.name)}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Family
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">{activeStation.subLine.name}</p>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Corridor
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">
                  {activeStation.zone.name}
                  {activeStation.track.label ? ` / ${activeStation.track.label}` : " / Main"}
                </p>
              </div>
            </div>
          </div>
          {activeStation.station.isCurrent && (
            <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Current stop
            </div>
          )}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--text-faint)]" />
              {detailsOpen ? "Hide route details" : "Show route details"}
            </button>
            {!detailsOpen && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Keep the inspector clean by default. Open details for jump targets and pinned-state
                context.
              </p>
            )}
          </div>
        </div>

        {detailsOpen && (
          <div className="space-y-4 border-t border-[var(--border)] px-5 py-5">
            <div className="grid grid-cols-2 gap-3 text-sm text-[var(--text-muted)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Status
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {STATUS_LABELS[activeStation.station.status]}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Selection
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {selectedStationId === activeStation.station.id
                    ? "Pinned in map"
                    : "Hover preview"}
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                Quick Jumps
              </p>
              <div className="mt-3 max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                {activeStation.subLine.zones.map((zone) => (
                  <div key={zone.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-semibold text-[var(--text)]">
                        {zone.name}
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {zone.description}
                      </span>
                    </div>
                    {zone.tracks.map((track) => (
                      <div key={track.id} className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                          {track.label ?? "Main line"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {track.stations.map((station) => {
                            const isSelected = station.id === selectedStationId;
                            return (
                              <button
                                type="button"
                                key={station.id}
                                onClick={() => onSelectStation(station.id)}
                                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-400"
                                style={{
                                  background: isSelected
                                    ? `${STATUS_COLORS[station.status]}24`
                                    : "rgba(255,255,255,0.04)",
                                  borderColor: isSelected
                                    ? `${STATUS_COLORS[station.status]}44`
                                    : "rgba(255,255,255,0.08)",
                                  color: isSelected ? "#f8fafc" : "rgba(226,232,240,0.78)",
                                }}
                              >
                                {station.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
