import { Gavel, Landmark, UserRound } from 'lucide-react';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';

const COPY = {
  creditor: {
    title: 'Creditor',
    icon: Landmark,
    body: 'This creditor page is not open yet. Your advisor will share access when the book is ready. Nothing on this page is a balance or a demand.',
  },
  debtor: {
    title: 'Your account',
    icon: UserRound,
    body: 'This page is not open yet. When it is ready, you will see the next step in plain language. There is no amount, threat, or demand on this screen.',
  },
  attorney: {
    title: 'Attorney',
    icon: Gavel,
    body: 'This attorney page is not open yet. Matters appear here only when a mandate allows it.',
  },
} as const;

export function PortalPending({ kind }: { kind: keyof typeof COPY }) {
  const card = COPY[kind];
  const Icon = card.icon;
  return (
    <main
      data-testid={`recover-portal-${kind}`}
      className="relative min-h-dvh overflow-hidden px-4 py-12 sm:px-6 sm:py-16"
      style={{ background: RECOVER_BRAND.surface, color: RECOVER_BRAND.ink }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl"
        style={{ background: 'rgba(0, 180, 216, 0.16)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full blur-3xl"
        style={{ background: 'rgba(0, 119, 182, 0.08)' }}
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-lg">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {RECOVER_PRODUCT_NAME}
        </p>
        <article className="rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-sm sm:p-8">
          <div
            className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-cyan-50 shadow-sm"
            style={{ color: RECOVER_BRAND.accentDeep }}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl" style={{ color: RECOVER_BRAND.ink }}>
            {card.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">{card.body}</p>
          <p
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold"
            style={{ color: RECOVER_BRAND.ink }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: RECOVER_BRAND.accentDeep }} aria-hidden />
            Not open yet
          </p>
        </article>
      </div>
    </main>
  );
}
