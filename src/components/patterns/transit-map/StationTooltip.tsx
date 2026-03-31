import { STATUS_COLORS } from "@/data/transitData";
import type { PositionedStation, TooltipState } from "./types";

interface StationTooltipProps {
  tooltip: TooltipState;
  station: PositionedStation;
}

export function StationTooltip({ tooltip, station }: StationTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[13rem] rounded-[18px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_94%,transparent)] px-3.5 py-3 shadow-[0_24px_60px_rgba(2,6,23,0.24)] backdrop-blur"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-bold text-[var(--text)]">
          {station.station.name}
        </p>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: `${STATUS_COLORS[station.station.status]}18`,
            color: STATUS_COLORS[station.station.status],
          }}
        >
          {station.station.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{station.station.preparation}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[station.station.status] }}
        />
        {station.track.label ?? station.zone.name}
      </div>
    </div>
  );
}
