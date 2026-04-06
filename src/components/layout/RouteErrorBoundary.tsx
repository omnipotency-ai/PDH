import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { ReactNode } from "react";

export function withBoundary(label: string, node: ReactNode) {
  return <ErrorBoundary label={label}>{node}</ErrorBoundary>;
}
