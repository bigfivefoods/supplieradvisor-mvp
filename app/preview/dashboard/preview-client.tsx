'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';
import DashboardCommandCenter from '@/app/dashboard/page';

export default function DashboardPreview() {
  return (
    <FixtureStudio
      companyId={FIXTURE_COMPANY_ID}
      companyName={FIXTURE_COMPANY_NAME}
      label="sample command center"
    >
      <DashboardCommandCenter />
    </FixtureStudio>
  );
}
