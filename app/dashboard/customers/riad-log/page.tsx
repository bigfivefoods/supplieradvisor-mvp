'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { CustomerRecord } from '@/lib/customers/types';
import CustomerRiadRegister from '@/components/riad/CustomerRiadRegister';
import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';

/**
 * Customer RIAD — same register chrome as Supplier RIAD (shared product language).
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
    <CustomersPage>
      <CustomersHeader
        title="Customer RIAD"
        titleAccent="register"
        description="Risks, issues, actions, and decisions across customer relationships — credit, delivery, quality, and retention in one precision log."
      />
      <CustomerRiadRegister companyId={companyId} customers={customers} />
    </CustomersPage>
  );
}
