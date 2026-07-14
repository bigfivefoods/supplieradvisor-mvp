'use client';

import SuperCubeTraining from '@/components/leadership/SuperCubeTraining';
import { getSelectedCompanyId } from '@/lib/containers/company';

export default function SalesLeadershipPage() {
  const companyId = getSelectedCompanyId();
  return (
    <SuperCubeTraining
      audience="sales"
      companyId={companyId}
      embedded
    />
  );
}
