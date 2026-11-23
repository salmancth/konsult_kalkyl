import { create } from 'zustand';
import type { ScenarioId } from '@lyvan/engine';
import i18n from '../i18n';
import { getStore } from '../lib/platform';
import {
  DEFAULT_LYVAN,
  LYVAN_DEFAULT_TARGETS,
  defaultInputs,
  defaultPersisted,
  migrate,
  optionsFromDefaults,
  type Inputs,
  type Language,
  type LyvanDefaults,
  type PersistedState,
  type SavedCalc,
  type Theme,
} from './model';

export type TabId = 'overview' | 'offer' | 'compare' | 'sweep' | 'optimizer' | 'saved' | 'settings';

export interface Notice {
  kind: 'info' | 'error';
  text: string;
}

interface AppState {
  inputs: Inputs;
  language: Language;
  theme: Theme;
  taxYear: number;
  defaultMunicipalPct: number;
  lyvanDefaults: LyvanDefaults;
  saved: SavedCalc[];
  tab: TabId;
  detail: ScenarioId | null;
  hydrated: boolean;
  /** Set when the stored data could not be read (the app then starts from defaults). */
  loadError: string | null;
  /** Transient status message (export done, ...). */
  notice: Notice | null;

  hydrate(): Promise<void>;
  setInputs(patch: Partial<Inputs>): void;
  setOption(id: ScenarioId, key: string, value: unknown): void;
  resetOptions(): void;
  setLanguage(l: Language): void;
  setTheme(t: Theme): void;
  setTaxYear(y: number): void;
  setDefaultMunicipalPct(p: number): void;
  setLyvanDefault(key: keyof LyvanDefaults, value: number): void;
  resetAll(): void;
  setTab(t: TabId): void;
  openDetail(id: ScenarioId | null): void;
  setNotice(n: Notice | null): void;
  addSaved(name: string, effectiveRevenue: number, best: ScenarioId | null): void;
  loadSaved(id: string): void;
  removeSaved(id: string): void;
  duplicateSaved(id: string): void;
  renameSaved(id: string, name: string): void;
}

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function initialState(): Pick<
  AppState,
  'inputs' | 'language' | 'theme' | 'taxYear' | 'defaultMunicipalPct' | 'lyvanDefaults' | 'saved'
> {
  const d = defaultPersisted();
  return {
    inputs: d.inputs,
    language: d.language,
    theme: d.theme,
    taxYear: d.taxYear,
    defaultMunicipalPct: d.defaultMunicipalPct,
    lyvanDefaults: d.lyvanDefaults,
    saved: d.saved,
  };
}

export const useApp = create<AppState>((set, get) => ({
  ...initialState(),
  tab: 'overview',
  detail: null,
  hydrated: false,
  loadError: null,
  notice: null,

  async hydrate() {
    let loadError: string | null = null;
    let p: PersistedState;
    try {
      const store = await getStore();
      p = migrate(await store.get<unknown>('state'));
    } catch (e) {
      // Unreadable store: start from defaults and tell the user; the next save overwrites it.
      loadError = e instanceof Error ? e.message : String(e);
      p = defaultPersisted();
    }
    void i18n.changeLanguage(p.language);
    set({
      inputs: p.inputs,
      language: p.language,
      theme: p.theme,
      taxYear: p.taxYear,
      defaultMunicipalPct: p.defaultMunicipalPct,
      lyvanDefaults: p.lyvanDefaults,
      saved: p.saved,
      hydrated: true,
      loadError,
    });
  },

  setInputs: (patch) => set((s) => ({ inputs: { ...s.inputs, ...patch } })),
  setOption: (id, key, value) =>
    set((s) => ({
      inputs: {
        ...s.inputs,
        options: { ...s.inputs.options, [id]: { ...(s.inputs.options[id] ?? {}), [key]: value } },
      },
    })),
  resetOptions: () =>
    set((s) => ({ inputs: { ...s.inputs, options: optionsFromDefaults(s.lyvanDefaults) } })),
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language });
  },
  setTheme: (theme) => set({ theme }),
  setTaxYear: (taxYear) => set({ taxYear }),
  setDefaultMunicipalPct: (pct) =>
    set((s) => ({
      defaultMunicipalPct: pct,
      // Follow the new default only if the user has not typed a different rate for this calculation.
      inputs:
        s.inputs.municipalRatePct === s.defaultMunicipalPct
          ? { ...s.inputs, municipalRatePct: pct }
          : s.inputs,
    })),
  setLyvanDefault: (key, value) =>
    set((s) => {
      const { scenario, key: optKey } = LYVAN_DEFAULT_TARGETS[key];
      const current = s.inputs.options[scenario]?.[optKey];
      const follows = current === undefined || current === s.lyvanDefaults[key];
      return {
        lyvanDefaults: { ...s.lyvanDefaults, [key]: value },
        inputs: follows
          ? {
              ...s.inputs,
              options: {
                ...s.inputs.options,
                [scenario]: { ...(s.inputs.options[scenario] ?? {}), [optKey]: value },
              },
            }
          : s.inputs,
      };
    }),
  resetAll: () =>
    set((s) => ({
      inputs: defaultInputs(s.defaultMunicipalPct, s.lyvanDefaults),
      tab: 'overview',
      detail: null,
    })),
  setTab: (tab) => set({ tab }),
  openDetail: (detail) => set({ detail }),
  setNotice: (notice) => set({ notice }),

  addSaved: (name, effectiveRevenue, best) =>
    set((s) => ({
      saved: [
        {
          id: newId(),
          name,
          createdAt: new Date().toISOString(),
          inputs: structuredClone(s.inputs),
          effectiveRevenue,
          bestScenario: best,
        },
        ...s.saved,
      ],
    })),
  loadSaved: (id) => {
    const found = get().saved.find((c) => c.id === id);
    if (found) {
      const { defaultMunicipalPct, lyvanDefaults } = get();
      set({
        inputs: { ...defaultInputs(defaultMunicipalPct, lyvanDefaults), ...structuredClone(found.inputs) },
        tab: 'overview',
      });
    }
  },
  removeSaved: (id) => set((s) => ({ saved: s.saved.filter((c) => c.id !== id) })),
  duplicateSaved: (id) =>
    set((s) => {
      const found = s.saved.find((c) => c.id === id);
      if (!found) return s;
      const copy: SavedCalc = {
        ...structuredClone(found),
        id: newId(),
        name: `${found.name} (copy)`,
        createdAt: new Date().toISOString(),
      };
      return { saved: [copy, ...s.saved] };
    }),
  renameSaved: (id, name) =>
    set((s) => ({ saved: s.saved.map((c) => (c.id === id ? { ...c, name: name.trim().slice(0, 200) || c.name } : c)) })),
}));

function snapshot(s: AppState): PersistedState {
  return {
    version: 2,
    language: s.language,
    theme: s.theme,
    taxYear: s.taxYear,
    defaultMunicipalPct: s.defaultMunicipalPct,
    lyvanDefaults: s.lyvanDefaults ?? DEFAULT_LYVAN,
    inputs: s.inputs,
    saved: s.saved,
  };
}

/**
 * Persist settings + inputs + saved calculations whenever they change (after hydration).
 * Writes are debounced; pending data is flushed when the window is hidden or closed.
 * Returns a function that stops persisting.
 */
export function startPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;

  const flush = (): void => {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    const payload = snapshot(useApp.getState());
    getStore()
      .then((st) => st.set('state', payload))
      .catch((e: unknown) => {
        dirty = true;
        useApp.getState().setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
      });
  };

  const unsubscribe = useApp.subscribe((s, prev) => {
    if (!s.hydrated) return;
    const changed =
      s.inputs !== prev.inputs ||
      s.language !== prev.language ||
      s.theme !== prev.theme ||
      s.taxYear !== prev.taxYear ||
      s.defaultMunicipalPct !== prev.defaultMunicipalPct ||
      s.lyvanDefaults !== prev.lyvanDefaults ||
      s.saved !== prev.saved ||
      // First write after loading (upgrades old data to the current schema) - but never overwrite
      // a store file we could not read until the user changes something.
      (!prev.hydrated && s.loadError === null);
    if (!changed) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  });

  const onHide = (): void => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);

  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    flush();
  };
}
