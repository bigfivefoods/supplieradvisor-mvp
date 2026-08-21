'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Dumbbell,
  Landmark,
  Network,
  Play,
  Sparkles,
  Store,
  Workflow,
} from 'lucide-react';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import {
  AccountingMock,
  InventoryMock,
  ManufacturingMock,
  NetworkMock,
  OpsMock,
  ProductMockShell,
  SrmMock,
} from '@/components/marketing/ProductMocks';
import {
  SA_OS_ADVISORS,
  SA_OS_DAY,
  SA_OS_DEMO_MODULES,
  SA_OS_REPLACE,
  SA_OS_WHY,
} from '@/lib/b2c/sa-os-demo';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

type DemoTab = 'tour' | 'os' | 'advisors' | 'why' | 'start';

const DOCK: Array<{ id: DemoTab; label: string; icon: typeof Play }> = [
  { id: 'tour', label: 'Tour', icon: Play },
  { id: 'os', label: 'Live OS', icon: Workflow },
  { id: 'advisors', label: 'Advisors', icon: Dumbbell },
  { id: 'why', label: 'Why', icon: Sparkles },
  { id: 'start', label: 'Start', icon: Building2 },
];

const MOCKS = {
  srm: SrmMock,
  ops: OpsMock,
  inv: InventoryMock,
  mfg: ManufacturingMock,
  fin: AccountingMock,
  net: NetworkMock,
} as const;

export function SaOsDemoPortal() {
  const [tab, setTab] = useState<DemoTab>('tour');
  const [beat, setBeat] = useState(0);
  const [mod, setMod] = useState(0);
  const [played, setPlayed] = useState<number[]>([0]);
  const currentBeat = SA_OS_DAY[beat];
  const currentMod = SA_OS_DEMO_MODULES[mod];
  const Mock = MOCKS[currentMod.mock];

  const board = useMemo(() => {
    const done = new Set(played);
    return {
      po: done.has(1) ? 'Accepted' : 'Waiting',
      class: done.has(0) ? 'Booked' : '2 spots',
      till: done.has(2) ? 'Paid' : 'Open',
      bank: done.has(3) ? 'Allocated' : 'Unallocated',
      trust: done.has(4) ? '4.8' : '4.6',
    };
  }, [played]);

  function playBeat(i: number) {
    setBeat(i);
    setPlayed((prev) => (prev.includes(i) ? prev : [...prev, i].sort()));
  }

  return (
    <div className="b2c-app min-h-[100dvh] bg-[#eef6fb] text-slate-900 dark:bg-black dark:text-neutral-50">
      <header className="bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] px-4 pb-5 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link
            href="/me?tab=memberships"
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-black"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Places
          </Link>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
            Demo · read only
          </p>
        </div>
        <div className="mx-auto mt-4 max-w-lg">
          <SaOfficialLogo
            title="SupplierAdvisor"
            className="sa-logo-on-dark h-10 w-auto"
          />
          <h1 className="mt-3 text-2xl font-black tracking-tight">
            Run the business OS
          </h1>
          <p className="mt-1 text-sm text-white/90">
            SA Member is free. This is what gyms, clinics, hire desks and
            suppliers run — tap through a live day, then start your company.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {tab === 'tour' && (
          <div className="space-y-3">
            <section className="grid grid-cols-5 gap-1.5">
              {[
                ['PO', board.po],
                ['Class', board.class],
                ['Till', board.till],
                ['Bank', board.bank],
                ['Trust', board.trust],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-2xl border border-slate-200 bg-white px-1.5 py-2 text-center shadow-sm"
                >
                  <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                    {k}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-black text-slate-900">
                    {v}
                  </p>
                </div>
              ))}
            </section>

            <p className="text-[11px] font-bold text-slate-500">
              Tap a time — the board above moves. This is a sample company day.
            </p>
            <ol className="space-y-2">
              {SA_OS_DAY.map((row, i) => {
                const on = beat === i;
                const done = played.includes(i);
                return (
                  <li key={row.t}>
                    <button
                      type="button"
                      onClick={() => playBeat(i)}
                      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                        on
                          ? 'border-[#00b4d8] bg-white ring-2 ring-[#00b4d8]/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                            {row.t} · {row.kicker}
                          </p>
                          <p className="mt-0.5 text-sm font-black text-slate-900">
                            {row.title}
                          </p>
                          {on ? (
                            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                              {row.body}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-2xl px-2.5 py-1.5 text-right ${
                            done
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          <span className="block text-sm font-black tabular-nums">
                            {row.metric}
                          </span>
                          <span className="block text-[10px] font-bold">
                            {row.metricHint}
                          </span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={() => setTab('os')}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0077b6] text-sm font-black text-white"
            >
              See the live OS <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {tab === 'os' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {SA_OS_DEMO_MODULES.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMod(i)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                    i === mod
                      ? 'bg-[#0077b6] text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <ProductMockShell variant="hero">
                <Mock />
              </ProductMockShell>
            </div>
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6]">
                {currentMod.label}
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-900">
                {currentMod.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {currentMod.body}
              </p>
            </section>
            <p className="text-center text-[11px] text-slate-500">
              Sample chrome — same language as the live workspace.
            </p>
          </div>
        )}

        {tab === 'advisors' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Industry desks sit on Core. Members stay on this free app.
            </p>
            {SA_OS_ADVISORS.map((a) => (
              <article
                key={a.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className={`bg-gradient-to-r px-4 py-3 text-white ${a.tone}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/80">
                    {a.forWho}
                  </p>
                  <h2 className="text-base font-black">{a.name}</h2>
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-sky-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#0077b6]">
                      Member sees
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {a.memberSees}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Desk sees
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {a.deskSees}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === 'why' && (
          <div className="space-y-3">
            {SA_OS_WHY.map((w) => (
              <section
                key={w.title}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="text-base font-black text-slate-900">{w.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {w.body}
                </p>
              </section>
            ))}
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-black text-slate-900">
                What it replaces
              </h2>
              <ul className="mt-2 space-y-1.5">
                {SA_OS_REPLACE.map((row) => (
                  <li
                    key={row}
                    className="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {row}
                  </li>
                ))}
              </ul>
            </section>
            <Link
              href="/#compare"
              className="block text-center text-xs font-bold text-[#0077b6] underline"
            >
              Compare vs Excel / Xero / ERP on the site
            </Link>
          </div>
        )}

        {tab === 'start' && (
          <div className="space-y-3">
            <section className="rounded-3xl bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] p-5 text-white shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                For your company
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {COMPANY_TRIAL_DAYS} days free
              </h2>
              <p className="mt-2 text-sm text-white/90">
                Core OS R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month after trial.
                Members, patients and hire customers stay free on this app.
              </p>
              <Link
                href="/onboarding?lane=b2b"
                className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#0077b6]"
              >
                Register a business
              </Link>
            </section>
            <Link
              href="/join"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-900"
            >
              <Store className="h-4 w-4" /> Choose B2B, B2G or member
            </Link>
            <Link
              href="/pricing"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-900"
            >
              <Landmark className="h-4 w-4" /> Pricing
            </Link>
            <Link
              href="https://www.supplieradvisor.com"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-900"
            >
              <Network className="h-4 w-4" /> www.supplieradvisor.com
            </Link>
            <p className="text-center text-[11px] text-slate-500">
              Same login. After you register, use the building icon to switch
              into the workspace.
            </p>
          </div>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/95"
        style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-lg items-end justify-around">
          {DOCK.map((d) => {
            const on = tab === d.id;
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setTab(d.id)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-black ${
                  on ? 'text-[#0077b6]' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                {d.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
