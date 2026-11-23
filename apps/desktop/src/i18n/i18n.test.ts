import { describe, expect, it } from 'vitest';
import en from './en.json';
import sv from './sv.json';

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof obj === 'string') return { [prefix]: obj };
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

const placeholders = (s: string): string[] => [...s.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]!).sort();

const flatEn = flatten(en);
const flatSv = flatten(sv);

describe('translations', () => {
  it('Swedish and English define exactly the same keys', () => {
    const onlyEn = Object.keys(flatEn).filter((k) => !(k in flatSv));
    const onlySv = Object.keys(flatSv).filter((k) => !(k in flatEn));
    expect({ onlyEn, onlySv }).toEqual({ onlyEn: [], onlySv: [] });
  });

  it('no translation is empty', () => {
    for (const [k, v] of [...Object.entries(flatEn), ...Object.entries(flatSv)]) expect(v.trim(), k).not.toBe('');
  });

  it('both languages use the same {{placeholders}} for every key', () => {
    for (const k of Object.keys(flatEn)) {
      expect(placeholders(flatSv[k] ?? ''), k).toEqual(placeholders(flatEn[k]!));
    }
  });
});
