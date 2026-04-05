"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Playground } from "@/components/Playground";

type PlaygroundBoundaryProps = {
  children?: ReactNode;
};

type PlaygroundBoundaryState = {
  hasError: boolean;
};

class PlaygroundErrorBoundary extends Component<
  PlaygroundBoundaryProps,
  PlaygroundBoundaryState
> {
  public override state: PlaygroundBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): PlaygroundBoundaryState {
    return {
      hasError: true,
    };
  }

  public override componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // The fallback UI is the recovery path here; avoid noisy console logging in
    // production builds.
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <section className="rounded-[2rem] border border-red-200 bg-red-50 px-6 py-8 text-danger shadow-panel">
          <h2 className="text-2xl font-semibold text-ink">
            The playground hit an unexpected error.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-danger">
            Refresh the page to recover the in-browser engine and try the
            expression again.
          </p>
        </section>
      );
    }

    return this.props.children ?? <Playground />;
  }
}

export function PlaygroundBoundary() {
  return (
    <PlaygroundErrorBoundary>
      <Playground />
    </PlaygroundErrorBoundary>
  );
}
