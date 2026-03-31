import type { MouseEvent as ReactMouseEvent } from "react";
import { TRACK_COLOR_STROKE, TRACK_SHADOW_STROKE } from "./constants";
import { StationMarker } from "./StationMarker";
import type { PositionedTrack } from "./types";

interface TrackChipProps {
  label: string;
  x: number;
  y: number;
  color: string;
  align: "start" | "middle" | "end";
}

function TrackChip({ label, x, y, color, align }: TrackChipProps) {
  const width = Math.max(112, label.length * 6.9 + 30);
  const left = align === "middle" ? x - width / 2 : align === "end" ? x - width : x;

  return (
    <g transform={`translate(${left}, ${y - 14})`}>
      <rect
        width={width}
        height={28}
        rx={14}
        fill="rgba(5, 10, 20, 0.84)"
        stroke={`${color}55`}
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={17}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing={1.2}
        fill={color}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

interface TrackSegmentProps {
  track: PositionedTrack;
  lineColor: string;
  svgIdPrefix: string;
  softShadowId: string;
  selectedStationId: string | null;
  hoveredStationId: string | null;
  onStationHover: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationMove: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationLeave: () => void;
  onStationSelect: (stationId: string) => void;
}

export function TrackSegment({
  track,
  lineColor,
  svgIdPrefix,
  softShadowId,
  selectedStationId,
  hoveredStationId,
  onStationHover,
  onStationMove,
  onStationLeave,
  onStationSelect,
}: TrackSegmentProps) {
  return (
    <g>
      <path
        d={track.path}
        stroke="rgba(4, 9, 18, 0.88)"
        strokeWidth={TRACK_SHADOW_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={track.path}
        stroke={lineColor}
        strokeWidth={TRACK_COLOR_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${softShadowId})`}
      />
      <TrackChip
        label={track.track.label ?? `${track.zone.shortName} main`}
        x={track.chipX}
        y={track.chipY}
        color={lineColor}
        align={track.chipAlign}
      />
      {track.stations.map((station) => {
        const isSelected = station.station.id === selectedStationId;
        const isHovered = station.station.id === hoveredStationId;
        const clipId = `${svgIdPrefix}-station-clip`;

        return (
          <StationMarker
            key={station.station.id}
            clipId={clipId}
            station={station.station}
            x={station.x}
            y={station.y}
            lineColor={lineColor}
            isHovered={isHovered}
            isSelected={isSelected}
            {...(station.imageSrc !== undefined && {
              imageSrc: station.imageSrc,
            })}
            onHover={(event) => onStationHover(station.station.id, event)}
            onMove={(event) => onStationMove(station.station.id, event)}
            onLeave={onStationLeave}
            onSelect={() => onStationSelect(station.station.id)}
          />
        );
      })}
    </g>
  );
}
