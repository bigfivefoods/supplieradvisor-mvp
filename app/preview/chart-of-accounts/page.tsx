'use client';

import ChartOfAccountsPage from '@/app/dashboard/accounting/chart-of-accounts/page';
import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';

/**
 * Sample chart so the inactive view can be reviewed without a signed-in company.
 * Reads and writes stay in memory.
 */
export default function ChartOfAccountsPreviewPage() {
  return (
    <FixtureStudio
      companyId={FIXTURE_COMPANY_ID}
      companyName={FIXTURE_COMPANY_NAME}
      label="sample chart"
    >
      <ChartOfAccountsPage />
    </FixtureStudio>
  );
}
