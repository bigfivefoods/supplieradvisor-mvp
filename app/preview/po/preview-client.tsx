'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';
import SupplierPurchaseOrdersPage from '@/app/dashboard/suppliers/po/PoDesk';

export default function PoPreview() {
  return (
    <FixtureStudio
      companyId={FIXTURE_COMPANY_ID}
      companyName={FIXTURE_COMPANY_NAME}
      label="sample purchase orders"
      onchain
    >
      <SupplierPurchaseOrdersPage />
    </FixtureStudio>
  );
}
