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
          description="Share a branded page with suppliers who have not joined yet — their purchase orders and your documents. Add people and control who can open the link."
        />
        <TradePortalDesk kind="supplier" />
      </SuppliersPage>
    </CompanyRequired>
  );
}
