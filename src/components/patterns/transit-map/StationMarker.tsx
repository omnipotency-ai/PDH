import { memo, type MouseEvent as ReactMouseEvent } from "react";
import { STATUS_COLORS, STATUS_LABELS, type Station } from "@/data/transitData";
import { STATION_RADIUS } from "./constants";
import { getInitials } from "./utils";

interface StationMarkerProps {
  clipId: string;
  station: Station;
  imageSrc?: string;
  x: number;
  y: number;
  lineColor: string;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (event: ReactMouseEvent<SVGGElement>) => void;
  onMove: (event: ReactMouseEvent<SVGGElement>) => void;
  onLeave: () => void;
  onSelect: () => void;
}

export const StationMarker = memo(function StationMarker({
  clipId,
  station,
  imageSrc,
  x,
  y,
  lineColor,
  isHovered,
  isSelected,
  onHover,
  onMove,
  onLeave,
  onSelect,
}: StationMarkerProps) {
  const statusColor = STATUS_COLORS[station.status];
  const ringRadius = STATION_RADIUS + (isSelected ? 5 : station.isCurrent ? 3 : 0);
  const showPulse = station.isCurrent || isSelected;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG group used as a focusable station target
    <g
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${station.name}. ${station.preparation}. ${STATUS_LABELS[station.status]}.`}
    >
      {showPulse && (
        <>
          <circle
            r={ringRadius + 9}
            fill="none"
            stroke={`${statusColor}55`}
            strokeWidth={2}
            style={{
              animation: "transit-pulse 2.4s ease-out infinite",
            }}
          />
          <circle
            r={ringRadius + 15}
            fill="none"
            stroke={`${lineColor}44`}
            strokeWidth={1.5}
            style={{
              animation: "transit-pulse 2.4s ease-out 0.5s infinite",
            }}
          />
        </>
      )}
      <circle
        r={ringRadius + 7}
        fill="rgba(4, 9, 18, 0.86)"
        stroke={`${lineColor}26`}
        strokeWidth={2}
      />
      {imageSrc ? (
        <image
          href={imageSrc}
          x={-STATION_RADIUS}
          y={-STATION_RADIUS}
          width={STATION_RADIUS * 2}
          height={STATION_RADIUS * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          opacity={isHovered ? 1 : 0.96}
          style={{ filter: "saturate(1.15) contrast(1.08)" }}
        />
      ) : (
        <g>
          <circle r={STATION_RADIUS} fill={`${lineColor}22`} />
          <text
            y={5}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={15}
            fontWeight={700}
            fill="rgba(248, 250, 252, 0.92)"
          >
            {getInitials(station.name)}
          </text>
        </g>
      )}
      <circle
        r={STATION_RADIUS + 1}
        fill="none"
        stroke={statusColor}
        strokeWidth={isSelected ? 4.5 : isHovered ? 4 : 3}
      />
      <circle r={STATION_RADIUS + 5} fill="none" stroke={`${lineColor}45`} strokeWidth={1.5} />
      <title>{`${station.name} • ${station.preparation} • ${STATUS_LABELS[station.status]}`}</title>
    </g>
  );
});
