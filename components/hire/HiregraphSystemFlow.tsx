'use client';

/**
 * HireAdvisor® end-to-end: supplier lists gear → B2C customer rents
 * → category requirements → handover → dual 2.5% commission.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Handshake,
  Package,
  Percent,
  Truck,
  UserRound,
} from 'lucide-react';
import {
  HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF,
  HIREGRAPH_PROCESS_GUIDE_PORTRAIT_HREF,
} from '@/lib/hire/hiregraph-process-guide-links';
import {
  HIRE_COMMERCIAL_COPY,
  HIRE_CUSTOMER_COMMISSION_PCT,
  HIRE_PLATFORM_COMMISSION_PCT,
  HIRE_SUPPLIER_COMMISSION_PCT,
} from '@/lib/hire/commercial';

type Props = {
  compact?: boolean;
  defaultCollapsed?: boolean;
};

const CHAIN = [
  { label: 'Supplier', sub: 'List gear' },
  { label: 'Category', sub: 'Rules' },
  { label: 'Customer', sub: 'Person rents' },
  { label: 'Requirements', sub: 'KYC / docs' },
  { label: 'Handover', sub: 'Out · return' },
  { label: 'Settle', sub: '2.5% + 2.5%' },
] as const;

const PHASES = [
  {
    title: '1 · Supplier side',
    steps: [
      {
        n: '1a',
        title: 'Onboard supplier',
        who: 'Supplier',
        desc: 'Trading name, contacts, categories, PL insurance where needed.',
        href: '/dashboard/hiregraph/suppliers',
        icon: Building2,
      },
      {
        n: '1b',
        title: 'Category rules',
        who: 'Platform',
        desc: 'Plant, vehicles, tools, events… each has different requirements.',
        href: '/dashboard/hiregraph/categories',
        icon: ClipboardList,
      },
      {
        n: '1c',
        title: 'List catalogue',
        who: 'Supplier',
        desc: 'Items with rate, deposit, stock qty and optional extra requirements.',
        href: '/dashboard/hiregraph/catalogue',
        icon: Package,
      },
    ],
  },
  {
    title: '2 · Customer side (B2C)',
    steps: [
      {
        n: '2a',
        title: 'Register renter',
        who: 'Customer',
        desc: 'Person renting — ID, contact, address, met requirements cache.',
        href: '/dashboard/hiregraph/customers',
        icon: UserRound,
      },
      {
        n: '2b',
        title: 'Request booking',
        who: 'Customer',
        desc: 'Dates, qty; system applies category requirements + dual fee quote.',
        href: '/dashboard/hiregraph/bookings',
        icon: CalendarDays,
      },
      {
        n: '2c',
        title: 'Clear requirements',
        who: 'Customer',
        desc: 'Licence, deposit, insurance, site access — whatever the category needs.',
        href: '/dashboard/hiregraph/bookings',
        icon: CheckCircle2,
      },
    ],
  },
  {
    title: '3 · Hand out · return · commission',
    steps: [
      {
        n: '3a',
        title: 'Handover OUT / RETURN',
        who: 'Both',
        desc: 'Condition notes and photos; damage against deposit if needed.',
        href: '/dashboard/hiregraph/handover',
        icon: Truck,
      },
      {
        n: '3b',
        title: 'Settle dual commission',
        who: 'Platform',
        desc: `${HIRE_SUPPLIER_COMMISSION_PCT}% supplier + ${HIRE_CUSTOMER_COMMISSION_PCT}% customer on rental GMV.`,
        href: '/dashboard/hiregraph/settlements',
        icon: Percent,
      },
      {
        n: '3c',
        title: 'Management pack',
        who: 'Owner',
        desc: 'GMV, dual fees, open hires — A4 landscape PDF.',
        href: '/dashboard/hiregraph/management',
        icon: Handshake,
      },
    ],
  },
] as const;

export default function HiregraphSystemFlow({
  compact,
  defaultCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-violet-500/25 dark:bg-gradient-to-br dark:from-[#12081f] dark:via-[#1e1033] dark:to-[#0a1628] ${
        compact ? 'mb-4' : 'mb-6'
      }`}
      aria-label="HireAdvisor rental marketplace process"
      id="hiregraph-system-flow"
    >
      <div className="bg-gradient-to-r from-[#4c1d95] via-[#7c3aed] to-[#22d3ee] px-5 py-4 text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              Hire marketplace · dual commission commercial model
            </p>
            <h2 className="mt-0.5 text-lg font-black leading-tight sm:text-xl">
              Supplier lists → Customer rents →{' '}
              {HIRE_SUPPLIER_COMMISSION_PCT}% + {HIRE_CUSTOMER_COMMISSION_PCT}%
            </h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-snug text-white/90">
              {HIRE_COMMERCIAL_COPY.vsOtherAdvisors} Categories (plant, vehicles,
              tools, events…) each enforce different hire requirements before
              gear goes out — including kids party (jumping castles, soft
              play).
            </p>
          </button>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={HIREGRAPH_PROCESS_GUIDE_LANDSCAPE_HREF}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-violet-900 shadow-sm hover:bg-violet-50"
            >
              PDF landscape
            </a>
            <a
              href={HIREGRAPH_PROCESS_GUIDE_PORTRAIT_HREF}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/25"
            >
              PDF portrait
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-white/25"
            >
              {open ? 'Hide' : 'Show'} process
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm dark:border-emerald-400/30 dark:bg-gradient-to-r dark:from-emerald-950 dark:to-teal-900/40">
            <p className="font-black text-emerald-950 dark:text-emerald-100">
              {HIRE_PLATFORM_COMMISSION_PCT}% total on hire rental GMV
            </p>
            <p className="mt-1 text-[12px] text-emerald-900/90 dark:text-emerald-50/80">
              {HIRE_COMMERCIAL_COPY.supplierLine}. {HIRE_COMMERCIAL_COPY.customerLine}.{' '}
              {HIRE_COMMERCIAL_COPY.depositLine}.
            </p>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CHAIN.map((n, i) => (
              <div
                key={n.label}
                className="min-w-[5.25rem] shrink-0 rounded-2xl border border-violet-100 bg-violet-50/60 px-2.5 py-2 dark:border-violet-500/25 dark:bg-gradient-to-br dark:from-violet-950 dark:to-fuchsia-900/40"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-violet-500 dark:text-violet-200/70">
                  {i + 1}
                </p>
                <p className="text-[11px] font-black text-slate-900 dark:text-white">
                  {n.label}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-violet-100/70">
                  {n.sub}
                </p>
              </div>
            ))}
          </div>

          {PHASES.map((phase) => (
            <div key={phase.title} className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
                {phase.title}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {phase.steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link
                      key={s.n}
                      href={s.href}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 transition hover:border-violet-300 hover:bg-white dark:border-violet-500/20 dark:bg-gradient-to-br dark:from-[#1e1033]/90 dark:to-[#0c3a4f]/40 dark:hover:border-violet-400/40"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-white dark:bg-gradient-to-br dark:from-violet-500 dark:to-cyan-400 dark:text-slate-950">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-violet-200/60">
                          {s.n} · {s.who}
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-violet-50/75">
                        {s.desc}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
