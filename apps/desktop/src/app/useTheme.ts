import { useEffect } from 'react';
import type { Theme } from '../state/model';

/**
 * Apply the light/dark theme to <html>. "system" follows the OS setting live. Printing always uses
 * the light theme so the report is dark text on white paper.
 */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
    };
    const forceLight = (): void => {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    window.addEventListener('beforeprint', forceLight);
    window.addEventListener('afterprint', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('beforeprint', forceLight);
      window.removeEventListener('afterprint', apply);
    };
  }, [theme]);
}
