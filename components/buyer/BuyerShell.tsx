'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId, getSelectedCompanyName } from '@/lib/containers/company';

export const BUYER_NAV = [
  { href: '/dashboard/buyer', label: 'Hub', exact: true },
  { href: '/dashboard/buyer/suppliers', label: 'Suppliers' },
  { href: '/dashboard/buyer/pos', label: 'Purchase orders' },
  { href: '/dashboard/buyer/documents', label: 'Documents' },
  { href: '/dashboard/buyer/money', label: 'Money' },
  { href: '/dashboard/buyer/reviews', label: 'Rate' },
] as const;

export function BuyerCompanyRequired({ children }: { children: React.ReactNode }) {
  const companyId = getSelectedCompanyId();
  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">
          Select a company to open the buyer workspace.
        </p>
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

export function BuyerNav() {
  const pathname = usePathname() || '';
  return (
    <div className="mb-6 -mx-1">
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1">
        {BUYER_NAV.map((item) => {
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

export function BuyerHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const companyName = getSelectedCompanyName();
  return (
    <div className="mb-6">
      <BuyerNav />
      <Link
        href="/dashboard/buyer"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-3 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Buyer workspace
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
            {companyName} · buyer
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
            {title}
          </h1>
          {description && (
            <p className="text-neutral-600 mt-1 text-sm max-w-2xl">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

export function SuspendedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium ${className}`}
    >
      Suspended
    </span>
  );
}

export function ConnectedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium ${className}`}
    >
      Connected
    </span>
  );
}

export function supplierDisplayName(s: {
  tradingName?: string | null;
  legalName?: string | null;
  supplierProfileId: number;
}): string {
  return s.tradingName || s.legalName || `Supplier ${s.supplierProfileId}`;
}
