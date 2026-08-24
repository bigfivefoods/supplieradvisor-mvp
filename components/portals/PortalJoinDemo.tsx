'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import {
  AccountingMock,
  CrmMock,
  InventoryMock,
  OpsMock,
  ProductMockShell,
  SrmMock,
} from '@/components/marketing/ProductMocks';
import {
  COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
  COMPANY_TRIAL_DAYS,
} from '@/lib/billing/company-subscription';

const STEPS = [
  {
    title: 'Your books, live',
    body: 'Customers, suppliers, POs, invoices and OTIFEF on one company OS — not a spreadsheet.',
  },
  {
    title: 'Trade the loop',
    body: 'Quote → order → produce → deliver → pay → rate. Both sides see the same chain.',
  },
  {
    title: 'Verified trust',
    body: 'CIPC, bank and delivery scores travel with the company. The next buyer already knows.',
  },
];

type Scene = {
  id: string;
  label: string;
  blurb: string;
  Mock: typeof CrmMock;
};

function scenesFor(kind: 'customer' | 'supplier'): Scene[] {
  if (kind === 'customer') {
    return [
      {
        id: 'crm',
        label: 'Customers',
        blurb: 'Own the book of who you sell to — pipeline, quotes and ratings in one desk.',
        Mock: CrmMock,
      },
      {
        id: 'ops',
        label: 'Trade loop',
        blurb: 'Quote, raise the PO, produce and deliver on one chain both sides can see.',
        Mock: OpsMock,
      },
      {
        id: 'fin',
        label: 'Settle',
        blurb: 'Invoices, statements and cash in the same OS — not a follow-up spreadsheet.',
        Mock: AccountingMock,
      },
    ];
  }
  return [
    {
      id: 'srm',
      label: 'Suppliers',
      blurb: 'OTIFEF, connected suppliers and live POs — the desk you run inbound from.',
      Mock: SrmMock,
    },
    {
      id: 'inv',
      label: 'Stock',
      blurb: 'Confirm availability, batches and make-to-order without a side WhatsApp.',
      Mock: InventoryMock,
    },
    {
      id: 'fin',
      label: 'Get paid',
      blurb: 'The same invoices and ratings they already run, on your own company books.',
      Mock: AccountingMock,
    },
  ];
}

export function PortalJoinDemo({
  hostName,
  kind,
  joinPath,
}: {
  hostName: string;
  kind: 'customer' | 'supplier';
  joinPath: string;
}) {
  const they =
    kind === 'customer'
      ? 'You buy from them today. Run the same OS and sell, buy, and settle on one book.'
      : 'You supply them today. Run the same OS and take orders, produce, and get paid on one book.';
  const scenes = scenesFor(kind);
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const scene = scenes.find((s) => s.id === sceneId) || scenes[0];
  const Mock = scene.Mock;

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 sm:p-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0077b6]">
          Demo · SupplierAdvisor
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">
          Work like {hostName} — on the same OS
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{they}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.title}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3"
            >
              <p className="text-sm font-black text-slate-900">{s.title}</p>
              <p className="mt-1 text-[12px] text-slate-600 leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={joinPath}
            className="btn-primary !py-2.5 !px-5 text-sm inline-flex items-center gap-2"
          >
            Create your workspace <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-slate-500">
            {COMPANY_TRIAL_DAYS} days free · then R{COMPANY_SUBSCRIPTION_MONTHLY_ZAR}
            /month
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#0077b6]" />
          <p className="text-sm font-black text-slate-900">Live OS (preview)</p>
          <div className="ml-auto flex flex-wrap gap-1">
            {scenes.map((s) => {
              const on = s.id === scene.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSceneId(s.id)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    on
                      ? 'bg-[#0077b6] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="px-5 pt-3 text-sm text-slate-600">{scene.blurb}</p>
        <div className="p-3 sm:p-4">
          <ProductMockShell variant="hero">
            <Mock />
          </ProductMockShell>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-white/15 bg-gradient-to-br from-[#0077b6] to-[#00b4d8] p-6 text-white shadow-lg">
        <h3 className="text-lg font-black tracking-tight">
          Join {hostName} on SupplierAdvisor
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm text-white/95">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Same quotes, POs, invoices and ratings they already run
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Your own company workspace — not a guest seat forever
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {COMPANY_TRIAL_DAYS}-day trial, then Core at R
            {COMPANY_SUBSCRIPTION_MONTHLY_ZAR}/month
          </li>
        </ul>
        <Link
          href={joinPath}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#0077b6] hover:bg-cyan-50"
        >
          Start free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
