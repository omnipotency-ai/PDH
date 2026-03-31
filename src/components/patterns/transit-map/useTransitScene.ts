import { useMemo } from "react";
import type { Station, SubLine, Track, Zone } from "@/data/transitData";
import { INTERCHANGE_A, INTERCHANGE_B } from "./constants";
import type { PositionedStation, PositionedTrack, StatusCounts } from "./types";
import { resolveArtworkKey } from "./useStationArtwork";
import { distribute, makeStatusCounts } from "./utils";

function createPositionedStation({
  station,
  zone,
  track,
  subLine,
  x,
  y,
  artworkUrls,
}: {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  x: number;
  y: number;
  artworkUrls: Record<string, string>;
}): PositionedStation {
  const artworkKey = resolveArtworkKey(station);
  const imageSrc = artworkKey !== undefined ? artworkUrls[artworkKey] : undefined;

  return {
    station,
    zone,
    track,
    subLine,
    x,
    y,
    ...(imageSrc !== undefined && { imageSrc }),
  };
}

function buildScene(subLine: SubLine, artworkUrls: Record<string, string>): PositionedTrack[] {
  const tracks: PositionedTrack[] = [];
  const [zoneOne, zoneTwo, zoneThree] = subLine.zones;

  if (zoneOne?.tracks[0]) {
    const x = 162;
    const yPoints = distribute(192, 570, zoneOne.tracks[0].stations.length);
    tracks.push({
      key: zoneOne.tracks[0].id,
      zone: zoneOne,
      track: zoneOne.tracks[0],
      path: `M ${x} 166 V 612 Q ${x} 656 204 656 H 270 Q 312 656 312 610 V ${INTERCHANGE_A.y} H ${INTERCHANGE_A.x}`,
      chipX: 86,
      chipY: 154,
      chipAlign: "start",
      stations: zoneOne.tracks[0].stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneOne,
          track: zoneOne.tracks[0],
          subLine,
          x,
          y: yPoints[index] ?? 192,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[0]) {
    const topTrack = zoneTwo.tracks[0];
    const topXPositions = distribute(486, 668, topTrack.stations.length);
    tracks.push({
      key: topTrack.id,
      zone: zoneTwo,
      track: topTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 302 H 676 Q 748 302 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 258,
      chipAlign: "start",
      stations: topTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: topTrack,
          subLine,
          x: topXPositions[index] ?? 486,
          y: 302,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[1]) {
    const bottomTrack = zoneTwo.tracks[1];
    const bottomXPositions = distribute(486, 668, bottomTrack.stations.length);
    tracks.push({
      key: bottomTrack.id,
      zone: zoneTwo,
      track: bottomTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 554 H 676 Q 748 554 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 594,
      chipAlign: "start",
      stations: bottomTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: bottomTrack,
          subLine,
          x: bottomXPositions[index] ?? 486,
          y: 554,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneThree) {
    const trackCount = zoneThree.tracks.length;
    const offsets = distribute(-170, 170, trackCount);
    for (const [index, track] of zoneThree.tracks.entries()) {
      const rowY = INTERCHANGE_B.y + (offsets[index] ?? 0);
      const chipY = rowY < INTERCHANGE_B.y ? rowY - 30 : rowY + 42;
      const branchStartX = rowY === INTERCHANGE_B.y ? 944 : 986;
      const path =
        rowY === INTERCHANGE_B.y
          ? `M 882 ${INTERCHANGE_B.y} H 1262`
          : `M 882 ${INTERCHANGE_B.y} Q 932 ${INTERCHANGE_B.y} 986 ${rowY} H 1262`;

      tracks.push({
        key: track.id,
        zone: zoneThree,
        track,
        path,
        chipX: branchStartX,
        chipY,
        chipAlign: "start",
        stations: track.stations.map((station, stationIndex) =>
          createPositionedStation({
            station,
            zone: zoneThree,
            track,
            subLine,
            x:
              distribute(branchStartX + 58, 1226, track.stations.length)[stationIndex] ??
              branchStartX + 58,
            y: rowY,
            artworkUrls,
          }),
        ),
      });
    }
  }

  return tracks;
}

/**
 * Extract all stations from a SubLine. Used both by useTransitScene
 * and by the artwork hook (to know which images to load).
 */
export function collectSubLineStations(subLine: SubLine | undefined): Station[] {
  if (!subLine) return [];
  return subLine.zones.flatMap((zone) => zone.tracks.flatMap((track) => track.stations));
}

interface TransitScene {
  positionedTracks: PositionedTrack[];
  stationLookup: Map<string, PositionedStation>;
  counts: StatusCounts;
  defaultStation: PositionedStation | null;
}

/**
 * Hook that builds the positioned transit scene from a SubLine and loaded artwork.
 * Extracts all scene-building, station lookup, and status counting logic.
 */
export function useTransitScene(
  activeSubLine: SubLine | undefined,
  artworkUrls: Record<string, string>,
): TransitScene {
  const positionedTracks = useMemo(
    () => (activeSubLine ? buildScene(activeSubLine, artworkUrls) : []),
    [activeSubLine, artworkUrls],
  );

  const stationLookup = useMemo(() => {
    const entries = positionedTracks.flatMap((track) =>
      track.stations.map((station) => [station.station.id, station] as const),
    );
    return new Map<string, PositionedStation>(entries);
  }, [positionedTracks]);

  const counts = useMemo(() => {
    const next = makeStatusCounts();
    for (const track of positionedTracks) {
      for (const station of track.stations) {
        next[station.station.status] += 1;
      }
    }
    return next;
  }, [positionedTracks]);

  const defaultStation = useMemo(() => {
    const current = positionedTracks
      .flatMap((track) => track.stations)
      .find((station) => station.station.isCurrent);
    return current ?? positionedTracks[0]?.stations[0] ?? null;
  }, [positionedTracks]);

  return {
    positionedTracks,
    stationLookup,
    counts,
    defaultStation,
  };
}
