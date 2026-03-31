import type { Zone } from "@/data/transitData";
import { ZONE_SURFACES } from "./constants";

interface ZoneCardProps {
  zone: Zone;
  index: 0 | 1 | 2;
  rect: { x: number; y: number; width: number; height: number };
}

export function ZoneCard({ zone, index, rect }: ZoneCardProps) {
  const tone = ZONE_SURFACES[index];
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={28}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={1.5}
      />
      <text
        x={rect.x + 26}
        y={rect.y + 34}
        fontFamily="var(--font-mono)"
        fontSize={12}
        fontWeight={700}
        letterSpacing={2.1}
        fill={tone.label}
      >
        {zone.shortName}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 62}
        fontFamily="var(--font-display)"
        fontSize={28}
        fontWeight={700}
        fill="rgba(248, 250, 252, 0.96)"
      >
        {zone.name}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 92}
        fontFamily="var(--font-sans)"
        fontSize={14}
        fill="rgba(226, 232, 240, 0.66)"
      >
        {zone.description}
      </text>
    </g>
  );
}
