'use client';

import {
  CompanyRequired,
  SuppliersHeader,
  SuppliersPage,
} from '@/components/suppliers/SuppliersShell';
import { TradePortalDesk } from '@/components/portals/TradePortalDesk';

export default function SupplierGuestPortalPage() {
  return (
    <CompanyRequired>
      <SuppliersPage>
        <SuppliersHeader
          title="Supplier"
          titleAccent="portal"
          description="A portal for suppliers already on your books. They see their POs and OTIFEF, confirm stock, update status, RIAD, and messages — without joining the OS."
        />
        <TradePortalDesk kind="supplier" />
      </SuppliersPage>
    </CompanyRequired>
  );
}
