import type { Station, SubLine, Track, Zone } from "@/data/transitData";

export interface FocusedStation {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  imageSrc?: string;
}

export interface PositionedStation extends FocusedStation {
  x: number;
  y: number;
}

export interface PositionedTrack {
  key: string;
  zone: Zone;
  track: Track;
  path: string;
  stations: PositionedStation[];
  chipX: number;
  chipY: number;
  chipAlign: "start" | "middle" | "end";
}

export interface TooltipState {
  x: number;
  y: number;
  stationId: string;
}

export interface StatusCounts {
  safe: number;
  testing: number;
  watch: number;
  avoid: number;
  untested: number;
}
