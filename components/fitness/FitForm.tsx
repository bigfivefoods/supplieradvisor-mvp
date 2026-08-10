'use client';

import type { ReactNode } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

/**
 * Fitgraph role tones — match end-to-end process “Who does what”:
 * coach = amber, member = cyan, default = neutral violet.
 */
export type FitTone = 'coach' | 'member' | 'default';

const TONE_CARD: Record<FitTone, string> = {
  // dark:!bg-* beats global pastel remaps so role colours stay true in dark mode
  coach:
    'border-amber-300 bg-amber-50 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/50',
  member:
    'border-cyan-300 bg-sky-50 dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/50',
  default:
    'border-violet-200 bg-violet-50 dark:!border-violet-500/50 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40',
};

const TONE_TITLE: Record<FitTone, string> = {
  coach: 'text-slate-900 dark:text-amber-50',
  member: 'text-slate-900 dark:text-cyan-50',
  default: 'text-slate-900 dark:text-violet-50',
};

const TONE_ROW: Record<FitTone, string> = {
  coach:
    'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  member:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
  default:
    'border-violet-100 bg-white dark:!border-violet-500/40 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/30',
};

const TONE_TABLE: Record<FitTone, string> = {
  coach:
    'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  member:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
  default:
    'border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-950',
};

const TONE_THEAD: Record<FitTone, string> = {
  coach: 'bg-amber-50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  member: 'bg-sky-50 text-sky-900 dark:bg-cyan-900/50 dark:text-cyan-200',
  default: 'bg-slate-50 text-slate-500 dark:bg-neutral-900 dark:text-neutral-400',
};

const TONE_LINK: Record<FitTone, string> = {
  coach: 'text-amber-800 dark:text-amber-300',
  member: 'text-sky-800 dark:text-cyan-300',
  default: 'text-violet-700 dark:text-violet-300',
};

export function StatRow({
  items,
  tone = 'default',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: FitTone;
}) {
  return (
    <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <div
          key={i.label}
          className={`rounded-2xl border px-4 py-3 ${TONE_ROW[tone]}`}
        >
          <div
            className={`text-[10px] font-black uppercase ${
              tone === 'coach'
                ? 'text-amber-700/70 dark:text-amber-300/80'
                : tone === 'member'
                  ? 'text-sky-700/70 dark:text-cyan-300/80'
                  : 'text-slate-400 dark:text-neutral-400'
            }`}
          >
            {i.label}
          </div>
          <div
            className={`text-xl font-black tabular-nums ${
              tone === 'coach'
                ? 'text-slate-900 dark:text-amber-50'
                : tone === 'member'
                  ? 'text-slate-900 dark:text-cyan-50'
                  : 'text-slate-900 dark:text-neutral-100'
            }`}
          >
            {i.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  tone = 'default',
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  /** Match process role: coach (amber) · member (cyan) */
  tone?: FitTone;
}) {
  return (
    <div className={`rounded-3xl border p-4 space-y-2 ${TONE_CARD[tone]}`}>
      <h3 className={`text-sm font-black ${TONE_TITLE[tone]}`}>{title}</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{children}</div>
      <button
        type="button"
        disabled={saving}
        onClick={onSubmit}
        className="btn-primary !py-2 text-sm w-full sm:w-auto inline-flex justify-center gap-1.5"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {submitLabel}
      </button>
    </div>
  );
}

export function fc() {
  return 'rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white w-full dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';
}

export function DataTable({
  headers,
  rows,
  onDelete,
  tone = 'default',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number> }>;
  onDelete?: (id: string) => void;
  tone?: FitTone;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-3xl border bg-white ${TONE_TABLE[tone]}`}
    >
      <table className="w-full text-sm min-w-[520px]">
        <thead
          className={`text-left text-[10px] font-black uppercase tracking-wider ${TONE_THEAD[tone]}`}
        >
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5">
                {h}
              </th>
            ))}
            {onDelete ? <th className="px-3 py-2.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length + (onDelete ? 1 : 0)}
                className="px-3 py-10 text-center text-slate-500 dark:text-neutral-400"
              >
                No rows yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-100 dark:border-white/10"
              >
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2.5 dark:text-neutral-100 ${
                      i === 0 ? 'font-semibold' : ''
                    }`}
                  >
                    {c}
                  </td>
                ))}
                {onDelete ? (
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="text-rose-600 dark:text-rose-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ListRowCard({
  tone = 'default',
  children,
  actions,
}: {
  tone?: FitTone;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-wrap justify-between gap-3 ${TONE_ROW[tone]}`}
    >
      <div className="min-w-0">{children}</div>
      {actions ? (
        <div className="flex flex-wrap gap-2 items-center">{actions}</div>
      ) : null}
    </div>
  );
}

export function toneLinkClass(tone: FitTone = 'default') {
  return TONE_LINK[tone];
}
