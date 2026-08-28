'use client';

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import {
  formatZar,
  groupPortalStatements,
  type PortalStatement,
} from '@/lib/b2c/member-account-portal';

export function MemberPortalStatements({
  statements,
  purchases,
  openZar,
  payHref = '/me?tab=account',
}: {
  statements?: PortalStatement[] | null;
  purchases?: Array<{
    id: string;
    label: string;
    amount_zar: number;
    at: string;
  }> | null;
  openZar?: number;
  payHref?: string;
}) {
  const extra = (purchases || []).map((p) => ({
    id: p.id,
    description: p.label,
    amount_zar: p.amount_zar,
    status: 'paid',
    invoice_number: null,
    due_date: p.at.slice(0, 10),
    created_at: p.at,
  }));
  const known = new Set(
    (statements || []).flatMap((s) => s.charges.map((c) => c.id))
  );
  const leftover = extra.filter((p) => !known.has(p.id));
  const rows =
    leftover.length && (statements || []).length
      ? groupPortalStatements({
          charges: [
            ...(statements || []).flatMap((s) => s.charges),
            ...leftover,
          ],
          payments: (statements || []).flatMap((s) => s.payments),
        })
      : leftover.length
        ? groupPortalStatements({ charges: leftover, payments: [] })
        : statements || [];
  const due =
    openZar != null
      ? openZar
      : rows.reduce((n, s) => n + (Number(s.open_zar) || 0), 0);

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-neutral-900">
        No statements yet. When the gym bills membership or private training,
        the month lands here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {due > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
            Outstanding
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {formatZar(due)} due
          </p>
          <Link
            href={payHref}
            className="mt-2 inline-flex text-[11px] font-black text-amber-900 underline"
          >
            Pay in SA Member
          </Link>
        </div>
      ) : null}
      {rows.map((s) => (
        <section
          key={s.key}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                Statement
              </p>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {s.label}
              </h3>
            </div>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <ul className="mt-3 space-y-1.5">
            {s.charges.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-2 text-[12px]"
              >
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {c.description}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                    {c.status}
                    {c.invoice_number ? ` · ${c.invoice_number}` : ''}
                    {c.due_date ? ` · ${c.due_date}` : ''}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-slate-900 dark:text-white">
                  {formatZar(c.amount_zar)}
                </span>
              </li>
            ))}
            {s.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-2 text-[12px] text-emerald-800 dark:text-emerald-300"
              >
                <span>
                  Payment
                  {p.method ? ` · ${p.method}` : ''}
                  {p.reference ? ` · ${p.reference}` : ''}
                  <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                    {String(p.paid_at || '').slice(0, 10)} · {p.status}
                  </span>
                </span>
                <span className="shrink-0 font-bold">
                  −{formatZar(p.amount_zar)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">
            Billed {formatZar(s.billed_zar)}
            {s.paid_zar ? ` · paid ${formatZar(s.paid_zar)}` : ''}
            {s.open_zar ? ` · open ${formatZar(s.open_zar)}` : ''}
          </p>
        </section>
      ))}
    </div>
  );
}


