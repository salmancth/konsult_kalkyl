import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalities, type Municipality } from '@lyvan/rules';
import { formatPct } from '../../lib/format';
import { localRatesFor } from '../../state/model';
import { useApp } from '../../state/store';
import { useRules } from '../../state/useResults';
import { NumberField } from './NumberField';
import { FieldLabel } from './ScenarioSettings';

/**
 * Municipality choice (sets the total municipal tax and the county's church and burial fee) plus
 * the municipal tax rate itself. Editing the rate by hand makes it a custom rate: the municipality
 * is cleared and the fees fall back to the national averages.
 */
export function MunicipalityPicker() {
  const { t } = useTranslation();
  const inputs = useApp((s) => s.inputs);
  const setInputs = useApp((s) => s.setInputs);
  const rules = useRules();
  const data = getLocalities(rules.year);

  const byCounty = useMemo(() => {
    if (!data) return [];
    return data.counties.map((c) => ({
      county: c,
      municipalities: data.municipalities.filter((m) => m.county === c.code),
    }));
  }, [data]);

  const selected: Municipality | undefined = data?.municipalities.find((m) => m.code === inputs.municipalityCode);
  const local = selected ? localRatesFor(selected.code, rules.year) : undefined;

  return (
    <>
      {data && (
        <div>
          <FieldLabel htmlFor="municipality">{t('input.municipality')}</FieldLabel>
          <select
            id="municipality"
            className="input"
            value={selected?.code ?? ''}
            onChange={(e) => {
              const m = data.municipalities.find((x) => x.code === e.target.value);
              setInputs(m ? { municipalityCode: m.code, municipalRatePct: m.totalPct } : { municipalityCode: null });
            }}
          >
            <option value="">{t('input.municipalityCustom')}</option>
            {byCounty.map(({ county, municipalities }) => (
              <optgroup key={county.code} label={county.name}>
                {municipalities.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div>
        <FieldLabel htmlFor="municipal">{t('input.municipalRate')}</FieldLabel>
        <NumberField
          id="municipal"
          kind="plain"
          decimals={2}
          min={25}
          max={40}
          value={inputs.municipalRatePct}
          onCommit={(v) =>
            setInputs(selected && Math.abs(v - selected.totalPct) < 0.005 ? { municipalRatePct: v } : { municipalRatePct: v, municipalityCode: null })
          }
        />
        {local && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('input.localFees', {
              church: formatPct(local.churchFeeRate, 2),
              burial: formatPct(local.burialFeeRate, 2),
            })}
          </p>
        )}
      </div>
    </>
  );
}
