import { Gavel, Landmark, UserRound } from 'lucide-react';
import { RECOVER_BRAND, RECOVER_PRODUCT_NAME } from '@/lib/recovery/brand';
import { PortalArt } from './RecoverArt';

const COPY = {
  creditor: {
    title: 'Creditor',
    icon: Landmark,
    body: 'This creditor page is not open yet. Your advisor will share access when the book is ready. Nothing on this page is a balance or a demand.',
    samples: ['Your book', 'Remittances', 'Documents'],
  },
  debtor: {
    title: 'Your account',
    icon: UserRound,
    body: 'This page is not open yet. When it is ready, you will see the next step in plain language. There is no amount, threat, or demand on this screen.',
    samples: ['Next step', 'What to do', 'Who to contact'],
  },
  attorney: {
    title: 'Attorney',
    icon: Gavel,
    body: 'This attorney page is not open yet. Matters appear here only when a mandate allows it.',
    samples: ['Matter', 'Mandate', 'Documents'],
  },
} as const;

export function PortalPending({ kind }: { kind: keyof typeof COPY }) {
  const card = COPY[kind];
  const Icon = card.icon;
  return (
    <main
      data-testid={`recover-portal-${kind}`}
      className="relative min-h-dvh overflow-hidden px-4 py-10 sm:px-6 sm:py-14"
      style={{ background: RECOVER_BRAND.surface, color: RECOVER_BRAND.ink }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'rgba(0, 180, 216, 0.18)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full blur-3xl"
        style={{ background: 'rgba(0, 119, 182, 0.1)' }}
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-5xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          {RECOVER_PRODUCT_NAME}
        </p>
        <article className="overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)]">
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
          <div className="border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-5 sm:px-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              Illustration · not live data · What this page will show
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {card.samples.map((label) => (
                <div key={label} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Sample</div>
                  <div className="mt-1 text-sm font-black text-slate-900">{label}</div>
                  <div className="mt-2 text-lg font-black tabular-nums text-slate-900">—</div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
