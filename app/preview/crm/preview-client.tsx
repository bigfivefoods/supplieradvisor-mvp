'use client';

import { CRM_SAMPLE_FLAG } from '@/lib/customers/crm-preview';
import { FixtureStudio } from '@/components/preview/FixtureStudio';
import CustomersHub from '@/app/dashboard/customers/page';
import ProfilesPage from '@/app/dashboard/customers/profiles/page';
import LeadsPage from '@/app/dashboard/customers/leads/page';
import Customers360Page from '@/app/dashboard/customers/360/page';
import SalesTasksPage from '@/app/sales/tasks/page';

const COMPANY_ID = 91001;

export default function CrmPreviewClient({
  screen,
  initialId,
}: {
  screen: string;
  initialId: number;
}) {
  const id = Number.isFinite(initialId) && initialId !== 0 ? initialId : null;
  const known = ['profiles', 'leads', 'pipeline', '360', 'tasks', 'hub'];
  const active = known.includes(screen) ? screen : 'hub';
  return (
    <FixtureStudio
      companyId={COMPANY_ID}
      companyName="Harbour & Co"
      label="sample book"
      sampleFlag={CRM_SAMPLE_FLAG}
    >
      {active === 'profiles' ? <ProfilesPage preview={{ companyId: COMPANY_ID, id }} /> : null}
      {active === 'leads' || active === 'pipeline' ? <LeadsPage /> : null}
      {active === '360' ? <Customers360Page /> : null}
      {active === 'tasks' ? <SalesTasksPage /> : null}
      {active === 'hub' ? <CustomersHub /> : null}
    </FixtureStudio>
  );
}
