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
          description="Share a branded page with buyers who have not joined yet — their quotes, orders, and invoices only. Add people, copy a link, or email access."
        />
        <TradePortalDesk kind="customer" />
      </CustomersPage>
    </CompanyRequired>
  );
}
