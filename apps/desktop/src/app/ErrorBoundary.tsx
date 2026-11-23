import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a crash in one view must not leave a blank window. Validation problems are
 * handled where they occur (see ScenarioFailures); this only catches genuine bugs.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local-only app: no telemetry. The console is the only place details go.
    console.error('LYVAN Payout view crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-lg rounded-lg border border-red-300 bg-red-50 p-6 text-red-900">
        <h1 className="mb-2 text-lg font-semibold">{i18n.t('error.boundaryTitle')}</h1>
        <p className="mb-3 text-sm">{i18n.t('error.boundaryBody')}</p>
        <pre className="mb-3 max-h-40 overflow-auto rounded bg-white p-2 text-xs">{this.state.error.message}</pre>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          {i18n.t('error.reload')}
        </button>
      </div>
    );
  }
}
