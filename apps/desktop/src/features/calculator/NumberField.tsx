import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatKr, parseAmount } from '../../lib/format';

interface Props {
  value: number;
  onCommit: (v: number) => void;
  /** 'kr' shows grouped kronor; 'pct' edits a fraction as percent; 'plain' shows the number. */
  kind?: 'kr' | 'pct' | 'plain';
  decimals?: number;
  /** Bounds are in the value's own unit (a fraction for 'pct'). Out-of-range input is clamped, and the user is told. */
  min?: number;
  max?: number;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

type Hint = null | { kind: 'invalid' } | { kind: 'clamped'; min?: number; max?: number };

function toText(v: number, kind: NonNullable<Props['kind']>, decimals: number): string {
  if (kind === 'kr') return formatKr(v, false);
  if (kind === 'pct') {
    const fixed = (v * 100).toFixed(decimals).replace('.', ',');
    // Drop trailing zeros of the FRACTION only ("30,0" -> "30", but "100" stays "100").
    return fixed.includes(',') ? fixed.replace(/,?0+$/, '') : fixed;
  }
  return String(v);
}

/** Text input accepting "1 500 000", "1,5M", "750k"; commits on blur / Enter. */
export function NumberField({ value, onCommit, kind = 'kr', decimals = 2, min, max, id, ariaLabel, className }: Props) {
  const { t } = useTranslation();
  const hintId = useId();
  const [text, setText] = useState(() => toText(value, kind, decimals));
  const [shownValue, setShownValue] = useState(value);
  const [hint, setHint] = useState<Hint>(null);

  // Show the new value when it changes from the outside (reset, load, "apply optimal salary").
  // Adjusting state while rendering is React's documented alternative to an effect here.
  if (value !== shownValue) {
    setShownValue(value);
    setText(toText(value, kind, decimals));
    setHint(null);
  }

  const commit = (): void => {
    const parsed = parseAmount(text);
    if (parsed === null) {
      setHint({ kind: 'invalid' });
      return;
    }
    let v = kind === 'pct' ? parsed / 100 : parsed;
    const unclamped = v;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setHint(v !== unclamped ? { kind: 'clamped', min, max } : null);
    setShownValue(v);
    setText(toText(v, kind, decimals));
    if (v !== value) onCommit(v);
  };

  const fmt = (n: number | undefined): string => (n === undefined ? '…' : toText(n, kind, decimals));
  const message =
    hint === null
      ? null
      : hint.kind === 'invalid'
        ? t('input.invalid')
        : t('input.clamped', { min: fmt(hint.min), max: fmt(hint.max) });

  return (
    <>
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={hint?.kind === 'invalid' ? true : undefined}
        aria-describedby={message ? hintId : undefined}
        inputMode="decimal"
        className={`input ${hint?.kind === 'invalid' ? 'border-red-500 dark:border-red-400' : ''} ${className ?? ''}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHint(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      {message && (
        <p id={hintId} role={hint?.kind === 'invalid' ? 'alert' : 'status'} className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          {message}
        </p>
      )}
    </>
  );
}
