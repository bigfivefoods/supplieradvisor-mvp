'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import CustomerRiadRegister from '@/components/riad/CustomerRiadRegister';
import { CompanyRequired } from '@/components/customers/CustomersShell';

/**
 * Customer RIAD register — same look and feel as Container RIAD,
 * scoped to customer relationships (CRM) instead of container outlets.
 */
export default function CustomerRiadLogPage() {
  return (
    <CompanyRequired>
      <RiadLogInner />
    </CompanyRequired>
  );
}

function RiadLogInner() {
  const companyId = getSelectedCompanyId()!;
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);

  useEffect(() => {
    fetch(`/api/customers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch(() => setCustomers([]));
  }, [companyId]);

  return (
    <div className="px-2 md:px-4 max-w-screen-2xl mx-auto pb-10">
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 mb-4 hover:text-neutral-800"
      >
        <ArrowLeft className="w-4 h-4" /> Customers
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-2px] text-[#00b4d8]">
          Customer RIAD register
        </h1>
        <p className="text-neutral-600 mt-2 max-w-2xl">
          Best-in-class operational log for customer Risks, Issues, Actions, and Decisions.
          Track credit, delivery, quality, and relationship items in one place — company-scoped
          and filterable by customer.
        </p>
      </div>
      <CustomerRiadRegister companyId={companyId} customers={customers} />
    </div>
  );
}
