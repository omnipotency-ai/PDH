import type { FoodGroup } from "@shared/foodRegistry";
import { Clock3, FlaskConical, Route, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { digestionBadgeClassName, getFoodDigestionBadges } from "@/lib/foodDigestionMetadata";
import { formatTransitHours } from "@/lib/trialFormatters";
import {
  confidenceLabel,
  serviceRecord,
  type TransitStation,
  tendencyLabel,
} from "@/types/transitMap";

// ── Props ─────────────────────────────────────────────────────────────────

export interface StationInspectorProps {
  station: TransitStation;
  corridorGroup: FoodGroup;
  corridorDisplayName: string;
  lineName: string;
}

// ── Corridor chip theming ─────────────────────────────────────────────────

const CORRIDOR_CHIP: Record<FoodGroup, string> = {
  protein: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  carbs: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  fats: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  seasoning: "border-rose-500/20 bg-rose-500/10 text-rose-200",
};

// ── Bristol label helpers ─────────────────────────────────────────────────

function bristolLabel(code: number): string {
  switch (code) {
    case 1:
      return "Type 1: separate hard lumps";
    case 2:
      return "Type 2: lumpy sausage";
    case 3:
      return "Type 3: cracked sausage";
    case 4:
      return "Type 4: smooth sausage";
    case 5:
      return "Type 5: soft blobs";
    case 6:
      return "Type 6: loose";
    case 7:
      return "Type 7: watery";
    default:
      return `Type ${code}`;
  }
}

function bristolBarColor(code: number): string {
  if (code <= 2) return "bg-amber-500";
  if (code <= 5) return "bg-emerald-500";
  if (code === 6) return "bg-amber-400";
  return "bg-rose-500";
}

// ── Sub-components ────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StationInspector({
  station,
  corridorGroup,
  corridorDisplayName,
  lineName,
}: StationInspectorProps): ReactNode {
  const digestionBadges = getFoodDigestionBadges(station.digestion);
  const service = serviceRecord(station);
  const chipClass = CORRIDOR_CHIP[corridorGroup];

  // Bristol breakdown — convert Record<number, number> to sorted array
  const bristolEntries = Object.entries(station.bristolBreakdown)
    .map(([code, count]) => ({ code: Number(code), count }))
    .sort((a, b) => a.code - b.code);

  const bristolTotal = bristolEntries.reduce((sum, e) => sum + e.count, 0);

  const avgTransitDisplay =
    station.avgTransitMinutes === null ? "Pending" : formatTransitHours(station.avgTransitMinutes);

  return (
    <div data-slot="station-inspector" className="space-y-5">
      {/* Station header */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Selected station
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {station.displayName}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {corridorDisplayName} · {lineName}
            </p>
          </div>
          <div
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${chipClass}`}
          >
            Zone {station.zone}
            {station.subzone !== undefined ? ` · ${station.subzone}` : ""}
          </div>
        </div>
      </div>

      {/* Signal metrics row */}
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          icon={<Route className="h-4 w-4" />}
          label="Status"
          value={station.primaryStatus ?? "Untested"}
        />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Confidence"
          value={confidenceLabel(station.confidence)}
        />
        <MetricCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Tendency"
          value={tendencyLabel(station.tendency) ?? "No signal"}
        />
      </div>

      {/* Registry notes */}
      {station.notes !== undefined && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Registry note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{station.notes}</p>
        </section>
      )}

      {/* Digestion profile */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Digestion profile
          </p>
        </div>
        {digestionBadges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No digestion metadata attached yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {digestionBadges.map((badge) => (
              <span key={badge.key} className={digestionBadgeClassName(badge.tone)}>
                {badge.label}: {badge.value}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Evidence overlay */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Evidence overlay
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceStat label="Trials logged" value={`${station.totalTrials}`} />
          <EvidenceStat label="Resolved transits" value={`${station.resolvedTransits}`} />
          <EvidenceStat label="Avg transit" value={avgTransitDisplay} />
          <EvidenceStat label="Service record" value={service ?? "No record yet"} />
        </div>
      </section>

      {/* Bristol breakdown */}
      {bristolEntries.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Bristol breakdown
          </p>
          <div className="mt-3 space-y-2">
            {bristolEntries.map(({ code, count }) => {
              const pct = bristolTotal > 0 ? Math.round((count / bristolTotal) * 100) : 0;
              return (
                <div key={code}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">{bristolLabel(code)}</p>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {count}x · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${bristolBarColor(code)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI verdict */}
      {station.latestAiVerdict !== null && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            AI verdict
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{station.latestAiVerdict}</p>
          {station.latestAiReasoning !== null && (
            <p className="mt-2 text-xs leading-5 text-slate-500">{station.latestAiReasoning}</p>
          )}
        </section>
      )}
    </div>
  );
}
