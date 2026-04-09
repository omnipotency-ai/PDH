import type { SortDirection } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

// ── Sort indicator ──────────────────────────────────────────────────────────

export function SortIndicator({
  direction,
}: {
  direction: false | SortDirection;
}) {
  if (direction === "asc") {
    return <ArrowUp size={12} className="shrink-0" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} className="shrink-0" />;
  }
  return <ArrowUpDown size={12} className="shrink-0 opacity-30" />;
}

// ── Skeleton loading rows ───────────────────────────────────────────────────

export function SkeletonRows({ columnCount }: { columnCount: number }) {
  const widths = ["w-32", "w-12", "w-20", "w-24", "w-16", "w-20"];
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton indices
        <tr key={rowIdx} className="border-b border-[var(--border)]">
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton indices
            <td key={colIdx} className="px-3 py-2.5">
              <div
                className={cn(
                  "h-4 animate-pulse rounded bg-[var(--surface-2)]",
                  widths[(rowIdx + colIdx) % widths.length],
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
