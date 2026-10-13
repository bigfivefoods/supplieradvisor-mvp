'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import NetworkPage from '@/app/dashboard/suppliers/network/page';

const COMPANY_ID = 91002;

export default function SrmPreviewClient({ initialId }: { initialId: number }) {
  const id = Number.isFinite(initialId) && initialId !== 0 ? initialId : null;
  return (
    <FixtureStudio companyId={COMPANY_ID} companyName="Kelpac Marine" label="sample supply book">
      <NetworkPage preview={{ companyId: COMPANY_ID, id }} />
    </FixtureStudio>
  );
}
