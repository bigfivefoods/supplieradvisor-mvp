'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  ShoppingCart,
  FileText,
  AlertTriangle,
  Award,
  Globe,
  Search,
  Target,
  Loader2,
  ArrowRight,
  TrendingUp,
  Handshake,
} from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { formatMoney } from '@/lib/customers/types';
import { CustomersNav } from '@/components/customers/CustomersShell';

type Summary = {
  customers: number;
  customersActive: number;
  leads: number;
  leadsOpen: number;
  opportunities: number;
  opportunitiesOpen: number;
  pipelineValue: number;
  weightedPipeline: number;
  wonValue: number;
  wonCount: number;
  overdueFollowups: number;
};

const MODULES = [
  {
    href: '/dashboard/customers/leads',
    icon: Target,
    title: 'Leads & opportunities',
    desc: 'Capture leads, score them, and run a full opportunity pipeline',
    badge: 'Core',
  },
  {
    href: '/dashboard/customers/profiles',
    icon: Users,
    title: 'Customer profiles',
    desc: 'Account master — contacts, addresses, credit, industry',
  },
  {
    href: '/dashboard/customers/onboard',
    icon: UserPlus,
    title: 'Add customer',
    desc: 'Onboard a new customer account from a lead or from scratch',
  },
  {
    href: '/dashboard/customers/quotes',
    icon: FileText,
    title: 'Quotes',
    desc: 'Pick products/services from inventory, price, send, convert to order',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/orders',
    icon: ShoppingCart,
    title: 'Sales orders',
    desc: 'Confirmed purchases — convert quotes or build from catalogue',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/invoices',
    icon: FileText,
    title: 'Invoices',
    desc: 'Bill customers, mark paid, auto-earn loyalty points',
    badge: 'Sell',
  },
  {
    href: '/dashboard/customers/loyalty',
    icon: Award,
    title: 'Loyalty',
    desc: 'Points, bronze→platinum tiers, earn & redeem',
  },
  {
    href: '/dashboard/customers/claims',
    icon: AlertTriangle,
    title: 'Claims',
    desc: 'Quality, delivery, damage — investigate and resolve',
  },
  {
    href: '/dashboard/customers/contracts',
    icon: Handshake,
    title: 'Contracts',
    desc: 'Supply/service agreements, SLAs, renewals',
  },
  {
    href: '/dashboard/customers/portal',
    icon: Globe,
    title: 'Customer portal',
    desc: 'Self-service access for your customers',
  },
  {
    href: '/dashboard/customers/search',
    icon: Search,
    title: 'Search',
    desc: 'Find customers, leads, and deals quickly',
  },
  {
    href: '/dashboard/customers/riad-log',
    icon: AlertTriangle,
    title: 'Customer RIAD',
    desc: 'Risks, issues, actions, and decisions',
  },
  {
    href: '/dashboard/customers/invites',
    icon: UserPlus,
    title: 'Invitations',
    desc: 'Sent customer portal / network invites',
  },
] as const;

export default function CustomersHub() {
  const companyId = getSelectedCompanyId();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/summary?companyId=${companyId}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to open Customers.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-12">
      <CustomersNav />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
          Customer lifecycle CRM
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Customers
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          Lead → opportunity → quote (pick products) → order → invoice → loyalty · plus claims,
          contracts, and RIAD — all on Supabase.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-[11px] font-semibold">
        {[
          ['Leads', '/dashboard/customers/leads'],
          ['Opps', '/dashboard/customers/leads?tab=pipeline'],
          ['Quote', '/dashboard/customers/quotes'],
          ['Order', '/dashboard/customers/orders'],
          ['Invoice', '/dashboard/customers/invoices'],
          ['Loyalty', '/dashboard/customers/loyalty'],
          ['Claims', '/dashboard/customers/claims'],
          ['RIAD', '/dashboard/customers/riad-log'],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border bg-white py-2.5 px-1 hover:border-[#00b4d8] text-slate-700"
          >
            {label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <Kpi
            label="Customers"
            value={summary?.customers ?? 0}
            sub={`${summary?.customersActive ?? 0} active`}
            href="/dashboard/customers/profiles"
          />
          <Kpi
            label="Open leads"
            value={summary?.leadsOpen ?? 0}
            sub={`${summary?.leads ?? 0} total · ${summary?.overdueFollowups ?? 0} overdue`}
            href="/dashboard/customers/leads?tab=leads"
            tone={(summary?.overdueFollowups || 0) > 0 ? 'amber' : 'neutral'}
          />
          <Kpi
            label="Open pipeline"
            value={formatMoney(summary?.pipelineValue ?? 0)}
            sub={`${summary?.opportunitiesOpen ?? 0} deals · weighted ${formatMoney(summary?.weightedPipeline ?? 0)}`}
            href="/dashboard/customers/leads?tab=pipeline"
            isText
          />
          <Kpi
            label="Won value"
            value={formatMoney(summary?.wonValue ?? 0)}
            sub={`${summary?.wonCount ?? 0} closed won`}
            href="/dashboard/customers/leads?tab=pipeline"
            tone="emerald"
            isText
          />
        </div>
      )}

      <div className="rounded-3xl border border-sky-100 bg-sky-50/50 p-5 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <TrendingUp className="w-6 h-6 text-[#0077b6] flex-shrink-0" />
          <div>
            <div className="font-bold text-slate-900">Sales process</div>
            <p className="text-sm text-neutral-600 mt-0.5">
              Capture every lead with full detail, convert to opportunities, move stages, then
              onboard as a customer profile.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/customers/leads"
          className="btn-primary !py-2.5 !px-5 text-sm flex-shrink-0"
        >
          Open pipeline <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white border border-neutral-200 rounded-3xl p-6 hover:border-[#00b4d8] hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <m.icon className="w-7 h-7 text-[#00b4d8]" />
              {'badge' in m && m.badge && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#00b4d8]/10 text-[#0077b6]">
                  {m.badge}
                </span>
              )}
            </div>
            <div className="font-bold text-lg text-slate-900 group-hover:text-[#0077b6]">
              {m.title}
            </div>
            <div className="text-sm text-neutral-500 mt-1">{m.desc}</div>
            <div className="mt-4 text-xs font-medium text-[#00b4d8] inline-flex items-center gap-1">
              Open <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  href,
  tone = 'neutral',
  isText,
}: {
  label: string;
  value: number | string;
  sub: string;
  href?: string;
  tone?: 'neutral' | 'amber' | 'emerald';
  isText?: boolean;
}) {
  const tones = {
    neutral: 'bg-white border-neutral-200',
    amber: 'bg-amber-50 border-amber-100',
    emerald: 'bg-emerald-50 border-emerald-100',
  };
  const className = `rounded-3xl border p-5 block ${tones[tone]} ${href ? 'hover:border-[#00b4d8] transition-all' : ''}`;
  const body = (
    <>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div
        className={`font-black tracking-tighter text-slate-900 ${isText ? 'text-xl sm:text-2xl' : 'text-3xl'}`}
      >
        {value}
      </div>
      <div className="text-xs text-neutral-500 mt-1">{sub}</div>
    </>
  );
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return <div className={className}>{body}</div>;
}
