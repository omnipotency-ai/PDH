import type { ReactElement } from "react";
import {
  BRISTOL_ILLUSTRATION_SHAPES,
  BRISTOL_LABELS,
  type BristolShape,
} from "@/components/track/panels/bristolScaleData";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BristolOption {
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const BRISTOL_SCALE: readonly BristolOption[] = [
  {
    value: 1,
    label: "Hard lumps",
    description: "Separate hard lumps",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/12",
    borderColor: "border-red-500/30",
  },
  {
    value: 2,
    label: "Lumpy",
    description: "Lumpy and sausage-like",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/12",
    borderColor: "border-orange-500/30",
  },
  {
    value: 3,
    label: "Cracked",
    description: "Sausage with cracks on surface",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/12",
    borderColor: "border-emerald-500/30",
  },
  {
    value: 4,
    label: "Long smooth",
    description: "Smooth, soft sausage or snake",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/12",
    borderColor: "border-emerald-500/30",
  },
  {
    value: 5,
    label: "Soft blobs",
    description: "Soft blobs with clear-cut edges",
    color: "text-lime-600 dark:text-lime-400",
    bgColor: "bg-lime-500/12",
    borderColor: "border-lime-500/30",
  },
  {
    value: 6,
    label: "Mushy",
    description: "Mushy with ragged edges",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/12",
    borderColor: "border-orange-500/30",
  },
  {
    value: 7,
    label: "Liquid",
    description: "Liquid, no solid pieces",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/12",
    borderColor: "border-red-500/30",
  },
];

function getShapeKey(shape: BristolShape, index: number): string {
  switch (shape.type) {
    case "circle":
      return `circle-${shape.cx}-${shape.cy}-${shape.r}`;
    case "ellipse":
      return `ellipse-${shape.cx}-${shape.cy}-${shape.rx}-${shape.ry}`;
    case "rect":
      return `rect-${shape.xOffset}-${shape.yOffset}-${shape.width}-${shape.height}`;
    case "line":
      return `line-${shape.x1}-${shape.y1}-${shape.x2}-${shape.y2}`;
    case "path":
      return `path-${index}`;
    default:
      return `shape-${index}`;
  }
}

function renderShape(shape: BristolShape, mid: number, index: number): ReactElement | null {
  const key = getShapeKey(shape, index);
  switch (shape.type) {
    case "circle":
      return (
        <circle
          key={key}
          cx={mid + shape.cx}
          cy={mid + shape.cy}
          r={shape.r}
          fill={shape.fill}
          opacity={shape.opacity}
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={key}
          cx={mid + shape.cx}
          cy={mid + shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={shape.fill}
          opacity={shape.opacity}
        />
      );
    case "rect":
      return (
        <rect
          key={key}
          x={mid + shape.xOffset}
          y={mid + shape.yOffset}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          fill={shape.fill}
          opacity={shape.opacity}
        />
      );
    case "line":
      return (
        <line
          key={key}
          x1={mid + shape.x1}
          y1={mid + shape.y1}
          x2={mid + shape.x2}
          y2={mid + shape.y2}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          opacity={shape.opacity}
        />
      );
    case "path":
      return <path key={key} d={shape.d(mid)} fill={shape.fill} opacity={shape.opacity} />;
    default:
      return null;
  }
}

export function BristolIllustration({ type, size = 42 }: { type: number; size?: number }) {
  const s = size;
  const mid = s / 2;
  const label = BRISTOL_LABELS[type] ?? `Bristol type ${type}`;
  const shapes = BRISTOL_ILLUSTRATION_SHAPES[type];

  if (!shapes) return null;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" role="img" aria-label={label}>
      {shapes.map((shape: BristolShape, index: number) => renderShape(shape, mid, index))}
    </svg>
  );
}

interface BristolScalePickerProps {
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  onChange: (value: 1 | 2 | 3 | 4 | 5 | 6 | 7) => void;
  compact?: boolean;
}

export function BristolScalePicker({ value, onChange, compact = false }: BristolScalePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Bristol Stool Scale rating"
      className={cn(
        "flex gap-1.5 rounded-2xl p-2 backdrop-blur-md",
        "bg-[var(--section-bowel-muted)] border border-[var(--section-bowel-border)]",
        compact ? "flex-wrap" : "flex-wrap justify-center",
      )}
    >
      {BRISTOL_SCALE.map((option) => {
        const isSelected = value === option.value;
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              {/* biome-ignore lint/a11y/useSemanticElements: custom styled radio with aria-checked */}
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Type ${option.value} \u2014 ${option.description}`}
                onClick={() => onChange(option.value)}
                className={cn(
                  "bristol-btn backdrop-blur-sm",
                  isSelected
                    ? cn("selected", option.bgColor)
                    : "bg-white/5 border border-white/10 hover:bg-white/10",
                )}
              >
                <BristolIllustration type={option.value} size={compact ? 34 : 42} />
                <span
                  className={cn(
                    "text-xs font-bold leading-none tracking-tight",
                    isSelected ? "text-[var(--color-accent-orange)]" : option.color,
                  )}
                >
                  {option.value}
                </span>
                {!compact && (
                  <span
                    className={cn(
                      "font-sans text-[11px] leading-tight tracking-wide",
                      isSelected
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-tertiary)]",
                    )}
                  >
                    {option.label}
                  </span>
                )}
                {isSelected && option.value === 4 && (
                  <span className="absolute -top-1 -right-1 text-xs" aria-hidden="true">
                    {"\u2728"}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Type {option.value}: {option.description}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* Small inline badge for showing Bristol type in log stream */
export function BristolBadge({ code }: { code: number }) {
  const option = BRISTOL_SCALE.find((b) => b.value === code);
  if (!option) return <span>B{code}</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        "backdrop-blur-sm border",
        option.bgColor,
        option.borderColor,
        option.color,
      )}
    >
      <BristolIllustration type={code} size={20} />
      {option.label}
    </span>
  );
}
