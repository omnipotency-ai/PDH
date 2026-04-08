import { lazy, Suspense, useState } from "react";

const PatternsPage = lazy(() => import("./Patterns"));

export default function InsightsPage() {
  const [tab, setTab] = useState<"patterns" | "drpoo">("patterns");

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold text-(--text)">Insights</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("patterns")}
          className={
            tab === "patterns"
              ? "rounded-lg bg-(--surface-2) px-3 py-1.5 text-sm font-medium text-(--text)"
              : "rounded-lg px-3 py-1.5 text-sm font-medium text-(--text-muted)"
          }
        >
          Patterns
        </button>
        <button
          type="button"
          onClick={() => setTab("drpoo")}
          className={
            tab === "drpoo"
              ? "rounded-lg bg-(--surface-2) px-3 py-1.5 text-sm font-medium text-(--text)"
              : "rounded-lg px-3 py-1.5 text-sm font-medium text-(--text-muted)"
          }
        >
          Dr. Poo Report
        </button>
      </div>
      {tab === "patterns" ? (
        <Suspense fallback={null}>
          <PatternsPage />
        </Suspense>
      ) : (
        <p className="text-sm text-(--text-muted)">Dr. Poo Report - moved here in Wave 2.</p>
      )}
    </div>
  );
}
