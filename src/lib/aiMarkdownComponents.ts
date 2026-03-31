import type { Components } from "react-markdown";

/**
 * Shared react-markdown component overrides for AI-generated content.
 *
 * - `a`: Strips links — AI content must not render clickable anchors.
 *   javascript: URLs and external links are both disallowed (WQ-021).
 * - `img`: Blocks image tags entirely — prevents tracking beacons and
 *   unexpected external image loads from AI output.
 */
export const AI_MARKDOWN_COMPONENTS: Partial<Components> = {
  a: ({ children }) => children as React.ReactElement,
  img: () => null,
};
