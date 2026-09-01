'use client';

import { useEffect, useState } from 'react';
import { getSelectedCompanyId } from '@/lib/containers/company';
import type { ContainerRecord } from '@/lib/containers/types';
import ContainerRiadRegister from '@/components/riad/ContainerRiadRegister';
import {
  CompanyRequired,
  ContainersHeader,
  ContainersPage,
} from '@/components/containers/ContainersShell';

/**
 * Container RIAD register for company operators — same product language as CRM/SRM RIAD.
 */
export default function ContainerRiadLogPage() {
  return (
    <CompanyRequired>
      <RiadInner />
    </CompanyRequired>
  );
}

function RiadInner() {
  const companyId = getSelectedCompanyId()!;
  const [containers, setContainers] = useState<ContainerRecord[]>([]);

  useEffect(() => {
    fetch(`/api/containers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setContainers(d.containers || []))
      .catch(() => setContainers([]));
  }, [companyId]);

  return (
    <ContainersPage>
      <ContainersHeader
        title="Container RIAD"
        titleAccent="register"
        description="Risks, issues, actions, and decisions for outlets. Independent contractors can log from their portal — everything lands here."
      />
      <ContainerRiadRegister mode="business" companyId={companyId} containers={containers} />
    </ContainersPage>
  );
}
