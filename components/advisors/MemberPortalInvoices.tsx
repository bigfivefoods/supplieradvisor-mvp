'use client';

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { formatZar } from '@/lib/b2c/member-account-types';
import type { PortalInvoice } from '@/lib/b2c/member-account-portal';

export type MemberPortalInvoice = PortalInvoice;

export function mergePortalInvoices<
  T extends {
    invoices?: MemberPortalInvoice[];
    statements?: unknown[];
  },
>(next: T, prev: T | null | undefined): T {
  let out = next;
  if (!next.invoices?.length && prev?.invoices?.length) {
    out = { ...out, invoices: prev.invoices };
  }
  if (!next.statements?.length && prev?.statements?.length) {
    out = { ...out, statements: prev.statements };
  }
  return out;
}

export function MemberPortalInvoices({
  invoices,
  payHref = '/me?tab=account',
}: {
  invoices?: MemberPortalInvoice[] | null;
  payHref?: string;
}) {
  const rows = (invoices || []).filter((c) => c.status !== 'void');
  if (!rows.length) return null;
  const due = rows
    .filter((c) => c.status === 'open' || c.status === 'pending_pop')
    .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
            Invoices
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {due > 0 ? `${formatZar(due)} due` : 'Your invoices'}
          </p>
        </div>
        <Receipt className="h-4 w-4 text-amber-700" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((c) => (
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
              </span>
            </span>
            <span className="shrink-0 font-bold text-slate-900 dark:text-white">
              {formatZar(c.amount_zar)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={payHref}
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-amber-800 px-3 py-2 text-xs font-black text-white"
      >
        {due > 0 ? `View & pay in SA Member` : 'Open in SA Member'}
      </Link>
    </section>
  );
}
