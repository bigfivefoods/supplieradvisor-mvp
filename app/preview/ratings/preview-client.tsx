'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';
import CustomerRatingsPage from '@/app/dashboard/customers/ratings/page';

export default function RatingsPreview() {
  return (
    <FixtureStudio
      companyId={FIXTURE_COMPANY_ID}
      companyName={FIXTURE_COMPANY_NAME}
      label="sample ratings"
    >
      <CustomerRatingsPage />
    </FixtureStudio>
  );
}
