'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Factory,
  FileText,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  AccountingMock,
  CrmMock,
  InventoryMock,
  ManufacturingMock,
  NetworkMock,
  OpsMock,
  ProductMockShell,
  SrmMock,
} from '@/components/marketing/ProductMocks';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

type Kind = 'customer' | 'supplier';

type Beat = {
  t: string;
  kicker: string;
  title: string;
  body: string;
  metric: string;
  hint: string;
};

const CUSTOMER_BEATS: Beat[] = [
  {
    t: '08:10',
    kicker: 'Win the work',
    title: 'Quote lands, deal moves',
    body: 'Your CRM shows the same live quote they already run. Pipeline, not a spreadsheet tab.',
    metric: 'R 186k',
    hint: 'Quote sent',
  },
  {
    t: '09:40',
    kicker: 'Order the chain',
    title: 'PO on the chain — only what is set up',
    body: 'You raise a PO. It becomes their sales order and a manufacturer PO in one move. No email trail.',
    metric: 'PO-1042',
    hint: 'Sent',
  },
  {
    t: '11:15',
    kicker: 'Make',
    title: 'Production you can see',
    body: 'Scheduled → in production → produced. You see the status. You never see their factory name.',
    metric: 'WIP',
    hint: 'In production',
  },
  {
    t: '14:05',
    kicker: 'Deliver',
    title: 'OTIFEF on the receipt',
    body: 'On time, in full, error-free — scored on the same books both sides open.',
    metric: '98%',
    hint: 'OTIFEF',
  },
  {
    t: '16:20',
    kicker: 'Settle',
    title: 'Invoice paid on the statement',
    body: 'AR, the PDF, and the allocation live together. Follow-up is a status, not a WhatsApp.',
    metric: 'Paid',
    hint: 'Same day',
  },
  {
    t: '17:00',
    kicker: 'Trust',
    title: 'Rate once. The next buyer already knows.',
    body: 'The score travels with the company. Verified history, not a PDF in a drawer.',
    metric: '4.9',
    hint: 'Network',
  },
];

const SUPPLIER_BEATS: Beat[] = [
  {
    t: '08:05',
    kicker: 'Inbound',
    title: 'A PO from the company you already supply',
    body: 'It arrives as their purchase order — not a forwarded customer email. Confirm on the portal.',
    metric: 'PO-1042',
    hint: 'New',
  },
  {
    t: '08:12',
    kicker: 'Accept',
    title: 'One tap. OTIFEF clock starts.',
    body: 'Accept, promise a date, lock quantity. Both desks see the same status.',
    metric: 'Accepted',
    hint: 'Clock on',
  },
  {
    t: '10:40',
    kicker: 'Produce',
    title: 'Released → in progress → completed',
    body: 'Update production. They tell their customer. You never name the end buyer.',
    metric: 'Batch A12',
    hint: 'In progress',
  },
  {
    t: '13:20',
    kicker: 'Stock',
    title: 'Confirm lots, not a screenshot',
    body: 'Availability, batch, manufacture and expiry on the order — the way they already run it.',
    metric: '1 200',
    hint: 'Ready',
  },
  {
    t: '15:45',
    kicker: 'Get paid',
    title: 'Invoice they already expect',
    body: 'Raise from the PO. They see it on the statement. Cash in on the same OS.',
    metric: 'R 84k',
    hint: 'Invoiced',
  },
  {
    t: '16:50',
    kicker: 'Score',
    title: 'OTIFEF is the next order',
    body: 'On-time, in-full, error-free sits on your company. The next buyer already trusts the number.',
    metric: '97%',
    hint: 'OTIFEF',
  },
];

const OS_MODULES = [
  { id: 'crm', label: 'Customers', Mock: CrmMock, blurb: 'Pipeline, quotes, ratings — the book you sell from.' },
  { id: 'srm', label: 'Suppliers', Mock: SrmMock, blurb: 'OTIFEF, POs and connected manufacturers on one desk.' },
  { id: 'ops', label: 'Operations', Mock: OpsMock, blurb: 'Inbound, WIP, ship — one chain, no blind spots.' },
  { id: 'make', label: 'Make', Mock: ManufacturingMock, blurb: 'Work orders that land finished goods in stock.' },
  { id: 'stock', label: 'Inventory', Mock: InventoryMock, blurb: 'Lots, holds, warehouses that actually block a sale.' },
  { id: 'fin', label: 'Finance', Mock: AccountingMock, blurb: 'AR, AP, bank rec — not a sidecar spreadsheet.' },
  { id: 'net', label: 'Network', Mock: NetworkMock, blurb: 'CIPC, bank and delivery scores on the company.' },
] as const;

function boardFor(kind: Kind, beat: number) {
  if (kind === 'customer') {
    return [
      { k: 'Quote', v: beat >= 0 ? 'Sent' : '—' },
      { k: 'Order', v: beat >= 1 ? 'PO-1042' : '—' },
      { k: 'Make', v: beat >= 2 ? (beat >= 3 ? 'Produced' : 'WIP') : 'Queued' },
      { k: 'Cash', v: beat >= 4 ? 'Paid' : beat >= 1 ? 'Open' : '—' },
      { k: 'Trust', v: beat >= 5 ? '4.9' : '4.6' },
    ];
  }
  return [
    { k: 'PO', v: beat >= 0 ? 'PO-1042' : '—' },
    { k: 'Accept', v: beat >= 1 ? 'Yes' : 'Wait' },
    { k: 'Make', v: beat >= 2 ? (beat >= 3 ? 'Ready' : 'WIP') : '—' },
    { k: 'Pay', v: beat >= 4 ? 'R 84k' : '—' },
    { k: 'OTIFEF', v: beat >= 5 ? '97%' : '—' },
  ];
}

export function PortalJoinDemo({
  hostName,
  hostLogo,
  kind,
  joinPath,
}: {
  hostName: string;
  hostLogo?: string | null;
  kind: Kind;
  joinPath: string;
}) {
  const beats = kind === 'customer' ? CUSTOMER_BEATS : SUPPLIER_BEATS;
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mod, setMod] = useState(kind === 'customer' ? 0 : 1);
  const [note, setNote] = useState<string | null>(null);
  const board = useMemo(() => boardFor(kind, beat), [kind, beat]);
  const current = beats[beat] || beats[0];

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setBeat((i) => (i + 1) % beats.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [playing, beats.length]);

  const go = (i: number) => {
    setBeat(i);
    setPlaying(false);
    setNote(null);
  };

  const doAction = (i: number, msg: string) => {
    setBeat(i);
    setPlaying(false);
    setNote(msg);
  };

  const they =
    kind === 'customer'
      ? `You buy from ${hostName} today. Run the same OS — sell, buy, produce and settle on one company book.`
      : `You supply ${hostName} today. Run the same OS — take the PO, produce, invoice and get paid on one book.`;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/20 bg-gradient-to-br from-[#0077b6] via-[#00b4d8] to-[#0c4a6e] p-5 text-white shadow-xl sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {hostLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hostLogo}
                alt=""
                className="h-12 w-12 rounded-2xl border border-white/30 bg-white object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Building2 className="h-6 w-6" />
              </div>
            )}
            <SaOfficialLogo
              title="SupplierAdvisor"
              className="sa-logo-on-dark h-8 w-auto"
            />
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
            Interactive demo
          </span>
        </div>
        <h2 className="relative mt-4 text-2xl font-black tracking-tight sm:text-4xl">
          Work like {hostName}. Own the OS.
        </h2>
        <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-[15px]">
          {they}
        </p>
        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={joinPath}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#0077b6] hover:bg-cyan-50"
          >
            Start {COMPANY_TRIAL_DAYS} days free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-white/80">
            Then Core at R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month · cancel anytime
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10 sm:px-5">
          <Zap className="h-4 w-4 text-[#0077b6]" />
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Play a live day
          </p>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white"
          >
            {playing ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Play
              </>
            )}
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 p-3 sm:gap-2 sm:p-4">
          {board.map((cell) => (
            <div
              key={cell.k}
              className="rounded-2xl border border-slate-100 bg-slate-50 px-1.5 py-2 text-center dark:border-white/10 dark:bg-black/20"
            >
              <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                {cell.k}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-black tabular-nums text-slate-900 dark:text-white sm:text-sm">
                {cell.v}
              </p>
            </div>
          ))}
        </div>
        <p className="px-4 text-[11px] font-bold text-slate-500 sm:px-5">
          Tap a time — the board moves. Then drive the desk yourself.
        </p>
        <ol className="space-y-2 p-3 sm:p-4">
          {beats.map((row, i) => {
            const on = beat === i;
            const done = beat >= i;
            return (
              <li key={row.t}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${
                    on
                      ? 'border-[#00b4d8] bg-cyan-50/70 ring-2 ring-[#00b4d8]/25 dark:border-cyan-400/40 dark:bg-cyan-400/10'
                      : 'border-slate-200 bg-white hover:border-cyan-200 dark:border-white/10 dark:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#0077b6] dark:text-cyan-300">
                        {row.t} · {row.kicker}
                      </p>
                      <p className="mt-0.5 text-sm font-black text-slate-900 dark:text-white">
                        {row.title}
                      </p>
                      {on ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-white/70">
                          {row.body}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-2xl px-2.5 py-1.5 text-right ${
                        done
                          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100'
                          : 'bg-slate-50 text-slate-500 dark:bg-white/10 dark:text-white/60'
                      }`}
                    >
                      <span className="block text-sm font-black tabular-nums">
                        {row.metric}
                      </span>
                      <span className="block text-[10px] font-bold">{row.hint}</span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10 sm:px-5">
          <Sparkles className="h-4 w-4 text-[#0077b6]" />
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Your desk — click it
          </p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-100">
            Sample · read-write
          </span>
        </div>
        <div className="p-3 sm:p-5">
          {note ? (
            <p className="mb-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
              {note}
            </p>
          ) : (
            <p className="mb-3 text-sm text-slate-600 dark:text-white/70">
              {current.body}
            </p>
          )}
          {kind === 'customer' ? (
            <CustomerDesk beat={beat} onAction={doAction} />
          ) : (
            <SupplierDesk beat={beat} onAction={doAction} />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10 sm:px-5">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            The rest of the OS
          </p>
          <p className="text-[12px] text-slate-500">
            Same chrome {hostName} already runs. Tap a module.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5">
          {OS_MODULES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMod(i);
                setPlaying(false);
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                i === mod
                  ? 'bg-[#0077b6] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:border-cyan-200 dark:border-white/15 dark:bg-white/5 dark:text-white/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="px-4 pt-3 text-sm text-slate-600 dark:text-white/70 sm:px-5">
          {OS_MODULES[mod]?.blurb}
        </p>
        <div className="p-3 sm:p-4">
          <ProductMockShell variant="hero">
            {(() => {
              const Mock = OS_MODULES[mod]?.Mock || OpsMock;
              return <Mock />;
            })()}
          </ProductMockShell>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Guest seat
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-white/70">
            <li>See {hostName}’s books for this account</li>
            <li>Order only what they set up</li>
            <li>No customers of your own</li>
            <li>Trust stays on their company</li>
          </ul>
        </div>
        <div className="rounded-[1.5rem] border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-cyan-400/30 dark:from-cyan-400/10 dark:to-transparent">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
            Your workspace
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-800 dark:text-white">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0077b6]" />
              Your CRM, SRM, POs, invoices, OTIFEF
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0077b6]" />
              Quote → order → produce → pay → rate
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0077b6]" />
              Verified CIPC, bank and delivery scores
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0077b6]" />
              {COMPANY_TRIAL_DAYS} days free, then R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}
              /month
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-[#0077b6] to-[#00b4d8] p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-7 w-7 shrink-0 opacity-90" />
          <div>
            <h3 className="text-xl font-black tracking-tight">
              Join {hostName} on SupplierAdvisor
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              Same quotes, POs, invoices and ratings they already run — on your
              company, not a guest seat forever.
            </p>
            <Link
              href={joinPath}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#0077b6] hover:bg-cyan-50"
            >
              Create your workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function DeskFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1016]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-white/10 dark:bg-[#121820]">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="ml-1 truncate text-[11px] font-bold text-slate-500">{title}</p>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function CustomerDesk({
  beat,
  onAction,
}: {
  beat: number;
  onAction: (i: number, msg: string) => void;
}) {
  if (beat <= 0) {
    return (
      <DeskFrame title="dashboard/customers · quotes">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          CRM · quote
        </p>
        <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
          RetailCo · private label juice
        </p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {['Lead', 'Quoted', 'Won', 'Live'].map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                onAction(i === 0 ? 0 : 1, `Pipeline moved to ${s}`)
              }
              className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${
                i <= 1
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-900'
                  : 'border-slate-100 bg-slate-50 text-slate-500'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAction(1, 'Quote sent — PO is next on the chain.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          <FileText className="h-3.5 w-3.5" /> Send quote · R186k
        </button>
      </DeskFrame>
    );
  }
  if (beat === 1) {
    return (
      <DeskFrame title="dashboard/orders · purchase order">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Chain PO
        </p>
        <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
          PO-1042 · 1 200 units
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-white/70">
          <li>Still juice 1L · 800</li>
          <li>Sparkling 330ml · 400</li>
        </ul>
        <button
          type="button"
          onClick={() => onAction(2, 'PO sent on the chain. Production is live.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          <Truck className="h-3.5 w-3.5" /> Raise PO on chain
        </button>
      </DeskFrame>
    );
  }
  if (beat === 2 || beat === 3) {
    return (
      <DeskFrame title="dashboard/operations · production">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Status you can see
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Scheduled', 'In production', 'Produced'].map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onAction(i <= 0 ? 2 : 3, `Order is ${s.toLowerCase()}.`)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                (beat === 2 && i <= 1) || (beat >= 3 && i <= 2)
                  ? 'bg-[#0077b6] text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-white/70">
          OTIFEF starts when goods move. Tap Produced when the lot is ready.
        </p>
        <button
          type="button"
          onClick={() => onAction(3, 'Produced · OTIFEF 98% on the receipt.')}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
        >
          <Factory className="h-3.5 w-3.5" /> Mark produced
        </button>
      </DeskFrame>
    );
  }
  if (beat === 4) {
    return (
      <DeskFrame title="dashboard/accounting · statement">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Invoice INV-88
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
          R 186,000
        </p>
        <p className="text-sm text-slate-500">Open on the statement</p>
        <button
          type="button"
          onClick={() => onAction(5, 'Paid. Rate the loop — the next buyer sees it.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          <Wallet className="h-3.5 w-3.5" /> Mark paid
        </button>
      </DeskFrame>
    );
  }
  return (
    <DeskFrame title="dashboard/ratings">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
        Close the loop
      </p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onAction(5, `Rated ${n}.0 — that score travels.`)}
            className="p-1"
          >
            <Star
              className={`h-7 w-7 ${
                n <= 5 ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">
        4.9 · published on the network
      </p>
    </DeskFrame>
  );
}

function SupplierDesk({
  beat,
  onAction,
}: {
  beat: number;
  onAction: (i: number, msg: string) => void;
}) {
  if (beat <= 0) {
    return (
      <DeskFrame title="portal · inbound PO">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          New purchase order
        </p>
        <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
          PO-1042 · 1 200 units
        </p>
        <p className="mt-1 text-sm text-slate-500">From the company you already supply</p>
        <button
          type="button"
          onClick={() => onAction(1, 'Accepted. OTIFEF clock started.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Accept PO
        </button>
      </DeskFrame>
    );
  }
  if (beat === 1 || beat === 2) {
    const steps = ['Released', 'In progress', 'Completed'];
    const at = beat === 1 ? 0 : 1;
    return (
      <DeskFrame title="portal · production">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Production
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() =>
                onAction(i === 0 ? 1 : i === 1 ? 2 : 3, `Status: ${s}`)
              }
              className={`rounded-full px-3 py-1.5 text-[11px] font-black ${
                i <= at ? 'bg-[#0077b6] text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAction(2, 'In progress · batch A12 on the order.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white"
        >
          <Factory className="h-3.5 w-3.5" /> Advance production
        </button>
      </DeskFrame>
    );
  }
  if (beat === 3) {
    return (
      <DeskFrame title="portal · stock">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Lots
        </p>
        <p className="mt-1 font-black text-slate-900 dark:text-white">
          Batch A12 · 1 200 · mfg today
        </p>
        <button
          type="button"
          onClick={() => onAction(4, 'Stock confirmed. Invoice is next.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          Confirm availability
        </button>
      </DeskFrame>
    );
  }
  if (beat === 4) {
    return (
      <DeskFrame title="portal · invoice">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
          Get paid
        </p>
        <p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
          R 84,000
        </p>
        <button
          type="button"
          onClick={() => onAction(5, 'Invoiced. OTIFEF is the next order.')}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0077b6] px-4 py-2 text-xs font-black text-white"
        >
          <Banknote className="h-3.5 w-3.5" /> Raise invoice from PO
        </button>
      </DeskFrame>
    );
  }
  return (
    <DeskFrame title="portal · OTIFEF">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
        Score
      </p>
      <p className="mt-1 text-3xl font-black tabular-nums text-[#0077b6]">97%</p>
      <p className="text-sm text-slate-600 dark:text-white/70">
        On time · in full · error-free. The next buyer already sees this.
      </p>
    </DeskFrame>
  );
}
