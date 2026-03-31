import React, { type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable label shown in the fallback (e.g., "Food matching", "AI insights"). */
  label: string;
  /**
   * Optional custom fallback renderer. Receives a reset callback to retry rendering
   * the children. When omitted, a default calm fallback UI is shown.
   */
  fallback?: (props: { reset: () => void; label: string }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

/**
 * Generic error boundary for wrapping sub-sections of a page.
 *
 * A crash inside the children will be caught here and replaced with a calm,
 * non-alarming fallback. The rest of the page continues to work.
 *
 * Usage:
 *   <ErrorBoundary label="Food matching">
 *     <FoodMatchingModal ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback({
        reset: this.handleReset,
        label: this.props.label,
      });
    }

    return (
      <div
        data-slot="error-boundary-fallback"
        className="rounded-xl border border-[var(--red)]/20 bg-[var(--surface-1)] p-4"
      >
        <p className="text-sm font-medium text-[var(--text)]">
          Something went wrong in {this.props.label}.
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          This section hit an unexpected error. The rest of the page is unaffected.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-[var(--surface-0)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
