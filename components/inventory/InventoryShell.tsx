'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';

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

export function InventoryHeader({
  title,
  description,
  backHref = '/dashboard/inventory',
  action,
}: {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Inventory
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
