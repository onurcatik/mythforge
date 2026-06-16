import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "@/shared/ui/feedback/ErrorState";

type AccessibleErrorBoundaryProps = {
  children: ReactNode;
  label?: string;
  onReset?: () => void;
};

type AccessibleErrorBoundaryState = {
  error: Error | null;
};

export class AccessibleErrorBoundary extends Component<AccessibleErrorBoundaryProps, AccessibleErrorBoundaryState> {
  state: AccessibleErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AccessibleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Independent frontend route boundary", { error, errorInfo });
    }
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" aria-live="assertive" className="mx-auto max-w-3xl py-10">
        <ErrorState
          title={`${this.props.label ?? "This workspace view"} could not render`}
          description="The independent frontend recovered safely without changing backend data. Refresh the view or return to the dashboard."
          action={
            <button
              type="button"
              onClick={this.reset}
              className="rounded-full bg-[color:var(--ifx-text-primary)] px-4 py-2 font-medium text-[color:var(--ifx-surface-canvas)] text-sm transition hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }
}
