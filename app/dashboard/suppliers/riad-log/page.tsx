'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { SrmSupplierRecord } from '@/lib/suppliers/types';
import SupplierRiadRegister from '@/components/riad/SupplierRiadRegister';
import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';

/**
 * Supplier RIAD — same register chrome as Customer RIAD (shared product language).
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
    <SuppliersPage>
      <SuppliersHeader
        title="Supplier RIAD"
        titleAccent="register"
        description="Risks, issues, actions, and decisions across the supply base — continuity, OTIF, quality, capacity, and compliance in one precision log."
      />
      <SupplierRiadRegister companyId={companyId} suppliers={suppliers} />
    </SuppliersPage>
  );
}
