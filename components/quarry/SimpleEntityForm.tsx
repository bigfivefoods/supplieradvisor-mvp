'use client';

/**
 * Lightweight multi-field form + table for Quarrygraph entity pages.
 */
import type { ReactNode } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';

export function StatRow({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {items.map((i) => (
        <div
          key={i.label}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="text-[10px] font-black uppercase text-slate-400">
            {i.label}
          </div>
          <div className="text-xl font-black tabular-nums">{i.value}</div>
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
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-amber-100 bg-amber-50/30 p-4 space-y-2">
      <h3 className="text-sm font-black">{title}</h3>
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

export function fieldClass() {
  return 'rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white w-full';
}

export function DataTable({
  headers,
  rows,
  onDelete,
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number> }>;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
      <table className="w-full text-sm min-w-[560px]">
        <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
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
                className="px-3 py-10 text-center text-slate-500"
              >
                No rows yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                {r.cells.map((c, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2.5 ${i === 0 ? 'font-semibold' : 'tabular-nums'}`}
                  >
                    {c}
                  </td>
                ))}
                {onDelete ? (
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      className="text-rose-600 p-1"
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
