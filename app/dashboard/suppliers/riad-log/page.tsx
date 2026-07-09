'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { SrmSupplierRecord } from '@/lib/suppliers/types';
import SupplierRiadRegister from '@/components/riad/SupplierRiadRegister';
import { CompanyRequired } from '@/components/suppliers/SuppliersShell';

/**
 * Supplier RIAD register — same look and feel as Customer RIAD,
 * scoped to supplier relationships (SRM) instead of CRM customers.
 */
export default function SupplierRiadLogPage() {
  return (
    <CompanyRequired>
      <RiadLogInner />
    </CompanyRequired>
  );
}

function RiadLogInner() {
  const companyId = getSelectedCompanyId()!;
  const [suppliers, setSuppliers] = useState<SrmSupplierRecord[]>([]);

  useEffect(() => {
    fetch(`/api/suppliers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => setSuppliers([]));
  }, [companyId]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-10">
      <Link
        href="/dashboard/suppliers"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Suppliers
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Supplier RIAD register
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          Best-in-class operational log for supplier Risks, Issues, Actions, and Decisions.
          Track supply continuity, OTIF, quality, capacity, and compliance — company-scoped
          and filterable by supplier in your SRM book.
        </p>
      </div>
      <SupplierRiadRegister companyId={companyId} suppliers={suppliers} />
    </div>
  );
}
