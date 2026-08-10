'use client';

/**
 * Shared form / stat / table surfaces tinted by process role.
 * Used by FitAdvisor, CropAdvisor, QuarryAdvisor, and NSNP (DBE).
 */
import type { ReactNode } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  fieldInputClass,
  tonePack,
  type RoleTone,
} from '@/lib/ui/role-tones';

export type { RoleTone };
export { fieldInputClass };

export function StatRow({
  items,
  tone = 'default',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: RoleTone | string;
}) {
  const t = tonePack(tone);
  return (
    <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <div key={i.label} className={`rounded-2xl border px-4 py-3 ${t.row}`}>
          <div className={`text-[10px] font-black uppercase ${t.label}`}>
            {i.label}
          </div>
          <div className={`text-xl font-black tabular-nums ${t.value}`}>
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
  description,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  tone?: RoleTone | string;
  description?: string;
}) {
  const t = tonePack(tone);
  return (
    <div className={`rounded-3xl border p-4 space-y-2 ${t.card}`}>
      <h3 className={`text-sm font-black ${t.title}`}>{title}</h3>
      {description ? (
        <p className="text-[11px] text-slate-500 dark:text-neutral-400 -mt-1 mb-1">
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

export function DataTable({
  headers,
  rows,
  onDelete,
  tone = 'default',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  tone?: RoleTone | string;
}) {
  const t = tonePack(tone);
  return (
    <div className={`overflow-x-auto rounded-3xl border ${t.table}`}>
      <table className="w-full text-sm min-w-[520px]">
        <thead
          className={`text-left text-[10px] font-black uppercase tracking-wider ${t.thead}`}
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
                      i === 0 ? 'font-semibold' : 'tabular-nums'
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
  tone?: RoleTone | string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const t = tonePack(tone);
  return (
    <div
      className={`rounded-2xl border px-4 py-3 flex flex-wrap justify-between gap-3 ${t.row}`}
    >
      <div className="min-w-0">{children}</div>
      {actions ? (
        <div className="flex flex-wrap gap-2 items-center">{actions}</div>
      ) : null}
    </div>
  );
}

export function SurfaceCard({
  tone = 'default',
  children,
  className = '',
}: {
  tone?: RoleTone | string;
  children: ReactNode;
  className?: string;
}) {
  const t = tonePack(tone);
  return (
    <div className={`rounded-3xl border p-4 ${t.card} ${className}`}>
      {children}
    </div>
  );
}

export function toneLinkClass(tone: RoleTone | string = 'default') {
  return tonePack(tone).link;
}

export function toneTitleClass(tone: RoleTone | string = 'default') {
  return tonePack(tone).title;
}

/** Alias used by quarry / field form inputs */
export function fc() {
  return fieldInputClass();
}
