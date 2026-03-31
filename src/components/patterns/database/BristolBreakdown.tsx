import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bristolColor } from "./foodSafetyUtils";

interface BristolBreakdownProps {
  breakdown: Record<number, number>;
}

export function BristolBreakdown({ breakdown }: BristolBreakdownProps) {
  const entries = Object.entries(breakdown)
    .map(([code, count]) => ({ code: Number(code), count }))
    .filter((e) => e.count > 0 && e.code >= 1 && e.code <= 7)
    .sort((a, b) => a.code - b.code);

  if (entries.length === 0) {
    return <span className="font-mono text-xs text-[var(--text-faint)]">—</span>;
  }

  return (
    <div data-slot="bristol-breakdown" className="flex flex-wrap items-center gap-1">
      {entries.map((e) => (
        <Tooltip key={e.code}>
          <TooltipTrigger asChild>
            <span
              className="flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px]"
              style={{
                color: bristolColor(e.code),
                background: `color-mix(in srgb, ${bristolColor(e.code)} 12%, transparent)`,
              }}
            >
              <span className="font-bold">{e.code}</span>
              <span className="opacity-70">×{e.count}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Bristol {e.code}: {e.count}×
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
