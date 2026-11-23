import { useTranslation } from 'react-i18next';
import { getScenario, type ScenarioId } from '@lyvan/engine';
import { useApp } from '../../state/store';
import { useRules } from '../../state/useResults';
import { NumberField } from './NumberField';
import { SCENARIO_FIELDS, resolveBound, type FieldDef } from './scenarioFields';

type Opts = Record<string, unknown>;

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
      {children}
    </label>
  );
}

function PensionField({
  id,
  def,
  opts,
  onChange,
}: {
  id: string;
  def: FieldDef;
  opts: Opts;
  onChange: (v: unknown) => void;
}) {
  const { t } = useTranslation();
  const model = (opts[def.key] ?? { kind: 'itp1' }) as { kind: string; pct?: number };
  return (
    <div className="flex gap-2">
      <select
        id={id}
        className="input"
        value={['itp1', 'pct', 'none'].includes(model.kind) ? model.kind : 'itp1'}
        onChange={(e) => {
          const kind = e.target.value;
          onChange(kind === 'pct' ? { kind, pct: model.pct ?? 0.1 } : { kind });
        }}
      >
        {['itp1', 'pct', 'none'].map((k) => (
          <option key={k} value={k}>
            {t(`opt.pension.${k}`)}
          </option>
        ))}
      </select>
      {model.kind === 'pct' && (
        <div className="w-24 shrink-0">
          <NumberField
            kind="pct"
            decimals={1}
            min={0}
            max={1}
            value={model.pct ?? 0.1}
            onCommit={(v) => onChange({ kind: 'pct', pct: v })}
            ariaLabel={t('opt.pensionPct')}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Editor for one scenario's options, generated from `SCENARIO_FIELDS`. Used in the left panel and in
 * the detail drawer. Every numeric field is bounded to the range the engine accepts.
 */
export function ScenarioSettings({ id, idPrefix = '' }: { id: ScenarioId; idPrefix?: string }) {
  const { t } = useTranslation();
  const stored = useApp((s) => s.inputs.options[id]);
  const setOption = useApp((s) => s.setOption);
  const rules = useRules();
  const opts: Opts = { ...(getScenario(id).defaults(rules) as Opts), ...(stored ?? {}) };

  return (
    <div className="space-y-2">
      {SCENARIO_FIELDS[id]
        .filter((f) => !f.showIf || f.showIf(opts))
        .map((f) => {
          const inputId = `${idPrefix}${id}-${f.key}`;
          const set = (v: unknown): void => setOption(id, f.key, v);
          const min = resolveBound(f.min, rules);
          const max = resolveBound(f.max, rules);
          return (
            <div key={f.key}>
              {f.type === 'bool' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(opts[f.key])} onChange={(e) => set(e.target.checked)} />
                  {t(f.labelKey)}
                </label>
              ) : (
                <>
                  <FieldLabel htmlFor={inputId}>{t(f.labelKey)}</FieldLabel>
                  {f.type === 'pension' && <PensionField id={inputId} def={f} opts={opts} onChange={set} />}
                  {f.type === 'select' && (
                    <select id={inputId} className="input" value={String(opts[f.key])} onChange={(e) => set(e.target.value)}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {t(o.labelKey)}
                        </option>
                      ))}
                    </select>
                  )}
                  {f.type === 'pct' && (
                    <NumberField id={inputId} kind="pct" decimals={1} min={min} max={max} value={Number(opts[f.key])} onCommit={set} />
                  )}
                  {f.type === 'kr' && <NumberField id={inputId} kind="kr" min={min} max={max} value={Number(opts[f.key])} onCommit={set} />}
                  {f.type === 'ratio' && (
                    <NumberField id={inputId} kind="plain" decimals={2} min={min} max={max} value={Number(opts[f.key])} onCommit={set} />
                  )}
                  {f.type === 'int' && (
                    <NumberField
                      id={inputId}
                      kind="plain"
                      min={min}
                      max={max}
                      value={Number(opts[f.key])}
                      onCommit={(v) => set(Math.round(v))}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
