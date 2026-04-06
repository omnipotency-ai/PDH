import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class NutritionCardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[NutritionCard] Render error:", error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" data-slot="nutrition-card-error" className="glass-card space-y-3 p-4">
          <p style={{ color: "var(--text-muted)" }} className="text-sm">
            Nutrition tracking is temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--text-muted)", color: "var(--text)" }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
