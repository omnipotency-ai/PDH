import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  CopyReportButton,
  DrPooReportDetails,
} from "@/components/dr-poo/DrPooReport";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AiNutritionistInsight } from "@/types/domain";

interface AiInsightsBodyProps {
  insights: AiNutritionistInsight;
}

export function AiInsightsBody({ insights }: AiInsightsBodyProps) {
  const [reportOpen, setReportOpen] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  return (
    <div data-slot="ai-insights-body" className="space-y-4">
      {/* Full report details */}
      <Collapsible open={reportOpen} onOpenChange={setReportOpen}>
        <div className="flex items-center justify-end gap-2 pr-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-[11px] text-[var(--section-log)] hover:underline"
            >
              {reportOpen ? "collapse report" : "expand report"}
            </button>
          </CollapsibleTrigger>
          {reportOpen && (
            <>
              <span className="text-[11px] text-[var(--text-faint)]">|</span>
              <CopyReportButton containerRef={reportRef} />
            </>
          )}
          <span className="text-[11px] text-[var(--text-faint)]">|</span>
          <Link
            to="/archive"
            className="text-[11px] text-[var(--section-log)] hover:underline"
          >
            see full report archive
          </Link>
        </div>
        <CollapsibleContent>
          <div ref={reportRef} className="mt-3">
            <DrPooReportDetails insights={insights} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
