'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

export const CUSTOMERS_NAV = [
  { href: '/dashboard/customers', label: 'Overview', exact: true },
  { href: '/dashboard/customers/leads', label: 'Leads & opportunities' },
  { href: '/dashboard/customers/profiles', label: 'Profiles' },
  { href: '/dashboard/customers/onboard', label: 'Add customer' },
  { href: '/dashboard/customers/invites', label: 'Invites' },
  { href: '/dashboard/customers/quotes', label: 'Quotes' },
  { href: '/dashboard/customers/orders', label: 'Orders' },
  { href: '/dashboard/customers/invoices', label: 'Invoices' },
  { href: '/dashboard/customers/reviews', label: 'Peer reviews' },
  { href: '/dashboard/customers/loyalty', label: 'Loyalty' },
  { href: '/dashboard/customers/claims', label: 'Claims' },
  { href: '/dashboard/customers/contracts', label: 'Contracts' },
  { href: '/dashboard/customers/riad-log', label: 'RIAD' },
] as const;

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  const companyId = getSelectedCompanyId();
  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to manage customers.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-6 py-3">
          Select company
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function CustomersNav() {
  const pathname = usePathname() || '';
  return (
    <div className="mb-6 -mx-1">
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
        {CUSTOMERS_NAV.map((item) => {
          const active = isActive(pathname, item.href, 'exact' in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CustomersHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <CustomersNav />
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-3 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Customers overview
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">{title}</h1>
          {description && <p className="text-neutral-600 mt-1 text-sm max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
