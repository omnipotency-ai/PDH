/**
 * Debug logging utilities gated behind import.meta.env.DEV.
 * In production builds, these are no-ops.
 */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(`[${tag}]`, ...args);
  }
}

export function debugWarn(tag: string, ...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn(`[${tag}]`, ...args);
  }
}
