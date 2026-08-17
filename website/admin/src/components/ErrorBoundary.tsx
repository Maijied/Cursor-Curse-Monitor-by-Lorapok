import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorState from "./ui/ErrorState";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Admin UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen mesh-bg flex items-center justify-center p-8">
          <div className="max-w-lg w-full">
            <ErrorState title="Dashboard error" message={this.state.error.message} />
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-4 text-sm text-[var(--color-accent-2)] hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
