import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { i18nReady } from './i18n';
import { startPersistence, useApp } from './state/store';

async function start(): Promise<void> {
  await i18nReady;
  // Persistence ignores changes until the stored state has been loaded.
  startPersistence();
  void useApp.getState().hydrate();

  const root = document.getElementById('root');
  if (!root) throw new Error('#root not found');
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void start();
