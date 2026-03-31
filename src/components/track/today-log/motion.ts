export const logGroupChevronTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const logGroupExpandTransition = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const logGroupExpandVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    y: -6,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    y: 0,
  },
};
