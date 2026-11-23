/**
 * Platform bridge. All Tauri-specific code lives here so a web build can swap it out.
 * Falls back to localStorage / browser download when not running inside Tauri.
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const localStore: KeyValueStore = {
  get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = window.localStorage.getItem(`lyvan-payout:${key}`);
      return Promise.resolve(raw === null ? undefined : (JSON.parse(raw) as T));
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  },
  set(key: string, value: unknown): Promise<void> {
    try {
      window.localStorage.setItem(`lyvan-payout:${key}`, JSON.stringify(value));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  },
};

let cached: KeyValueStore | undefined;

/** Persistent store: `%APPDATA%\se.lyvan.payout\store.json` in the desktop app. */
export async function getStore(): Promise<KeyValueStore> {
  if (cached) return cached;
  if (isTauri()) {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load('store.json', { autoSave: false, defaults: {} });
    cached = {
      async get<T>(key: string) {
        return (await store.get<T>(key)) ?? undefined;
      },
      async set(key: string, value: unknown) {
        await store.set(key, value);
        // Written explicitly (not debounced by the plugin) so a quick window close cannot lose data.
        await store.save();
      },
    };
  } else {
    cached = localStore;
  }
  return cached;
}

/** Save a text file via the native dialog (desktop) or a browser download. Returns the path/name, or null if cancelled. */
export async function saveTextFile(defaultName: string, content: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: defaultName, filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (!path) return null;
    await writeTextFile(path, content);
    return path;
  }
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  a.click();
  // Give the browser a moment to start the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return defaultName;
}

/** Open the print dialog (WebView2 / browser). The print stylesheet shows the report. */
export function printPage(): void {
  window.print();
}

/** Print the one-page offer sheet instead of the full report (see `html[data-print]` in the CSS). */
export function printOfferSheet(): void {
  const root = document.documentElement;
  root.dataset.print = 'offer';
  const done = (): void => {
    delete root.dataset.print;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}
