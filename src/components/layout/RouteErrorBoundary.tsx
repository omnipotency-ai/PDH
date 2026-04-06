import React, { type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Route render error:", error);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="mx-auto my-8 max-w-xl rounded-2xl border border-(--red)/40 bg-(--surface-1) p-5">
        <h2 className="text-base font-bold text-(--text)">
          {this.props.label} crashed
        </h2>
        <p className="mt-1 text-sm text-(--text-muted)">
          The page hit an unexpected error. You can retry without losing the
          rest of the app.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-lg bg-(--surface-0) px-3 py-1.5 text-xs font-semibold text-(--text)"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-(--text-muted)"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export function withBoundary(label: string, node: ReactNode) {
  return <RouteErrorBoundary label={label}>{node}</RouteErrorBoundary>;
}
