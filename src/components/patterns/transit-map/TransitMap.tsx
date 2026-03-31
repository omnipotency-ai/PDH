import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { MAIN_CATEGORIES, type MainCategory } from "@/data/transitData";
import {
  INTERCHANGE_A,
  INTERCHANGE_B,
  MAP_BACKGROUND,
  STATUS_ORDER,
  SVG_VIEWBOX,
  TRACK_COLOR_STROKE,
  TRACK_SHADOW_STROKE,
  ZONE_CARDS,
} from "./constants";
import { IntersectionNode } from "./IntersectionNode";
import { StationTooltip } from "./StationTooltip";
import { TrackSegment } from "./TrackSegment";
import { StatusPill, TransitMapInspector } from "./TransitMapInspector";
import type { TooltipState } from "./types";
import { useStationArtwork } from "./useStationArtwork";
import { collectSubLineStations, useTransitScene } from "./useTransitScene";
import { clamp, getCategoryShortLabel } from "./utils";
import { ZoneCard } from "./ZoneCard";

/** Hoisted to module scope so it does not re-render every frame. */
const TRANSIT_PULSE_KEYFRAMES = `
  @keyframes transit-pulse {
    0% { opacity: 0.72; transform: scale(1); }
    70% { opacity: 0; transform: scale(1.55); }
    100% { opacity: 0; transform: scale(1.55); }
  }
`;

export default function TransitMap() {
  const [activeCategoryId, setActiveCategoryId] = useState(MAIN_CATEGORIES[0]?.id ?? "");
  const [activeSubLineId, setActiveSubLineId] = useState(MAIN_CATEGORIES[0]?.subLines[0]?.id ?? "");
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgIdPrefix = useId().replace(/:/g, "");

  const activeCategory =
    MAIN_CATEGORIES.find((category) => category.id === activeCategoryId) ?? MAIN_CATEGORIES[0];
  const activeSubLine =
    activeCategory?.subLines.find((subLine) => subLine.id === activeSubLineId) ??
    activeCategory?.subLines[0];

  // Collect stations from SubLine data (no scene needed) for artwork loading.
  const stationsForArtwork = useMemo(() => collectSubLineStations(activeSubLine), [activeSubLine]);

  // Lazy-load artwork images for the current subline's stations.
  const artworkUrls = useStationArtwork(stationsForArtwork);

  // Build the positioned scene using the loaded artwork URLs.
  const { positionedTracks, stationLookup, counts, defaultStation } = useTransitScene(
    activeSubLine,
    artworkUrls,
  );

  useEffect(() => {
    if (!activeCategory) return;
    if (activeCategory.subLines.some((subLine) => subLine.id === activeSubLineId)) return;
    setActiveSubLineId(activeCategory.subLines[0]?.id ?? "");
  }, [activeCategory, activeSubLineId]);

  useEffect(() => {
    setSelectedStationId(defaultStation?.station.id ?? null);
    setHoveredStationId(null);
    setTooltip(null);
  }, [defaultStation?.station.id]);

  const activeStation =
    (hoveredStationId ? stationLookup.get(hoveredStationId) : undefined) ??
    (selectedStationId ? stationLookup.get(selectedStationId) : undefined) ??
    defaultStation;

  const testedCount = counts.safe + counts.testing + counts.watch + counts.avoid;

  const updateTooltip = useCallback((stationId: string, event: ReactMouseEvent<SVGGElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const nextX = clamp(event.clientX - rect.left + 14, 18, rect.width - 210);
    const nextY = clamp(event.clientY - rect.top - 70, 18, rect.height - 86);
    setTooltip({ x: nextX, y: nextY, stationId });
  }, []);

  const handleStationHover = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      setHoveredStationId(stationId);
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationMove = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationLeave = useCallback(() => {
    setHoveredStationId(null);
    setTooltip(null);
  }, []);

  const handleCategoryChange = useCallback((category: MainCategory) => {
    setActiveCategoryId(category.id);
    setActiveSubLineId(category.subLines[0]?.id ?? "");
  }, []);

  if (!activeCategory || !activeSubLine || !activeStation) {
    return (
      <section data-slot="transit-map-redesign" className="flex items-center justify-center p-8">
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const [zoneOne, zoneTwo, zoneThree] = activeSubLine.zones;
  if (!zoneOne || !zoneTwo || !zoneThree) {
    return (
      <section data-slot="transit-map-redesign" className="flex items-center justify-center p-8">
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const tooltipStation = tooltip ? stationLookup.get(tooltip.stationId) : undefined;
  const softShadowId = `${svgIdPrefix}-soft-shadow`;

  return (
    <section
      data-slot="transit-map-redesign"
      className="relative overflow-hidden rounded-[30px] border border-white/10 text-slate-50 shadow-[0_40px_120px_rgba(2,6,23,0.45)]"
      style={{ background: MAP_BACKGROUND }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_68%)] opacity-60" />

      {/* @keyframes transit-pulse is defined in TRANSIT_PULSE_KEYFRAMES below */}
      <style>{TRANSIT_PULSE_KEYFRAMES}</style>

      <div className="relative grid gap-5 p-4 md:p-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Mobile sidebar */}
        <aside className="xl:hidden">
          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Transit Atlas
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Food Lines</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Visual reference of the food reintroduction map with stations grouped by zone and
                line.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Status Key
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(0, 3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Families
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {MAIN_CATEGORIES.map((category) => {
                    const isActive = category.id === activeCategory.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => handleCategoryChange(category)}
                        className="min-w-0 rounded-full border px-1.5 py-2 text-center transition-colors"
                        style={{
                          background: isActive
                            ? `${category.accentColor}18`
                            : "rgba(255,255,255,0.04)",
                          borderColor: isActive
                            ? `${category.accentColor}42`
                            : "rgba(255,255,255,0.08)",
                        }}
                      >
                        <p
                          className="truncate font-display text-[11px] font-semibold"
                          style={{
                            color: isActive ? category.accentColor : "rgba(248,250,252,0.92)",
                          }}
                        >
                          {getCategoryShortLabel(category)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Transit Atlas
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">Food Lines</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Visual reference of the food reintroduction map with stations grouped by zone and
              line.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3">
            <p className="px-2 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Families
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {MAIN_CATEGORIES.map((category) => {
                const isActive = category.id === activeCategory.id;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => handleCategoryChange(category)}
                    className="rounded-[18px] border px-4 py-3 text-left transition-colors"
                    style={{
                      background: isActive ? `${category.accentColor}18` : "rgba(255,255,255,0.04)",
                      borderColor: isActive
                        ? `${category.accentColor}42`
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <p
                      className="font-display text-lg font-semibold"
                      style={{
                        color: isActive ? category.accentColor : "rgba(248,250,252,0.92)",
                      }}
                    >
                      {category.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {category.subLines.length} lines
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Status Key
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="min-w-0 flex flex-col gap-4">
          <header className="overflow-hidden rounded-[26px] border border-white/10 bg-[#06101b]/88 p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Active Corridor
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <h3 className="font-display text-4xl font-bold text-slate-50">
                    {activeSubLine.name}
                  </h3>
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{
                      color: activeCategory.accentColor,
                      borderColor: `${activeCategory.accentColor}34`,
                      background: `${activeCategory.accentColor}12`,
                    }}
                  >
                    {activeCategory.name}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Tap a station to inspect its details. Zones progress from safe foods to more
                  experimental options.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Stops",
                    value: `${positionedTracks.flatMap((track) => track.stations).length}`,
                  },
                  { label: "Tested", value: `${testedCount}` },
                  { label: "Safe", value: `${counts.safe}` },
                  { label: "At Risk", value: `${counts.watch + counts.avoid}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-slate-50">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {activeCategory.subLines.map((subLine) => {
                const isActive = subLine.id === activeSubLine.id;
                return (
                  <button
                    type="button"
                    key={subLine.id}
                    onClick={() => setActiveSubLineId(subLine.id)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: isActive ? `${subLine.color}1f` : "rgba(255,255,255,0.04)",
                      borderColor: isActive ? `${subLine.color}50` : "rgba(255,255,255,0.08)",
                      color: isActive ? subLine.color : "rgba(226,232,240,0.72)",
                    }}
                  >
                    {subLine.name}
                  </button>
                );
              })}
            </div>
          </header>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#040a13]/90 p-2"
          >
            <div className="px-2 pb-2 md:hidden">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Swipe left or right to explore the full line map
              </p>
            </div>
            <div className="max-w-full overflow-x-auto overflow-y-hidden pb-2 touch-pan-x">
              <svg
                viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
                className="min-h-[34rem] w-[1220px] max-w-none sm:w-[1320px] md:w-full md:max-w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <title>{`${activeCategory.name} ${activeSubLine.name} transit map`}</title>

                <defs>
                  <filter id={softShadowId}>
                    <feDropShadow
                      dx="0"
                      dy="18"
                      stdDeviation="18"
                      floodColor="#020617"
                      floodOpacity="0.4"
                    />
                  </filter>
                  <clipPath id={`${svgIdPrefix}-frame-clip`}>
                    <rect
                      x="0"
                      y="0"
                      width={SVG_VIEWBOX.width}
                      height={SVG_VIEWBOX.height}
                      rx="36"
                    />
                  </clipPath>
                  <clipPath id={`${svgIdPrefix}-station-clip`} clipPathUnits="objectBoundingBox">
                    <circle cx="0.5" cy="0.5" r="0.5" />
                  </clipPath>
                </defs>

                <g clipPath={`url(#${svgIdPrefix}-frame-clip)`}>
                  <rect width={SVG_VIEWBOX.width} height={SVG_VIEWBOX.height} fill="transparent" />

                  <ZoneCard zone={zoneOne} index={0} rect={ZONE_CARDS.one} />
                  <ZoneCard zone={zoneTwo} index={1} rect={ZONE_CARDS.two} />
                  <ZoneCard zone={zoneThree} index={2} rect={ZONE_CARDS.three} />

                  {/* Interchange trunk segment */}
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke="rgba(4, 9, 18, 0.88)"
                    strokeWidth={TRACK_SHADOW_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke={activeSubLine.color}
                    strokeWidth={TRACK_COLOR_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {positionedTracks.map((track) => (
                    <TrackSegment
                      key={track.key}
                      track={track}
                      lineColor={activeSubLine.color}
                      svgIdPrefix={svgIdPrefix}
                      softShadowId={softShadowId}
                      selectedStationId={selectedStationId}
                      hoveredStationId={hoveredStationId}
                      onStationHover={handleStationHover}
                      onStationMove={handleStationMove}
                      onStationLeave={handleStationLeave}
                      onStationSelect={setSelectedStationId}
                    />
                  ))}

                  <IntersectionNode
                    x={INTERCHANGE_A.x}
                    y={INTERCHANGE_A.y}
                    color={activeSubLine.color}
                  />
                  <IntersectionNode
                    x={INTERCHANGE_B.x}
                    y={INTERCHANGE_B.y}
                    color={activeSubLine.color}
                  />

                  <g transform={`translate(${INTERCHANGE_A.x - 38}, ${INTERCHANGE_A.y - 92})`}>
                    <rect
                      width={94}
                      height={24}
                      rx={12}
                      fill="rgba(4, 9, 18, 0.78)"
                      stroke={`${activeSubLine.color}35`}
                    />
                    <text
                      x={47}
                      y={16}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontSize={10}
                      letterSpacing={1.6}
                      fill={activeSubLine.color}
                    >
                      INTERCHANGE
                    </text>
                  </g>

                  {defaultStation && (
                    <g transform={`translate(${defaultStation.x + 42}, ${defaultStation.y - 58})`}>
                      <rect
                        width={134}
                        height={44}
                        rx={18}
                        fill="rgba(4, 9, 18, 0.88)"
                        stroke="rgba(74, 222, 128, 0.35)"
                      />
                      <text
                        x={16}
                        y={17}
                        fontFamily="var(--font-mono)"
                        fontSize={10}
                        letterSpacing={1.6}
                        fill="#86efac"
                      >
                        YOU ARE HERE
                      </text>
                      <text
                        x={16}
                        y={32}
                        fontFamily="var(--font-display)"
                        fontSize={14}
                        fontWeight={700}
                        fill="rgba(248, 250, 252, 0.96)"
                      >
                        {defaultStation.station.name}
                      </text>
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {tooltip && tooltipStation && (
              <StationTooltip tooltip={tooltip} station={tooltipStation} />
            )}
          </div>
        </div>

        <TransitMapInspector
          activeStation={activeStation}
          selectedStationId={selectedStationId ?? activeStation.station.id}
          onSelectStation={setSelectedStationId}
        />
      </div>
    </section>
  );
}
