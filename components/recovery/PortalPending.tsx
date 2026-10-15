import { Gavel, Landmark, UserRound } from 'lucide-react';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';
import { PortalArt } from './RecoverArt';

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
      className="relative flex min-h-dvh flex-col overflow-hidden"
      style={{ background: RECOVER_BRAND.surface, color: RECOVER_BRAND.ink }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'rgba(0, 180, 216, 0.16)' }}
        aria-hidden
      />
      <header className="relative border-b" style={{ background: RECOVER_BRAND.ink, borderColor: RECOVER_BRAND.ink }}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
              Collections
            </p>
            <p className="text-lg font-black tracking-tight" style={{ color: RECOVER_BRAND.surface }}>
              {RECOVER_PRODUCT_NAME}
            </p>
          </div>
          <p
            className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold"
            style={{ background: 'rgba(248, 250, 252, 0.12)', color: RECOVER_BRAND.surface }}
          >
            Signed out
          </p>
        </div>
        <div className="h-1" style={{ background: RECOVER_BRAND.accent }} aria-hidden />
      </header>
      <div className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-[#e2e8f0] bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]">
          <div className="grid items-center gap-2 bg-gradient-to-br from-cyan-50 via-white to-sky-50 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <div className="flex items-center justify-center px-6 pb-2 pt-6 sm:px-8 lg:py-8">
              <PortalArt />
            </div>
            <div className="px-6 pb-8 pt-2 sm:px-8 lg:py-10 lg:pl-0">
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-50 bg-white shadow-sm"
                style={{ color: RECOVER_BRAND.accentDeep }}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl" style={{ color: RECOVER_BRAND.ink }}>
                {card.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">{card.body}</p>
              <p
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold"
                style={{ color: RECOVER_BRAND.ink }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: RECOVER_BRAND.accentDeep }} aria-hidden />
                Not open yet
              </p>
            </div>
          </div>
        </section>
      </div>
      <footer className="relative border-t border-[#e2e8f0] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <p className="text-sm font-black" style={{ color: RECOVER_BRAND.ink }}>
            {RECOVER_PRODUCT_NAME}
          </p>
          <p className="text-sm text-slate-600">Signed-out page · not open yet</p>
        </div>
      </footer>
    </main>
  );
}
