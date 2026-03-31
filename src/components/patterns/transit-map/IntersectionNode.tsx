interface IntersectionNodeProps {
  x: number;
  y: number;
  color: string;
}

export function IntersectionNode({ x, y, color }: IntersectionNodeProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={23}
        fill="color-mix(in srgb, var(--surface-0) 96%, black 4%)"
        stroke={`${color}35`}
        strokeWidth={3}
      />
      <circle
        r={14}
        fill="color-mix(in srgb, var(--surface-1) 92%, black 8%)"
        stroke={color}
        strokeWidth={4}
      />
      <circle r={5.5} fill={color} />
    </g>
  );
}
