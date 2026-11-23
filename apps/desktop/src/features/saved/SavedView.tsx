import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatKr } from '../../lib/format';
import { useApp } from '../../state/store';
import { useResults } from '../../state/useResults';

export function SavedView() {
  const { t } = useTranslation();
  const saved = useApp((s) => s.saved);
  const addSaved = useApp((s) => s.addSaved);
  const loadSaved = useApp((s) => s.loadSaved);
  const removeSaved = useApp((s) => s.removeSaved);
  const duplicateSaved = useApp((s) => s.duplicateSaved);
  const renameSaved = useApp((s) => s.renameSaved);
  const { results, revenue } = useResults();
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const best = results.length ? results.reduce((b, r) => (r.totals.netCash > b.totals.netCash ? r : b)).scenarioId : null;

  return (
    <div className="card space-y-4 p-4">
      <h2 className="font-semibold">{t('saved.title')}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addSaved(name.trim() || formatKr(revenue), revenue, best);
          setName('');
        }}
      >
        <input className="input max-w-xs" placeholder={t('saved.name')} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} aria-label={t('saved.name')} />
        <button className="btn-primary" type="submit">
          {t('saved.save')}
        </button>
      </form>
      {saved.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('saved.empty')}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {saved.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">
                  {editing?.id === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        renameSaved(c.id, editing.text);
                        setEditing(null);
                      }}
                    >
                      <input
                        className="input"
                        value={editing.text}
                        maxLength={200}
                        autoFocus
                        aria-label={t('saved.rename')}
                        onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        onBlur={() => setEditing(null)}
                      />
                    </form>
                  ) : (
                    <button className="rounded text-left hover:underline" title={t('saved.rename')} onClick={() => setEditing({ id: c.id, text: c.name })}>
                      {c.name}
                    </button>
                  )}
                </td>
                <td className="py-2 text-slate-500 dark:text-slate-400">{new Date(c.createdAt).toLocaleDateString('sv-SE')}</td>
                <td className="py-2 text-right tabular-nums">{formatKr(c.effectiveRevenue)}</td>
                <td className="py-2 text-slate-500 dark:text-slate-400">
                  {c.bestScenario ? `${t('saved.bestScenario')}: ${t(`scenario.${c.bestScenario}.label`)}` : ''}
                </td>
                <td className="space-x-2 py-2 text-right">
                  {confirming === c.id ? (
                    <span role="alert" className="inline-flex items-center gap-2">
                      <span>{t('saved.confirmDelete', { name: c.name })}</span>
                      <button
                        className="btn border-red-500 text-red-700 dark:text-red-300"
                        onClick={() => {
                          removeSaved(c.id);
                          setConfirming(null);
                        }}
                      >
                        {t('saved.confirm')}
                      </button>
                      <button className="btn" onClick={() => setConfirming(null)}>
                        {t('saved.cancel')}
                      </button>
                    </span>
                  ) : (
                    <>
                      <button className="btn" onClick={() => loadSaved(c.id)}>
                        {t('saved.load')}
                      </button>
                      <button className="btn" onClick={() => duplicateSaved(c.id)}>
                        {t('saved.duplicate')}
                      </button>
                      <button className="btn" onClick={() => setConfirming(c.id)}>
                        {t('saved.delete')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
