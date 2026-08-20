'use client';

import {
  CompanyRequired,
  CustomersHeader,
  CustomersPage,
} from '@/components/customers/CustomersShell';
import { TradePortalDesk } from '@/components/portals/TradePortalDesk';

export default function CustomerGuestPortalPage() {
  return (
    <CompanyRequired>
      <CustomersPage>
        <CustomersHeader
          title="Customer"
          titleAccent="portal"
          description="A portal for customers already on your books. They see their orders, our OTIFEF, ratings, RIAD, and can raise a PO — without joining the OS."
        />
        <TradePortalDesk kind="customer" />
      </CustomersPage>
    </CompanyRequired>
  );
}
