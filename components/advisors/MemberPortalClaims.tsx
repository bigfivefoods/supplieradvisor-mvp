'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { formatZar } from '@/lib/b2c/member-account-types';
import { claimStatusLabel } from '@/lib/clinic/patient-medical';

export type MemberPortalClaim = {
  id: string;
  claim_number?: string;
  status: string;
  service_date?: string | null;
  amount_zar?: number | null;
  patient_portion?: number | null;
  scheme_portion?: number | null;
  rejection_codes?: string[];
  response_notes?: string;
  switch_tracking_number?: string | null;
};

export function MemberPortalClaims({
  claims,
  payHref = '/me?tab=account',
}: {
  claims?: MemberPortalClaim[] | null;
  payHref?: string;
}) {
  const rows = claims || [];
  if (!rows.length) return null;
  const copay = rows.reduce(
    (n, c) =>
      n +
      (c.status === 'paid' || c.status === 'rejected'
        ? 0
        : Number(c.patient_portion) || 0),
    0
  );

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-800 dark:text-sky-200">
            Medical aid
          </p>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {copay > 0 ? `${formatZar(copay)} co-pay due` : 'Claim status'}
          </p>
        </div>
        <ShieldCheck className="h-4 w-4 text-sky-700" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-2 text-[12px]"
          >
            <span className="min-w-0">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {c.claim_number || 'Claim'} · {claimStatusLabel(c.status)}
              </span>
              <span className="block text-[10px] text-slate-500">
                {c.service_date || ''}
                {c.switch_tracking_number
                  ? ` · ${c.switch_tracking_number}`
                  : ''}
                {c.rejection_codes?.length
                  ? ` · ${c.rejection_codes.join(', ')}`
                  : ''}
              </span>
            </span>
            <span className="shrink-0 font-bold text-slate-900 dark:text-white">
              {c.amount_zar != null ? formatZar(c.amount_zar) : '—'}
            </span>
          </li>
        ))}
      </ul>
      {copay > 0 ? (
        <Link
          href={payHref}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-sky-800 px-3 py-2 text-xs font-black text-white"
        >
          Pay co-pay in SA Member
        </Link>
      ) : null}
    </section>
  );
}
