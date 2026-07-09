'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

/** Canonical inventory process — keep nav, hub, and redirects in sync */
export const INVENTORY_PROCESS = [
  {
    href: '/dashboard/inventory',
    label: 'Overview',
    short: 'Home',
    step: null as number | null,
    exact: true,
  },
  {
    href: '/dashboard/inventory/products',
    label: 'Products',
    short: 'Products',
    step: 1,
    exact: false,
  },
  {
    href: '/dashboard/inventory/warehouses',
    label: 'Locations',
    short: 'Locations',
    step: 2,
    exact: false,
  },
  {
    href: '/dashboard/inventory/stock',
    label: 'Live stock',
    short: 'Stock',
    step: 3,
    exact: false,
  },
  {
    href: '/dashboard/inventory/scan',
    label: 'Receive',
    short: 'Receive',
    step: 4,
    exact: false,
  },
  {
    href: '/dashboard/inventory/stock-transfers',
    label: 'Transfers',
    short: 'Transfers',
    step: 5,
    exact: false,
  },
  {
    href: '/dashboard/inventory/counts',
    label: 'Counts',
    short: 'Counts',
    step: 6,
    exact: false,
  },
] as const;

export const INVENTORY_TOOLS = [
  { href: '/dashboard/inventory/tracking', label: 'Live tracking' },
  { href: '/dashboard/inventory/lots', label: 'Lots & serials' },
  { href: '/dashboard/inventory/edi', label: 'GS1 & EDI' },
] as const;

export function useCompanyId() {
  return getSelectedCompanyId();
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  const companyId = getSelectedCompanyId();
  if (!companyId) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-neutral-600 mb-4">Select a company to use Inventory.</p>
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

export function InventoryProcessNav() {
  const pathname = usePathname() || '';
  return (
    <div className="mb-6 -mx-1">
      <div className="flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {INVENTORY_PROCESS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {item.step != null && (
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    active ? 'bg-white/20' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {item.step}
                </span>
              )}
              {item.short}
            </Link>
          );
        })}
        <span className="flex-shrink-0 self-center text-neutral-300 px-1">|</span>
        {INVENTORY_TOOLS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? 'border-slate-700 bg-slate-800 text-white'
                  : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
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

export function InventoryHeader({
  title,
  description,
  backHref = '/dashboard/inventory',
  action,
  showProcessNav = true,
}: {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
  showProcessNav?: boolean;
}) {
  return (
    <div className="mb-6">
      {showProcessNav && <InventoryProcessNav />}
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-3 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Inventory overview
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

/** Client redirect for consolidated legacy inventory routes */
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-sm text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      <p>Redirecting to the unified inventory process…</p>
    </div>
  );
}
