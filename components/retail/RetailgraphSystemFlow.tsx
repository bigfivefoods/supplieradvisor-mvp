'use client';

/**
 * RetailAdvisor® end-to-end: catalogue SKUs → till → SA Member pay →
 * Customers 360 / Finance / Inventory — one OS.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  ChevronDown,
  Nfc,
  Package,
  ShoppingBag,
  Users,
  Warehouse,
} from 'lucide-react';

type Props = {
  compact?: boolean;
  defaultCollapsed?: boolean;
};

const CHAIN = [
  { label: 'Catalogue', sub: 'Shared SKUs' },
  { label: 'Till', sub: 'Cash · QR · NFC' },
  { label: 'SA Member', sub: 'Pay on phone' },
  { label: 'Customers 360', sub: 'Walk-in · wallet' },
  { label: 'Finance', sub: 'AR · VAT' },
  { label: 'Inventory', sub: 'One product book' },
] as const;

const PHASES = [
  {
    title: '1 · Catalogue on Core Inventory',
    steps: [
      {
        n: '1a',
        title: 'Till SKUs',
        who: 'Owner',
        desc: 'Price the items you ring up. Sync them into Inventory as shared SKUs.',
        href: '/dashboard/retailgraph/catalogue',
      },
      {
        n: '1b',
        title: 'Shared product book',
        who: 'Owner',
        desc: 'Gym shop, hire and clinic consumables can use the same Inventory SKU.',
        href: '/dashboard/inventory/shared',
      },
    ],
  },
  {
    title: '2 · Sell & collect',
    steps: [
      {
        n: '2a',
        title: 'Till',
        who: 'Desk',
        desc: 'Basket, cash, or present QR / NFC so the shopper pays on SA Member.',
        href: '/dashboard/retailgraph/till',
      },
      {
        n: '2b',
        title: 'SA Member pay',
        who: 'Customer',
        desc: 'Free personal wallet. Card / Apple Pay settles to the store (1% admin).',
        href: '/me',
      },
      {
        n: '2c',
        title: 'Accounts',
        who: 'Owner',
        desc: 'Open bills collect at the till like gym and clinic Advisors.',
        href: '/dashboard/retailgraph/accounts',
      },
    ],
  },
  {
    title: '3 · One OS',
    steps: [
      {
        n: '3a',
        title: 'Customers 360',
        who: 'Owner',
        desc: 'Walk-ins and SA Member shoppers land on the CRM book with invoices.',
        href: '/dashboard/customers/360',
      },
      {
        n: '3b',
        title: 'Finance journals',
        who: 'Owner',
        desc: 'Sales post AR + revenue + VAT. Same invoice in Accounts and Finance.',
        href: '/dashboard/accounting',
      },
      {
        n: '3c',
        title: 'Website & comms',
        who: 'Owner',
        desc: 'Public shop page, SA Member QR, ads to linked wallets.',
        href: '/dashboard/retailgraph/website',
      },
    ],
  },
] as const;

export default function RetailgraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`mb-6 overflow-hidden rounded-3xl border border-orange-200 bg-white ${
        compact ? 'mb-4' : ''
      }`}
      aria-label="RetailAdvisor process design"
      id="retailgraph-system-flow"
    >
      <div className="bg-gradient-to-r from-orange-950 via-orange-800 to-amber-600 px-5 py-4 text-white">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Full retail OS — process design
            </p>
            <h2 className="mt-0.5 text-lg font-black leading-tight sm:text-xl">
              Catalogue → Till → SA Member → One OS
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-snug text-white/90">
              Shared SKUs with Inventory. Shoppers pay on SA Member. Sales post
              VAT invoices on Customers and Finance — one book.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider">
            {open ? 'Hide' : 'Show'} process
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>
      </div>

      {open ? (
        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {CHAIN.map((node, i) => (
              <div key={node.label} className="contents">
                <div className="min-w-[6rem] rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
                  <p className="text-xs font-black text-slate-900">{node.label}</p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {node.sub}
                  </p>
                </div>
                {i < CHAIN.length - 1 ? (
                  <ArrowRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                ) : null}
              </div>
            ))}
          </div>

          {PHASES.map((phase) => (
            <div key={phase.title}>
              <h4 className="mb-2 text-sm font-black text-slate-900">
                {phase.title}
              </h4>
              <div className="grid gap-2 sm:grid-cols-3">
                {phase.steps.map((step) => (
                  <Link
                    key={step.n}
                    href={step.href}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:border-orange-300"
                  >
                    <p className="text-[10px] font-black uppercase text-orange-800">
                      {step.n} · {step.who}
                    </p>
                    <p className="text-sm font-bold text-slate-900">{step.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">{step.desc}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                icon: Package,
                title: 'One product book',
                desc: 'Retail till SKUs sync to Inventory with gym, hire and clinic.',
              },
              {
                icon: Users,
                title: 'Customers 360',
                desc: 'Walk-in or SA Member — same CRM row as invoices.',
              },
              {
                icon: Banknote,
                title: 'VAT on the books',
                desc: 'Sales post AR + revenue + VAT. Card / Apple Pay 1% admin.',
              },
              {
                icon: Nfc,
                title: 'Present to pay',
                desc: 'QR / NFC at the till; shopper pays on the official SA Member app.',
              },
              {
                icon: ShoppingBag,
                title: 'Same till path',
                desc: 'Gym and clinic desks can present the same pay-at-till flow.',
              },
              {
                icon: Warehouse,
                title: 'Stock when tracked',
                desc: 'Shared SKUs decrement Inventory when the till sells them.',
              },
            ].map((g) => (
              <div
                key={g.title}
                className="rounded-2xl border border-slate-200 px-3 py-2.5"
              >
                <g.icon className="mb-1 h-4 w-4 text-orange-700" />
                <p className="text-sm font-black text-slate-900">{g.title}</p>
                <p className="text-[11px] text-slate-600">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
