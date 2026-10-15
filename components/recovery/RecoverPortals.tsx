'use client';

import { Gavel, Landmark, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RECOVER_PENDING_BANNER } from '@/lib/recovery/brand';
import { RecoverBanner, RecoverRoleChip, RecoverScreen } from './RecoverChrome';
import { useRecoverDesk } from './useRecoverDesk';

const CARDS: Array<{
  testId: string;
  code: string;
  title: string;
  body: string;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    testId: 'recover-portals-creditor',
    code: '01',
    title: 'Creditor',
    body: 'A creditor will later see their own book, remittances, and documents. Not open yet.',
    icon: Landmark,
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
  {
    testId: 'recover-portals-debtor',
    code: '02',
    title: 'Debtor',
    body: 'A person with an account will later see plain-language next steps. Not open yet.',
    icon: UserRound,
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    testId: 'recover-portals-attorney',
    code: '03',
    title: 'Attorney',
    body: 'An attorney will later see matters handed across under a mandate. Not open yet.',
    icon: Gavel,
    accent: 'from-emerald-50 to-white border-emerald-100',
  },
];

export function RecoverPortals() {
  const { desk, error, loading } = useRecoverDesk();
  return (
    <RecoverScreen
      title="Portals & install"
      description="Three signed-out doors. None of them issue a link, a code, or a count in this version."
      action={desk ? <RecoverRoleChip role={desk.role} /> : null}
    >
      {error ? <RecoverBanner testId="recover-banner-error" tone="error">{error}</RecoverBanner> : null}
      {desk && !desk.ready ? (
        <RecoverBanner testId="recover-banner-pending" tone="pending">
          {RECOVER_PENDING_BANNER}
        </RecoverBanner>
      ) : null}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-slate-100 motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.testId}
                data-testid={card.testId}
                className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm sm:p-6 ${card.accent}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-white text-[#0077b6] shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="font-mono text-[10px] font-black tracking-widest text-neutral-400">{card.code}</div>
                </div>
                <h2 className="text-base font-black text-slate-800 sm:text-lg">{card.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{card.body}</p>
                <p className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="h-2 w-2 rounded-full bg-[#0077b6]" aria-hidden />
                  Not open yet
                </p>
              </article>
            );
          })}
        </div>
      )}
    </RecoverScreen>
  );
}
