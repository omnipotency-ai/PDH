import { Link } from "@tanstack/react-router";
import { format, isSameDay } from "date-fns";
import { Brain, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DrPooFullReport } from "@/components/dr-poo/DrPooReport";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseAiInsight } from "@/lib/aiAnalysis";
import { useAiAnalysisHistory, useToggleReportStar } from "@/lib/sync";
import type { AiNutritionistInsight } from "@/types/domain";

interface ArchiveReport {
  id: string;
  timestamp: number;
  insight: AiNutritionistInsight;
  starred: boolean;
}

export default function ArchivePage() {
  const history = useAiAnalysisHistory(50);
  const toggleStar = useToggleReportStar();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [starFilter, setStarFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const allReports = useMemo(() => {
    if (!history) return [] as ArchiveReport[];
    return history
      .filter((r) => !r.error && r.insight !== null)
      .reduce<ArchiveReport[]>((acc, r) => {
        const insight = parseAiInsight(r.insight);
        if (insight) {
          acc.push({
            id: String(r.id),
            timestamp: r.timestamp,
            insight,
            starred: r.starred,
          });
        }
        return acc;
      }, []);
  }, [history]);

  const filteredReports = useMemo(() => {
    let reports = allReports;

    if (dateFilter) {
      reports = reports.filter((r: ArchiveReport) => isSameDay(new Date(r.timestamp), dateFilter));
    }
    if (starFilter) {
      reports = reports.filter((r: ArchiveReport) => r.starred);
    }

    return reports;
  }, [allReports, dateFilter, starFilter]);

  const currentReport = filteredReports[currentIndex] ?? null;

  const handlePrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(filteredReports.length - 1, i + 1));
  }, [filteredReports.length]);

  const handleToggleStar = useCallback(async () => {
    if (!currentReport) return;
    await toggleStar(currentReport.id);
  }, [currentReport, toggleStar]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    setDateFilter(date);
    setDatePickerOpen(false);
    setCurrentIndex(0);
  }, []);

  const handleStarFilterChange = useCallback((checked: boolean) => {
    setStarFilter(checked);
    setCurrentIndex(0);
  }, []);

  const clearFilters = useCallback(() => {
    setStarFilter(false);
    setDateFilter(undefined);
    setCurrentIndex(0);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext]);

  const hasActiveFilters = starFilter || dateFilter !== undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <ChevronLeft size={14} />
        Back to Track
      </Link>

      {/* Page header */}
      <div className="flex items-center gap-2">
        <div
          className="section-icon"
          style={{
            background: "var(--section-log-muted)",
            color: "var(--section-log)",
          }}
        >
          <Brain size={16} />
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text)]">
          Dr. Poo Report Archive
        </h1>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date picker */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                dateFilter
                  ? "border-[var(--section-log)] bg-[var(--section-log-muted)] text-[var(--section-log)]"
                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {dateFilter ? format(dateFilter, "d MMM yyyy") : "Jump to date"}
            </button>
          </PopoverTrigger>
          <PopoverContent aria-label="Jump to date" className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={handleDateSelect}
              defaultMonth={dateFilter ?? new Date()}
            />
          </PopoverContent>
        </Popover>

        {/* Filter: All | Starred segmented control */}
        <fieldset className="inline-flex items-center gap-2 border-none p-0 m-0">
          <legend className="sr-only">Report filter</legend>
          <span className="text-xs font-medium text-[var(--text-faint)]">Filter:</span>
          <div
            data-slot="filter-segmented"
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-1)] text-xs"
          >
            <label
              className={`cursor-pointer rounded-l-lg px-3 py-1.5 font-medium transition-colors ${
                !starFilter
                  ? "bg-[var(--section-log-muted)] text-[var(--section-log)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <input
                type="radio"
                name="report-filter"
                className="sr-only"
                checked={!starFilter}
                onChange={() => handleStarFilterChange(false)}
              />
              All
            </label>
            <label
              className={`cursor-pointer rounded-r-lg px-3 py-1.5 font-medium transition-colors ${
                starFilter
                  ? "bg-[var(--section-log-muted)] text-[var(--section-log)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <input
                type="radio"
                name="report-filter"
                className="sr-only"
                checked={starFilter}
                onChange={() => handleStarFilterChange(true)}
              />
              Starred
            </label>
          </div>
        </fieldset>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Navigation bar + Report */}
      {!history ? (
        // Loading skeleton
        <div className="glass-card animate-pulse space-y-4 p-6">
          <div className="h-4 w-1/3 rounded bg-[var(--surface-3)]" />
          <div className="h-3 w-full rounded bg-[var(--surface-3)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--surface-3)]" />
          <div className="h-3 w-5/6 rounded bg-[var(--surface-3)]" />
        </div>
      ) : filteredReports.length === 0 ? (
        // Empty state
        <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
          <Brain size={32} className="text-[var(--section-log)] opacity-30" />
          <p className="text-sm text-[var(--text-faint)]">
            {allReports.length === 0
              ? "No Dr. Poo reports yet. Log a bowel movement or send Dr. Poo a question on the Track page to generate your first report."
              : "No reports match your filters."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[var(--section-log)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : currentReport ? (
        <div className="space-y-3">
          {/* Nav bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= filteredReports.length - 1}
              aria-label="Go to older analyses"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Older
            </button>

            <p className="font-mono text-xs text-[var(--text-faint)]">
              {format(new Date(currentReport.timestamp), "EEE d MMM yyyy · HH:mm")}
            </p>

            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              aria-label="Go to newer analyses"
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Newer
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Report card */}
          <div className="glass-card glass-card-log p-5">
            {/* Card header with report index and star action */}
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">
                Report {filteredReports.length - currentIndex} of {filteredReports.length}
              </p>
              <button
                type="button"
                onClick={handleToggleStar}
                className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  currentReport.starred
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-400"
                }`}
                aria-label={currentReport.starred ? "Unstar report" : "Star report"}
              >
                <Star
                  size={16}
                  className={currentReport.starred ? "fill-amber-400 text-amber-400" : ""}
                />
                {currentReport.starred ? "Starred" : "Star"}
              </button>
            </div>

            <DrPooFullReport insights={currentReport.insight} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
