import type { SmartViewPreset } from "./smartViewUtils";

export type { SmartViewPreset };
export {
  columnFiltersEqual,
  countRowsForView,
  normalizeColumnFilters,
  normalizeSorting,
  rowMatchesFilters,
  sortingEqual,
} from "./smartViewUtils";

export interface SmartViewsProps {
  views: SmartViewPreset[];
  activeViewId: string | null;
  counts?: Record<string, number>;
  onSelectView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
}

export function SmartViews({
  views,
  activeViewId,
  counts,
  onSelectView,
  onDeleteView,
}: SmartViewsProps) {
  return (
    <div data-slot="smart-views" className="flex flex-wrap gap-2">
      {views.map((view) => {
        const isActive = activeViewId === view.id;
        const count = counts?.[view.id];

        return (
          <div
            key={view.id}
            className={[
              "inline-flex items-center rounded-lg border",
              isActive
                ? "border-[var(--border-strong)] bg-[var(--surface-3)]"
                : "border-[var(--border)] bg-transparent",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onSelectView(view.id)}
              data-active={isActive || undefined}
              className={[
                "inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {view.label}
              {count !== undefined && (
                <span
                  className={[
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-tight",
                    isActive
                      ? "bg-[var(--surface-2)] text-[var(--text)]"
                      : "bg-[var(--surface-2)] text-[var(--text-faint)]",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>

            {!view.builtIn && (
              <button
                type="button"
                onClick={() => onDeleteView(view.id)}
                className="inline-flex min-h-11 items-center border-l border-[var(--border)] px-2 font-mono text-[10px] uppercase tracking-wide text-[var(--text-faint)] transition-colors hover:text-red-300"
                aria-label={`Delete smart view ${view.label}`}
                title={`Delete ${view.label}`}
              >
                Del
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
