import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { err: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary", err, info.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center bg-background text-foreground">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.err.message}</p>
          <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>
            Reset
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
