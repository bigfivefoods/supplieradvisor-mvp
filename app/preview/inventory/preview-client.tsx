'use client';

import { FixtureStudio } from '@/components/preview/FixtureStudio';
import { FIXTURE_COMPANY_ID, FIXTURE_COMPANY_NAME } from '@/lib/preview/os-fixtures';
import InventoryHub from '@/app/dashboard/inventory/page';
import StockPage from '@/app/dashboard/inventory/stock/page';

export default function InventoryPreview({ screen }: { screen: string }) {
  return (
    <FixtureStudio
      companyId={FIXTURE_COMPANY_ID}
      companyName={FIXTURE_COMPANY_NAME}
      label="sample inventory"
    >
      {screen === 'stock' ? <StockPage /> : <InventoryHub />}
    </FixtureStudio>
  );
}
