/**
 * Bristol Scale SVG illustration shape data.
 *
 * Each entry describes the SVG child elements for a Bristol type illustration.
 * The `mid` placeholder in path strings should be replaced at render time with `size / 2`.
 */

export interface BristolCircle {
  type: "circle";
  /** Offset from midpoint */
  cx: number;
  /** Offset from midpoint */
  cy: number;
  r: number;
  fill: string;
  opacity: number;
}

export interface BristolEllipse {
  type: "ellipse";
  /** Offset from midpoint */
  cx: number;
  /** Offset from midpoint */
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  opacity: number;
}

export interface BristolRect {
  type: "rect";
  /** Offset from midpoint for x position */
  xOffset: number;
  /** Offset from midpoint for y position */
  yOffset: number;
  width: number;
  height: number;
  rx: number;
  fill: string;
  opacity: number;
}

export interface BristolLine {
  type: "line";
  /** Offset from midpoint */
  x1: number;
  /** Offset from midpoint */
  y1: number;
  /** Offset from midpoint */
  x2: number;
  /** Offset from midpoint */
  y2: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface BristolPath {
  type: "path";
  /**
   * A function that takes `mid` and returns the SVG path `d` attribute.
   */
  d: (mid: number) => string;
  fill: string;
  opacity: number;
}

export type BristolShape = BristolCircle | BristolEllipse | BristolRect | BristolLine | BristolPath;

export const BRISTOL_LABELS: Record<number, string> = {
  1: "Type 1: Separate hard lumps",
  2: "Type 2: Lumpy and sausage-like",
  3: "Type 3: Sausage with cracks on surface",
  4: "Type 4: Smooth, soft sausage or snake",
  5: "Type 5: Soft blobs with clear-cut edges",
  6: "Type 6: Mushy with ragged edges",
  7: "Type 7: Liquid, no solid pieces",
};

/**
 * SVG shape definitions for each Bristol type (1-7).
 * Coordinates use offsets relative to the midpoint of the SVG.
 */
export const BRISTOL_ILLUSTRATION_SHAPES: Record<number, BristolShape[]> = {
  // Type 1: Separate hard lumps
  1: [
    { type: "circle", cx: -7, cy: -5, r: 4, fill: "#f87171", opacity: 0.7 },
    { type: "circle", cx: 5, cy: -3, r: 3.5, fill: "#f87171", opacity: 0.6 },
    { type: "circle", cx: -3, cy: 5, r: 4.5, fill: "#f87171", opacity: 0.8 },
    { type: "circle", cx: 7, cy: 4, r: 3, fill: "#f87171", opacity: 0.5 },
    { type: "circle", cx: 0, cy: -8, r: 3, fill: "#f87171", opacity: 0.6 },
  ],

  // Type 2: Lumpy sausage
  2: [
    {
      type: "path",
      d: (mid) =>
        `M${mid - 10},${mid} Q${mid - 10},${mid - 5} ${mid - 6},${mid - 5} Q${mid - 2},${mid - 7} ${mid + 2},${mid - 5} Q${mid + 6},${mid - 7} ${mid + 10},${mid - 4} Q${mid + 12},${mid} ${mid + 10},${mid + 4} Q${mid + 6},${mid + 7} ${mid + 2},${mid + 5} Q${mid - 2},${mid + 7} ${mid - 6},${mid + 5} Q${mid - 10},${mid + 5} ${mid - 10},${mid} Z`,
      fill: "#fb923c",
      opacity: 0.7,
    },
    { type: "circle", cx: -5, cy: -2, r: 2, fill: "#fdba74", opacity: 0.5 },
    { type: "circle", cx: 3, cy: 1, r: 2.5, fill: "#fdba74", opacity: 0.4 },
    { type: "circle", cx: -1, cy: 3, r: 1.5, fill: "#fdba74", opacity: 0.4 },
  ],

  // Type 3: Sausage with cracks
  3: [
    {
      type: "rect",
      xOffset: -12,
      yOffset: -5,
      width: 24,
      height: 10,
      rx: 5,
      fill: "#34d399",
      opacity: 0.7,
    },
    {
      type: "line",
      x1: -4,
      y1: -4,
      x2: -3,
      y2: -1,
      stroke: "#6ee7b7",
      strokeWidth: 1,
      opacity: 0.6,
    },
    {
      type: "line",
      x1: 2,
      y1: -4,
      x2: 3,
      y2: -1,
      stroke: "#6ee7b7",
      strokeWidth: 1,
      opacity: 0.6,
    },
    {
      type: "line",
      x1: 7,
      y1: -3,
      x2: 6,
      y2: 0,
      stroke: "#6ee7b7",
      strokeWidth: 1,
      opacity: 0.5,
    },
  ],

  // Type 4: Smooth and soft (ideal)
  4: [
    {
      type: "rect",
      xOffset: -12,
      yOffset: -4.5,
      width: 24,
      height: 9,
      rx: 4.5,
      fill: "#34d399",
      opacity: 0.75,
    },
    {
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 10,
      ry: 3.5,
      fill: "#6ee7b7",
      opacity: 0.3,
    },
  ],

  // Type 5: Soft blobs
  5: [
    {
      type: "ellipse",
      cx: -6,
      cy: -3,
      rx: 5,
      ry: 4,
      fill: "#84cc16",
      opacity: 0.6,
    },
    {
      type: "ellipse",
      cx: 5,
      cy: -1,
      rx: 4.5,
      ry: 3.5,
      fill: "#84cc16",
      opacity: 0.5,
    },
    {
      type: "ellipse",
      cx: -2,
      cy: 4,
      rx: 5.5,
      ry: 4,
      fill: "#a3e635",
      opacity: 0.7,
    },
  ],

  // Type 6: Mushy, fluffy
  6: [
    {
      type: "ellipse",
      cx: 0,
      cy: 0,
      rx: 12,
      ry: 8,
      fill: "#fb923c",
      opacity: 0.4,
    },
    {
      type: "ellipse",
      cx: -3,
      cy: -2,
      rx: 6,
      ry: 4,
      fill: "#fb923c",
      opacity: 0.3,
    },
    {
      type: "ellipse",
      cx: 4,
      cy: 2,
      rx: 5,
      ry: 3,
      fill: "#fdba74",
      opacity: 0.3,
    },
    { type: "circle", cx: -5, cy: 1, r: 2, fill: "#fdba74", opacity: 0.3 },
  ],

  // Type 7: Liquid
  7: [
    {
      type: "ellipse",
      cx: 0,
      cy: 2,
      rx: 13,
      ry: 7,
      fill: "#f87171",
      opacity: 0.3,
    },
    {
      type: "ellipse",
      cx: -4,
      cy: 0,
      rx: 8,
      ry: 5,
      fill: "#f87171",
      opacity: 0.25,
    },
    {
      type: "ellipse",
      cx: 3,
      cy: 1,
      rx: 6,
      ry: 4,
      fill: "#fca5a5",
      opacity: 0.25,
    },
    { type: "circle", cx: 6, cy: -4, r: 2, fill: "#fca5a5", opacity: 0.4 },
    { type: "circle", cx: -7, cy: -3, r: 1.5, fill: "#fca5a5", opacity: 0.3 },
  ],
};
