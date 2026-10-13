'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';
import SheqHubPage from '@/app/dashboard/sheq/page';
import SheqIncidentsPage from '@/app/dashboard/sheq/incidents/page';
import SheqHazardsPage from '@/app/dashboard/sheq/hazards/page';
import SheqNcrsPage from '@/app/dashboard/sheq/ncrs/page';
import SheqCapasPage from '@/app/dashboard/sheq/capas/page';

export default function SheqPreview({ screen }: { screen: string }) {
  return (
    <FixtureStudio companyId={FIXTURE_COMPANY_ID} companyName={FIXTURE_COMPANY_NAME} label="sample SHEQ">
      {screen === 'incidents' ? <SheqIncidentsPage /> : null}
      {screen === 'hazards' ? <SheqHazardsPage /> : null}
      {screen === 'ncrs' ? <SheqNcrsPage /> : null}
      {screen === 'capas' ? <SheqCapasPage /> : null}
      {screen === 'hub' || !['incidents', 'hazards', 'ncrs', 'capas'].includes(screen) ? (
        <SheqHubPage />
      ) : null}
    </FixtureStudio>
  );
}
