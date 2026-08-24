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
          description="Issue a branded portal for a customer on your CRM. They see their live books and can add the people in their business who should have access."
        />
        <TradePortalDesk kind="customer" />
      </CustomersPage>
    </CompanyRequired>
  );
}
