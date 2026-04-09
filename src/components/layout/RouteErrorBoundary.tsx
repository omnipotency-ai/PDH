import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function withBoundary(label: string, node: ReactNode) {
  return <ErrorBoundary label={label}>{node}</ErrorBoundary>;
}
