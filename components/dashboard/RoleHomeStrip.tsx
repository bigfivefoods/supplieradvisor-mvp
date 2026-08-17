'use client';

/**
 * Role-based primary actions on the home dashboard (Sprint D).
 */
import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  ClipboardList,
  Package,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import { useCompanyRole } from '@/lib/business/useCompanyRole';
import type { TeamRole } from '@/lib/business/permissions';
import {
  ADVISOR_MODULE_CORE_HREF,
  enabledAdvisorModules,
} from '@/lib/product/advisor-core-unlocks';

type Action = {
  label: string;
  href: string;
  desc: string;
  icon: typeof Wallet;
};

function actionsForRole(role: TeamRole | null): Action[] {
  const r = role || 'owner';
  if (r === 'finance') {
    return [
      {
        label: 'Settle & claims',
        href: '/dashboard/settle',
        desc: 'Clear stuck payments',
        icon: Wallet,
      },
      {
        label: 'Accounts receivable',
        href: '/dashboard/accounting/accounts-receivable',
        desc: 'Chase open AR',
        icon: ClipboardList,
      },
      {
        label: 'Money hub',
        href: '/dashboard/customers/money',
        desc: 'Cash + claims overview',
        icon: Wallet,
      },
      {
        label: 'Escrow release',
        href: '/dashboard/escrow',
        desc: 'On-chain confirmations',
        icon: Package,
      },
    ];
  }
  if (r === 'operations') {
    return [
      {
        label: 'Receive stock',
        href: '/dashboard/suppliers/po',
        desc: 'PO → stock path',
        icon: Package,
      },
      {
        label: 'Stock levels',
        href: '/dashboard/inventory/stock',
        desc: 'Low stock & locations',
        icon: Package,
      },
      {
        label: 'Scan receive',
        href: '/dashboard/inventory/scan',
        desc: 'Barcode / QR intake',
        icon: ShoppingCart,
      },
      {
        label: 'Operations tower',
        href: '/dashboard/operations',
        desc: 'Exceptions & outbound',
        icon: ClipboardList,
      },
    ];
  }
  if (r === 'sales' || r === 'sales_contractor') {
    return [
      {
        label: 'Quotes',
        href: '/dashboard/customers/quotes',
        desc: 'Win pipeline',
        icon: ShoppingCart,
      },
      {
        label: 'Customers',
        href: '/dashboard/customers',
        desc: 'CRM book',
        icon: Users,
      },
      {
        label: 'Network',
        href: '/dashboard/connections',
        desc: 'Partners & pricing',
        icon: Users,
      },
      {
        label: 'Super-Cube®',
        href: '/dashboard/intelligence/leadership-development',
        desc: 'Lead with integrity',
        icon: Brain,
      },
    ];
  }
  // owner / admin / default
  return [
    {
      label: 'Golden path',
      href: '/dashboard/settle',
      desc: 'Unstick trade & pay',
      icon: Wallet,
    },
    {
      label: 'Purchase orders',
      href: '/dashboard/suppliers/po',
      desc: 'Buy / receive',
      icon: ShoppingCart,
    },
    {
      label: 'Insights',
      href: '/dashboard/intelligence/neural-insights',
      desc: 'Act on risks',
      icon: Brain,
    },
    {
      label: 'Team',
      href: '/dashboard/my-business/team',
      desc: 'Roles & access',
      icon: Users,
    },
  ];
}

export default function RoleHomeStrip() {
  const { role, roleLabel, loading, isCompanyModuleEnabled } = useCompanyRole();
  if (loading) return null;
  const advisors = enabledAdvisorModules(isCompanyModuleEnabled);
  const advisorActions: Action[] = advisors.slice(0, 1).flatMap((id) => {
    const hrefs = ADVISOR_MODULE_CORE_HREF[id];
    return [
      {
        label: hrefs.label,
        href: hrefs.book.replace(/\/(clients|patients|customers)$/, ''),
        desc: 'Advisor command',
        icon: Users,
      },
      {
        label: 'People',
        href: '/dashboard/people',
        desc: 'Staff · coaches',
        icon: Users,
      },
      {
        label: 'Customers',
        href: '/dashboard/customers',
        desc: 'Members on CRM',
        icon: ShoppingCart,
      },
      {
        label: 'Finance',
        href: '/dashboard/accounting',
        desc: 'Fees · invoices',
        icon: Wallet,
      },
    ];
  });
  const actions = advisorActions.length
    ? advisorActions
    : actionsForRole(role);

  return (
    <section className="mb-4 rounded-2xl border border-cyan-100 bg-gradient-to-r from-white via-sky-50/40 to-white px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0077b6]">
          Your focus
          {roleLabel ? (
            <span className="text-neutral-400 font-semibold normal-case tracking-normal">
              {' '}
              · {roleLabel}
            </span>
          ) : null}
        </p>
        <span className="text-[10px] text-neutral-400 hidden sm:inline">
          Press ⌘K to jump anywhere
        </span>
      </div>
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="group rounded-xl border border-neutral-200 bg-white px-3 py-2.5 hover:border-[#00b4d8]/50 hover:shadow-sm transition-all touch-manipulation min-h-[4.5rem]"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-lg bg-[#00b4d8]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#00b4d8]" />
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-300 ml-auto group-hover:text-[#00b4d8]" />
              </div>
              <p className="text-sm font-bold text-slate-800">{a.label}</p>
              <p className="text-[11px] text-neutral-500">{a.desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
