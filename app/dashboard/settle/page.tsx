'use client';

/**
 * Settle command center — one surface for Money, claims, first-trade, escrow.
 */
import Link from 'next/link';
import {
  Wallet,
  Banknote,
  Rocket,
  Coins,
  Bell,
  ArrowRight,
  Store,
  Compass,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import InevitableNextBanner from '@/components/dashboard/InevitableNextBanner';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';

const CARDS = [
  {
    title: 'Seller Money hub',
    body: 'Open AR, confirm buyer claims + POP, dunning, installments, ledger.',
    href: '/dashboard/customers/money',
    icon: Wallet,
    tone: 'emerald',
  },
  {
    title: 'Buyer Money',
    body: 'Pay suppliers, upload POP, track claim status.',
    href: '/dashboard/buyer/money',
    icon: Banknote,
    tone: 'sky',
  },
  {
    title: 'First trade',
    body: 'Bootstrap → send invoice → collect on Money → rate.',
    href: '/dashboard',
    icon: Rocket,
    tone: 'violet',
  },
  {
    title: 'USDC / PO escrow',
    body: 'Programmable settle on Base when counterparties need escrow.',
    href: '/dashboard/escrow',
    icon: Coins,
    tone: 'amber',
  },
  {
    title: 'Marketplace',
    body: 'Listings → inquiry → connect → PO/invoice → settle.',
    href: '/dashboard/connections/marketplace',
    icon: Store,
    tone: 'cyan',
  },
  {
    title: 'Open-to-trade',
    body: 'Ranked discoverable partners; request trade with a note.',
    href: '/dashboard/connections/discover',
    icon: Compass,
    tone: 'teal',
  },
  {
    title: 'AR aging',
    body: 'Buckets, CSV export, full collections depth.',
    href: '/dashboard/customers/ar',
    icon: Bell,
    tone: 'rose',
  },
] as const;

export default function SettleCommandPage() {
  return (
    <CompanyRequired>
      <SettleInner />
    </CompanyRequired>
  );
}

function SettleInner() {
  const companyId = getSelectedCompanyId();

  return (
    <CustomersPage>
      <CustomersHeader
        title="Settle"
        titleAccent="Command"
        showNav
        description="Proof & live settle: claims with POP, ledger confirm, rating loop, and optional on-chain escrow. Prefer Money hub for day-to-day cash."
      />

      <div className="max-w-4xl">
        {companyId ? <InevitableNextBanner /> : null}

        <div className="grid sm:grid-cols-2 gap-3">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-slate-50 border border-neutral-100 p-2">
                  <c.icon className="w-4 h-4 text-[#0077b6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900 group-hover:text-[#0077b6] flex items-center gap-1">
                    {c.title}
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {c.body}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p className="font-bold text-slate-800">Ops smoke</p>
          <p className="mt-0.5">
            <code className="text-[11px]">GET /api/system/settle-smoke</code> — claims,
            ledger, installments, promise-to-pay columns.
          </p>
        </div>
      </div>
    </CustomersPage>
  );
}
