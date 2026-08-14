'use client';

import type { ReactNode } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

/**
 * GymAdvisor role tones — match end-to-end process “Who does what”:
 * owner = violet · coach = amber · member = cyan
 * (`default` is an alias of owner for owner workbenches.)
 */
export type FitTone = 'owner' | 'coach' | 'member' | 'default';

const OWNER_CARD =
  'border-violet-300 bg-violet-50 dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/50';
const OWNER_ROW =
  'border-violet-200 bg-white dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40';
const OWNER_TABLE =
  'border-violet-200 bg-white dark:!border-violet-400 dark:!bg-violet-950 dark:ring-1 dark:ring-violet-500/40';
const OWNER_THEAD =
  'bg-violet-50 text-violet-900 dark:bg-violet-900/50 dark:text-violet-200';

const TONE_CARD: Record<FitTone, string> = {
  // dark:!bg-* beats global pastel remaps so role colours stay true in dark mode
  owner: OWNER_CARD,
  default: OWNER_CARD,
  coach:
    'border-amber-300 bg-amber-50 dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/50',
  member:
    'border-cyan-300 bg-sky-50 dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/50',
};

const TONE_TITLE: Record<FitTone, string> = {
  owner: 'text-slate-900 dark:text-violet-50',
  default: 'text-slate-900 dark:text-violet-50',
  coach: 'text-slate-900 dark:text-amber-50',
  member: 'text-slate-900 dark:text-cyan-50',
};

const TONE_ROW: Record<FitTone, string> = {
  owner: OWNER_ROW,
  default: OWNER_ROW,
  coach:
    'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  member:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
};

const TONE_TABLE: Record<FitTone, string> = {
  owner: OWNER_TABLE,
  default: OWNER_TABLE,
  coach:
    'border-amber-200 bg-white dark:!border-amber-400 dark:!bg-amber-950 dark:ring-1 dark:ring-amber-500/40',
  member:
    'border-cyan-200 bg-white dark:!border-cyan-400 dark:!bg-cyan-950 dark:ring-1 dark:ring-cyan-500/40',
};

const TONE_THEAD: Record<FitTone, string> = {
  owner: OWNER_THEAD,
  default: OWNER_THEAD,
  coach: 'bg-amber-50 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200',
  member: 'bg-sky-50 text-sky-900 dark:bg-cyan-900/50 dark:text-cyan-200',
};

const TONE_LINK: Record<FitTone, string> = {
  owner: 'text-violet-800 dark:text-violet-300',
  default: 'text-violet-800 dark:text-violet-300',
  coach: 'text-amber-800 dark:text-amber-300',
  member: 'text-sky-800 dark:text-cyan-300',
};

const TONE_LABEL: Record<FitTone, string> = {
  owner: 'text-violet-700/80 dark:text-violet-300/80',
  default: 'text-violet-700/80 dark:text-violet-300/80',
  coach: 'text-amber-700/70 dark:text-amber-300/80',
  member: 'text-sky-700/70 dark:text-cyan-300/80',
};

const TONE_VALUE: Record<FitTone, string> = {
  owner: 'text-slate-900 dark:text-violet-50',
  default: 'text-slate-900 dark:text-violet-50',
  coach: 'text-slate-900 dark:text-amber-50',
  member: 'text-slate-900 dark:text-cyan-50',
};

export function StatRow({
  items,
  tone = 'owner',
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
          <div className={`text-[10px] font-black uppercase ${TONE_LABEL[tone]}`}>
            {i.label}
          </div>
          <div className={`text-xl font-black tabular-nums ${TONE_VALUE[tone]}`}>
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
  tone = 'owner',
  description,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  /** Match process role: owner (violet) · coach (amber) · member (cyan) */
  tone?: FitTone;
  description?: string;
}) {
  return (
    <div className={`rounded-3xl border p-4 space-y-2 ${TONE_CARD[tone]}`}>
      <h3 className={`text-sm font-black ${TONE_TITLE[tone]}`}>{title}</h3>
      {description ? (
        <p className="text-[11px] text-slate-600 dark:text-slate-300/90 -mt-1 mb-1">
          {description}
        </p>
      ) : null}
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
  onEdit,
  tone = 'owner',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  tone?: FitTone;
}) {
  const hasActions = Boolean(onDelete || onEdit);
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
            {hasActions ? <th className="px-3 py-2.5" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length + (hasActions ? 1 : 0)}
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
                {hasActions ? (
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(r.id)}
                        className="text-violet-700 dark:text-violet-300 p-1 inline-flex"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        className="text-rose-600 dark:text-rose-400 p-1 inline-flex"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
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
  tone = 'owner',
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
      <div className="min-w-0 w-full">{children}</div>
      {actions ? (
        <div className="flex flex-wrap gap-2 items-center">{actions}</div>
      ) : null}
    </div>
  );
}

export function toneLinkClass(tone: FitTone = 'default') {
  return TONE_LINK[tone];
}
