/** Chakra energy center colors — Omnipotency AI signature palette */

export const CHAKRA = {
  root: "#E74C3C",
  sacral: "#f97316",
  solar: "#FFC700",
  heart: "#2dd4bf",
  throat: "#38bdf8",
  thirdEye: "#818cf8",
  crown: "#a78bfa",
} as const;

/** Ordered array for gradient rendering (root → crown) */
export const CHAKRA_SEQUENCE: readonly string[] = [
  CHAKRA.root,
  CHAKRA.sacral,
  CHAKRA.solar,
  CHAKRA.heart,
  CHAKRA.throat,
  CHAKRA.thirdEye,
  CHAKRA.crown,
];
